import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationProviderService } from './notification-provider.service.js';

describe('NotificationProviderService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.EMAIL_WEBHOOK_URL;
    delete process.env.EMAIL_WEBHOOK_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it('sends webhook deliveries with authentication and an idempotency key', async () => {
    process.env.EMAIL_WEBHOOK_URL = 'https://provider.example/send';
    process.env.EMAIL_WEBHOOK_TOKEN = 'secret';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const service = new NotificationProviderService();
    await service.send('EMAIL', 'buyer@example.com', { id: 'delivery-1', type: 'ORDER_CREATED', severity: 'INFO', payload: { orderId: '1' } });
    expect(fetchMock).toHaveBeenCalledWith('https://provider.example/send', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ authorization: 'Bearer secret', 'idempotency-key': 'delivery-1' }),
    }));
  });

  it('rejects channels that have no configured provider', async () => {
    await expect(new NotificationProviderService().send('EMAIL', 'buyer@example.com', { id: '1', type: 'TEST', severity: 'INFO', payload: {} })).rejects.toThrow('not configured');
  });
});
