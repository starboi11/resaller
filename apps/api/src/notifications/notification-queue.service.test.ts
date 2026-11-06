import { describe, expect, it, vi } from 'vitest';
import { NotificationQueueService } from './notification-queue.service.js';

describe('notification discovery', () => {
  it('advances beyond the first 100 delivered rows and cycles back', async () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: `n${String(i).padStart(3, '0')}`, user: { notificationEndpoints: [], notificationPreferences: [] } }));
    const findMany = vi.fn().mockResolvedValueOnce(rows).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const service = new NotificationQueueService({ notification: { findMany } } as never, {} as never, {} as never, {} as never);
    await service['dispatch']();
    await service['dispatch']();
    await service['dispatch']();
    expect(findMany.mock.calls[1]![0].where.id).toEqual({ gt: 'n099' });
    expect(findMany.mock.calls[2]![0].where.id).toBeUndefined();
  });

  it('does not skip a failed discovery batch', async () => {
    const findMany = vi.fn().mockRejectedValueOnce(new Error('DB unavailable')).mockResolvedValueOnce([]);
    const service = new NotificationQueueService({ notification: { findMany } } as never, {} as never, {} as never, {} as never);
    await expect(service['dispatch']()).rejects.toThrow('DB unavailable');
    await service['dispatch']();
    expect(findMany.mock.calls[1]![0].where.id).toBeUndefined();
  });
});
