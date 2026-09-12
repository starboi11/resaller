import { Controller, Get, Header, Inject, Req, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { NotificationQueueService } from '../notifications/notification-queue.service.js';

@Controller('metrics')
export class MetricsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(NotificationQueueService) private readonly queue: NotificationQueueService) {}

  @Get()
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(@Req() request: FastifyRequest): Promise<string> {
    const token = process.env.METRICS_TOKEN;
    if (token && request.headers.authorization !== `Bearer ${token}`) throw new UnauthorizedException('Metrics token required');
    const now = new Date();
    const [pendingOrders, overdueOrders, openDisputes, unreviewedSecurity, failedDeliveries, queue] = await Promise.all([
      this.prisma.order.count({ where: { status: 'WAITING_SELLER' } }),
      this.prisma.order.count({ where: { status: 'WAITING_SELLER', sellerAcceptBy: { lt: now } } }),
      this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'EVIDENCE', 'REVIEW'] } } }),
      this.prisma.securityEvent.count({ where: { reviewedAt: null } }),
      this.prisma.notificationDelivery.count({ where: { status: 'FAILED' } }),
      this.queue.health(),
    ]);
    const values: Record<string, number> = {
      resaller_orders_pending_seller: pendingOrders,
      resaller_orders_acceptance_overdue: overdueOrders,
      resaller_disputes_open: openDisputes,
      resaller_security_events_unreviewed: unreviewedSecurity,
      resaller_notification_deliveries_failed: failedDeliveries,
      resaller_notification_queue_scheduled: queue.scheduled,
      resaller_notification_queue_processing: queue.processing,
      process_uptime_seconds: process.uptime(),
      process_resident_memory_bytes: process.memoryUsage().rss,
    };
    return `${Object.entries(values).map(([name, value]) => `# TYPE ${name} gauge\n${name} ${value}`).join('\n')}\n`;
  }
}
