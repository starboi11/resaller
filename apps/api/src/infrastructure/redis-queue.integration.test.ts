import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Redis } from 'ioredis';
import { RedisService } from './redis.service.js';

const enabled = process.env.RUN_REDIS_TESTS === '1';
if (enabled) {
  const url = new URL(process.env.REDIS_TEST_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/(?:[1-9]|1[0-5])$/.test(url.pathname))
    throw new Error('Redis tests require a dedicated nonzero local Redis database');
  process.env.REDIS_URL = url.toString();
}
(enabled ? describe : describe.skip)('Redis queue retry and lease isolation', () => {
  let service: RedisService;
  let client: Redis;
  const id = `queue-audit-${Date.now()}`;
  beforeAll(async () => {
    client = new Redis(process.env.REDIS_TEST_URL!);
    service = new RedisService();
    await service.ping();
  });
  afterAll(async () => {
    await client.multi().zrem('resaller:notify:scheduled', id).zrem('resaller:notify:processing', id).hdel('resaller:notify:jobs', id).exec();
    await service.onModuleDestroy();
    client.disconnect();
  });
  it('does not shorten a retry delay when discovery repeats', async () => {
    const future = Date.now() + 60_000;
    await service.enqueueNotificationJob(id, 'fixture', future);
    await service.enqueueNotificationJob(id, 'fixture', Date.now());
    expect(Number(await client.zscore('resaller:notify:scheduled', id))).toBe(future);
  });
  it('does not enqueue an already processing job', async () => {
    await client.multi().zrem('resaller:notify:scheduled', id).zadd('resaller:notify:processing', Date.now(), id).exec();
    await service.enqueueNotificationJob(id, 'fixture');
    expect(await client.zscore('resaller:notify:scheduled', id)).toBeNull();
  });
});
