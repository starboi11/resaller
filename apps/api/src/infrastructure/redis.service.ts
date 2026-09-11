import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });
  }
  async ping(): Promise<boolean> {
    try { if (this.client.status === 'wait') await this.client.connect(); return (await this.client.ping()) === 'PONG'; } catch { return false; }
  }
  async onModuleDestroy(): Promise<void> { if (this.client.status !== 'end') this.client.disconnect(); }
}
