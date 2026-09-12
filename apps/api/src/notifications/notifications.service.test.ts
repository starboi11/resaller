import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsService', () => {
  it('does not allow critical notification delivery to be disabled', async () => {
    const service = new NotificationsService({ notificationPreference: { upsert: vi.fn() } } as never, {} as never);
    expect(() => service.preference('user', 'EMAIL', 'SECURITY_ALERT', false)).toThrow('Critical notifications cannot be disabled');
  });

  it('stores non-critical preferences', async () => {
    const upsert = vi.fn().mockResolvedValue({ enabled: false });
    const service = new NotificationsService({ notificationPreference: { upsert } } as never, {} as never);
    await expect(service.preference('user', 'EMAIL', 'MARKETING', false)).resolves.toEqual({ enabled: false });
    expect(upsert).toHaveBeenCalledOnce();
  });
});
