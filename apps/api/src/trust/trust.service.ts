import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { calculateTrust } from './trust-policy.js';

@Injectable()
export class TrustService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger(TrustService.name);
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(
      () => void this.recalculate().catch(() => this.logger.error('Trust recalculation failed; will retry on the next tick')),
      60 * 60 * 1000,
    );
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async recalculate() {
    return this.prisma.$transaction(
      async (tx) => {
        const [lock] = await tx.$queryRaw<
          Array<{ locked: boolean }>
        >`SELECT pg_try_advisory_xact_lock(904211) AS locked`;
        if (!lock?.locked) return { skipped: true, stores: 0 };
        const since = new Date(Date.now() - 90 * 86_400_000);
        const periodStart = new Date(
          Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
        );
        const stores = await tx.store.findMany({
          select: {
            id: true,
            sellerProfile: {
              select: { id: true, verifiedAt: true, trustBadge: true },
            },
            orders: {
              where: { createdAt: { gte: since } },
              select: { status: true, fulfillmentStoreId: true, dispute: { select: { id: true } } },
            },
            fulfilledOrders: {
              where: { createdAt: { gte: since } },
              select: { status: true, dispute: { select: { id: true } } },
            },
          },
        });
        for (const store of stores) {
          // Resale orders: the reseller earns credit for completed sales, but
          // rejections, timeouts and disputes count against the supplier that
          // ships them, because the reseller cannot act on those orders.
          const own = store.orders.filter((order) => !order.fulfillmentStoreId);
          const shipped = [...own, ...store.fulfilledOrders];
          const inputs = {
            verified: Boolean(store.sellerProfile.verifiedAt),
            completed: store.orders.filter(
              (order) => order.status === 'COMPLETED',
            ).length,
            cancelled: shipped.filter((order) =>
              ['CANCELLED', 'REJECTED'].includes(order.status),
            ).length,
            timedOut: shipped.filter((order) => order.status === 'TIMEOUT')
              .length,
            disputes: shipped.filter((order) => Boolean(order.dispute))
              .length,
          };
          const result = calculateTrust(inputs);
          await tx.sellerMetric.upsert({
            where: { storeId_periodStart: { storeId: store.id, periodStart } },
            create: {
              storeId: store.id,
              periodStart,
              completedOrders: inputs.completed,
              cancellations: inputs.cancelled,
              timeouts: inputs.timedOut,
              disputes: inputs.disputes,
            },
            update: {
              completedOrders: inputs.completed,
              cancellations: inputs.cancelled,
              timeouts: inputs.timedOut,
              disputes: inputs.disputes,
            },
          });
          if (result.badge !== store.sellerProfile.trustBadge) {
            await tx.sellerProfile.update({
              where: { id: store.sellerProfile.id },
              data: { trustBadge: result.badge },
            });
            await tx.trustEvent.create({
              data: {
                storeId: store.id,
                type: 'BADGE_CHANGED',
                weight: result.score,
                metadata: {
                  from: store.sellerProfile.trustBadge,
                  to: result.badge,
                  windowDays: 90,
                },
              },
            });
          }
          if (result.timeoutRisk) {
            const existing = await tx.riskEvent.findFirst({
              where: {
                subjectType: 'STORE',
                subjectId: store.id,
                signal: 'ELEVATED_TIMEOUT_RATE',
                createdAt: { gte: periodStart },
                reviewedAt: null,
              },
            });
            if (!existing)
              await tx.riskEvent.create({
                data: {
                  subjectType: 'STORE',
                  subjectId: store.id,
                  signal: 'ELEVATED_TIMEOUT_RATE',
                  score: result.score,
                  metadata: { reviewRequired: true, windowDays: 90 },
                },
              });
          }
        }
        return { skipped: false, stores: stores.length };
      },
      { timeout: 30_000 },
    );
  }
}
