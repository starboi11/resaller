import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service.js';

@Injectable()
export class OrderTimeoutService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  onModuleInit(): void {
    this.timer = setInterval(() => void this.expireDueOrders(), 30_000);
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
  async expireDueOrders(now = new Date()): Promise<number> {
    const due = await this.prisma.order.findMany({
      where: { status: 'WAITING_SELLER', sellerAcceptBy: { lte: now } },
      select: { id: true },
      take: 100,
    });
    let expired = 0;
    for (const candidate of due) {
      const changed = await this.prisma.$transaction(
        async (tx) => {
          const updated = await tx.order.updateMany({
            where: {
              id: candidate.id,
              status: 'WAITING_SELLER',
              sellerAcceptBy: { lte: now },
            },
            data: { status: 'TIMEOUT' },
          });
          if (!updated.count) return false;
          const reservations = await tx.stockReservation.findMany({
            where: { orderId: candidate.id, status: 'ACTIVE' },
          });
          for (const reservation of reservations) {
            await tx.inventory.update({
              where: { variantId: reservation.variantId },
              data: {
                available: { increment: reservation.quantity },
                reserved: { decrement: reservation.quantity },
                version: { increment: 1 },
              },
            });
            await tx.stockReservation.update({
              where: { id: reservation.id },
              data: { status: 'RELEASED' },
            });
          }
          await tx.orderStatusHistory.create({
            data: {
              orderId: candidate.id,
              fromStatus: 'WAITING_SELLER',
              toStatus: 'TIMEOUT',
              reason: 'Seller acceptance window expired',
            },
          });
          return true;
        },
        { isolationLevel: 'Serializable' },
      );
      if (changed) expired += 1;
    }
    return expired;
  }
}
