import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthStatus } from '@resaller/types';
import { mkdir, statfs } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { RedisService } from '../infrastructure/redis.service.js';
import { NotificationQueueService } from '../notifications/notification-queue.service.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(NotificationQueueService)
    private readonly queue: NotificationQueueService,
  ) {}
  @Get() health(): HealthStatus {
    return {
      status: 'ok',
      service: 'resaller-api',
      timestamp: new Date().toISOString(),
    };
  }
  @Get('ready') async ready(): Promise<HealthStatus> {
    const [database, redis, queue, storage] = await Promise.all([
      this.prisma.ping(),
      this.redis.ping(),
      this.queue.health(),
      this.storageHealthy(),
    ]);
    return {
      status:
        database && redis && queue.status === 'up' && storage
          ? 'ok'
          : 'degraded',
      service: 'resaller-api',
      timestamp: new Date().toISOString(),
      checks: {
        database: database ? 'up' : 'down',
        redis: redis ? 'up' : 'down',
        queue: queue.status === 'up' ? 'up' : 'down',
        storage: storage ? 'up' : 'down',
      },
    };
  }
  private async storageHealthy(): Promise<boolean> {
    if (process.env.MEDIA_STORAGE_DRIVER === 's3')
      return Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET);
    try {
      for (const root of [
        resolve(process.env.MEDIA_ROOT ?? './data/media'),
        resolve(process.env.PRIVATE_MEDIA_ROOT ?? './data/private-media'),
      ]) {
        await mkdir(root, { recursive: true });
        const info = await statfs(root);
        if (info.bavail * info.bsize < 100 * 1024 * 1024) return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}
