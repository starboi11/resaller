import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthStatus } from '@resaller/types';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { RedisService } from '../infrastructure/redis.service.js';
import { NotificationQueueService } from '../notifications/notification-queue.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(RedisService) private readonly redis: RedisService, @Inject(NotificationQueueService) private readonly queue: NotificationQueueService) {}
  @Get()
  health(): HealthStatus { return { status: 'ok', service: 'resaller-api', timestamp: new Date().toISOString() }; }

  @Get('ready')
  async ready(): Promise<HealthStatus> {
    const [database, redis, queue] = await Promise.all([this.prisma.ping(), this.redis.ping(), this.queue.health()]);
    return { status: database && redis && queue.status === 'up' ? 'ok' : 'degraded', service: 'resaller-api', timestamp: new Date().toISOString(), checks: { database: database ? 'up' : 'down', redis: redis ? 'up' : 'down', queue: queue.status === 'up' ? 'up' : 'down' } };
  }
}
