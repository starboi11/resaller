import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

describe('AuthService session resolution', () => {
  it('treats an orphaned session as invalid instead of throwing', async () => {
    const prisma = {
      session: { findUnique: vi.fn().mockResolvedValue({ user: null }) },
    };
    const tokens = { hash: vi.fn().mockReturnValue('hashed-token') };
    const service = new AuthService(
      prisma as never,
      {} as never,
      tokens as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.resolveSession('session-token')).resolves.toBeNull();
    expect(tokens.hash).toHaveBeenCalledWith('session-token');
  });

  it('never returns a password-reset bearer token in development', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', deletedAt: null }) },
      passwordResetToken: { updateMany: vi.fn().mockReturnValue({}), create: vi.fn().mockReturnValue({}) },
      securityEvent: { create: vi.fn().mockReturnValue({}) },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    const tokens = { issue: vi.fn().mockReturnValue({ token: 'reset-token-that-is-never-returned', tokenHash: 'hash' }) };
    const delivery = { send: vi.fn().mockResolvedValue(true) };
    const service = new AuthService(
      prisma as never,
      {} as never,
      tokens as never,
      {} as never,
      {} as never,
      delivery as never,
    );

    await expect(service.requestPasswordReset('buyer')).resolves.toEqual({ accepted: true });
    expect(delivery.send).toHaveBeenCalledWith('user-1', 'reset-token-that-is-never-returned');
  });
});
