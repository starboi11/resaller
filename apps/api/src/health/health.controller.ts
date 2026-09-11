import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthStatus } from '@resaller/types';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { RedisService } from '../infrastructure/redis.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(RedisService) private readonly redis: RedisService) {}
  @Get()
  health(): HealthStatus { return { status: 'ok', service: 'resaller-api', timestamp: new Date().toISOString() }; }

  @Get('ready')
  async ready(): Promise<HealthStatus> {
    const [database, redis] = await Promise.all([this.prisma.ping(), this.redis.ping()]);
    return { status: database && redis ? 'ok' : 'degraded', service: 'resaller-api', timestamp: new Date().toISOString(), checks: { database: database ? 'up' : 'down', redis: redis ? 'up' : 'down' } };
  }
}
