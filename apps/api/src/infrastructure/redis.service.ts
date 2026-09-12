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
  async enqueueNotificationJob(id: string, payload: string, runAt = Date.now()): Promise<void> {
    await this.ready();
    await this.client.multi().hset('resaller:notify:jobs', id, payload).zadd('resaller:notify:scheduled', runAt, id).exec();
  }
  async claimNotificationJob(now = Date.now()): Promise<{ id: string; payload: string } | null> {
    await this.ready();
    const result = await this.client.eval(
      "local ids=redis.call('ZRANGEBYSCORE',KEYS[1],'-inf',ARGV[1],'LIMIT',0,1); if #ids==0 then return nil end; local id=ids[1]; redis.call('ZREM',KEYS[1],id); redis.call('ZADD',KEYS[2],ARGV[1],id); local payload=redis.call('HGET',KEYS[3],id); if not payload then redis.call('ZREM',KEYS[2],id); return nil end; return {id,payload}",
      3, 'resaller:notify:scheduled', 'resaller:notify:processing', 'resaller:notify:jobs', now,
    ) as [string, string] | null;
    return result ? { id: result[0], payload: result[1] } : null;
  }
  async completeNotificationJob(id: string): Promise<void> {
    await this.ready();
    await this.client.multi().zrem('resaller:notify:processing', id).hdel('resaller:notify:jobs', id).exec();
  }
  async retryNotificationJob(id: string, runAt: number): Promise<void> {
    await this.ready();
    await this.client.multi().zrem('resaller:notify:processing', id).zadd('resaller:notify:scheduled', runAt, id).exec();
  }
  async recoverNotificationJobs(leaseBefore: number): Promise<number> {
    await this.ready();
    const ids = await this.client.zrangebyscore('resaller:notify:processing', '-inf', leaseBefore);
    if (!ids.length) return 0;
    const transaction = this.client.multi();
    for (const id of ids) transaction.zrem('resaller:notify:processing', id).zadd('resaller:notify:scheduled', Date.now(), id);
    await transaction.exec();
    return ids.length;
  }
  async notificationQueueDepth(): Promise<{ scheduled: number; processing: number }> {
    await this.ready();
    const [scheduled, processing] = await Promise.all([this.client.zcard('resaller:notify:scheduled'), this.client.zcard('resaller:notify:processing')]);
    return { scheduled, processing };
  }
  private async ready(): Promise<void> { if (this.client.status === 'wait') await this.client.connect(); }
  async onModuleDestroy(): Promise<void> { if (this.client.status !== 'end') this.client.disconnect(); }
}
