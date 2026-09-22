import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasswordResetDeliveryService } from './password-reset-delivery.service.js';

describe('PasswordResetDeliveryService', () => {
  afterEach(() => {
    delete process.env.PUBLIC_WEB_URL;
    vi.restoreAllMocks();
  });

  it('sends a one-time link only through configured email endpoints', async () => {
    process.env.PUBLIC_WEB_URL = 'https://resaller.uz';
    const prisma = { notificationEndpoint: { findMany: vi.fn().mockResolvedValue([{ id: 'email-1', valueEncrypted: 'ciphertext' }]) } };
    const crypto = { decrypt: vi.fn().mockReturnValue('buyer@example.com') };
    const provider = { enabled: vi.fn().mockReturnValue(true), send: vi.fn().mockResolvedValue(undefined) };
    const service = new PasswordResetDeliveryService(prisma as never, crypto as never, provider as never);

    await expect(service.send('user-1', 'one-time-token')).resolves.toBe(true);
    expect(provider.send).toHaveBeenCalledWith(
      'EMAIL',
      'buyer@example.com',
      expect.objectContaining({ payload: expect.objectContaining({ resetUrl: 'https://resaller.uz/recovery?token=one-time-token' }) }),
    );
  });

  it('does not create a recovery link without a configured delivery channel', async () => {
    const provider = { enabled: vi.fn().mockReturnValue(false), send: vi.fn() };
    const service = new PasswordResetDeliveryService({} as never, {} as never, provider as never);
    await expect(service.send('user-1', 'token')).resolves.toBe(false);
    expect(provider.send).not.toHaveBeenCalled();
  });
});
