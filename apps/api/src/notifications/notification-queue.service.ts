import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { RedisService } from '../infrastructure/redis.service.js';
import { EndpointCryptoService } from './endpoint-crypto.service.js';
import { NotificationProviderService } from './notification-provider.service.js';

const MAX_ATTEMPTS = 5;

@Injectable()
export class NotificationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastRunAt?: string;
  private dispatchCursor: string | undefined;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(EndpointCryptoService) private readonly crypto: EndpointCryptoService,
    @Inject(NotificationProviderService) private readonly provider: NotificationProviderService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 2_000);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  async health() {
    try { return { status: 'up', ...(await this.redis.notificationQueueDepth()), lastRunAt: this.lastRunAt ?? null }; }
    catch { return { status: 'down', scheduled: -1, processing: -1, lastRunAt: this.lastRunAt ?? null }; }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.redis.recoverNotificationJobs(Date.now() - 5 * 60_000);
      await this.dispatch();
      for (let index = 0; index < 20; index += 1) if (!(await this.workOne())) break;
      this.lastRunAt = new Date().toISOString();
    } catch (error) { this.logger.error(error instanceof Error ? error.message : 'Notification queue failed'); }
    finally { this.running = false; }
  }

  private async dispatch(): Promise<void> {
    const notifications = await this.prisma.notification.findMany({
      where: { ...(this.dispatchCursor ? { id: { gt: this.dispatchCursor } } : {}), createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60_000) }, user: { notificationEndpoints: { some: { active: true } } } },
      include: { user: { include: { notificationEndpoints: { where: { active: true } }, notificationPreferences: true } } },
      take: 100,
      orderBy: { id: 'asc' },
    });
    for (const notification of notifications) {
      for (const endpoint of notification.user.notificationEndpoints) {
        if (!this.provider.enabled(endpoint.channel as 'EMAIL' | 'TELEGRAM' | 'PUSH')) continue;
        const preference = notification.user.notificationPreferences.find((item) => item.channel === endpoint.channel && item.eventType === notification.type);
        if (preference?.enabled === false) continue;
        const delivery = await this.prisma.notificationDelivery.upsert({
          where: { notificationId_endpointId: { notificationId: notification.id, endpointId: endpoint.id } },
          create: { notificationId: notification.id, endpointId: endpoint.id },
          update: {},
        });
        if (delivery.status === 'QUEUED') await this.redis.enqueueNotificationJob(delivery.id, JSON.stringify({ deliveryId: delivery.id }));
      }
    }
    // Advance beyond delivered rows; otherwise the first 100 permanently hide
    // later notifications. Cycle back to discover new endpoints/preferences.
    this.dispatchCursor = notifications.length === 100 ? notifications.at(-1)!.id : undefined;
  }

  private async workOne(): Promise<boolean> {
    const job = await this.redis.claimNotificationJob();
    if (!job) return false;
    try {
      const { deliveryId } = JSON.parse(job.payload) as { deliveryId: string };
      const delivery = await this.prisma.notificationDelivery.update({
        where: { id: deliveryId }, data: { status: 'PROCESSING', attempts: { increment: 1 } },
        include: { endpoint: true, notification: true },
      });
      await this.provider.send(delivery.endpoint.channel as 'EMAIL' | 'TELEGRAM' | 'PUSH', this.crypto.decrypt(delivery.endpoint.valueEncrypted), {
        id: delivery.id, type: delivery.notification.type, severity: delivery.notification.severity, payload: delivery.notification.payload,
      });
      await this.prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'DELIVERED', deliveredAt: new Date(), lastError: null } });
      await this.redis.completeNotificationJob(job.id);
    } catch (error) {
      const message = (error instanceof Error ? error.message : 'Delivery failed').slice(0, 500);
      const delivery = await this.prisma.notificationDelivery.findUnique({ where: { id: job.id } });
      if (!delivery || delivery.attempts >= MAX_ATTEMPTS) {
        if (delivery) await this.prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'FAILED', lastError: message } });
        await this.redis.completeNotificationJob(job.id);
      } else {
        await this.prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'QUEUED', lastError: message } });
        const delay = Math.min(15 * 60_000, 5_000 * 2 ** Math.max(0, delivery.attempts - 1));
        await this.redis.retryNotificationJob(job.id, Date.now() + delay);
      }
      this.logger.warn(`Notification delivery ${job.id} failed: ${message}`);
    }
    return true;
  }
}
