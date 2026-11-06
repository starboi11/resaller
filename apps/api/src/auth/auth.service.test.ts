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
    const redis = { fixedWindowLimit: vi.fn().mockResolvedValue(true) };
    const service = new AuthService(
      prisma as never,
      {} as never,
      tokens as never,
      {} as never,
      redis as never,
      delivery as never,
      {} as never,
    );

    await expect(service.requestPasswordReset('buyer', { ip: '127.0.0.1' })).resolves.toEqual({ accepted: true });
    expect(delivery.send).toHaveBeenCalledWith('user-1', 'reset-token-that-is-never-returned');
  });

  it('answers a flooded password reset identically without sending anything', async () => {
    const prisma = { user: { findUnique: vi.fn() } };
    const delivery = { send: vi.fn() };
    const redis = { fixedWindowLimit: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false) };
    const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, redis as never, delivery as never, {} as never);
    await expect(service.requestPasswordReset('victim', { ip: '127.0.0.1' })).resolves.toEqual({ accepted: true });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(delivery.send).not.toHaveBeenCalled();
  });

  it('spends one password verification even when the account does not exist', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) }, securityEvent: { create: vi.fn() } };
    const passwords = { hash: vi.fn().mockResolvedValue('scrypt$dummy'), verify: vi.fn().mockResolvedValue(false) };
    const redis = { fixedWindowLimit: vi.fn().mockResolvedValue(true) };
    const service = new AuthService(prisma as never, passwords as never, {} as never, {} as never, redis as never, {} as never, {} as never);
    await expect(service.login('ghost', 'Wrong123', { ip: '127.0.0.1' })).rejects.toThrow('Invalid username or password');
    expect(passwords.verify).toHaveBeenCalledTimes(1);
    expect(passwords.verify).toHaveBeenCalledWith('Wrong123', 'scrypt$dummy');
  });

  it('limits registrations per network address', async () => {
    const prisma = { user: { create: vi.fn() } };
    const redis = { fixedWindowLimit: vi.fn().mockResolvedValue(false) };
    const service = new AuthService(prisma as never, { hash: vi.fn() } as never, {} as never, {} as never, redis as never, {} as never, {} as never);
    await expect(service.register('newbie', 'Parol123', { ip: '203.0.113.9' }, { fullName: 'Ali Valiyev', phone: '+998901234567' })).rejects.toMatchObject({ status: 429 });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  const sessionFixture = (roles: string[], verified = false) => ({
    expiresAt: new Date(Date.now() + 60_000), revokedAt: null,
    twoFactorVerifiedAt: verified ? new Date() : null,
    user: { id: 'user-1', publicId: 'public-1', username: 'test', roles,
      createdAt: new Date(), deletedAt: null, accountStatus: 'ACTIVE',
      totpEnabledAt: verified ? new Date() : null },
  });
  const serviceForSession = (session: ReturnType<typeof sessionFixture>) => new AuthService(
    { session: { findUnique: vi.fn().mockResolvedValue(session) } } as never,
    {} as never, { hash: vi.fn().mockReturnValue('hash') } as never,
    {} as never, {} as never, {} as never, {} as never,
  );

  it('denies a buyer session after the account gains an admin role without 2FA', async () => {
    await expect(serviceForSession(sessionFixture(['BUYER', 'SUPER_ADMIN'])).resolveSession('token')).resolves.toBeNull();
  });
  it('allows ordinary buyer sessions without 2FA', async () => {
    await expect(serviceForSession(sessionFixture(['BUYER'])).resolveSession('token')).resolves.toMatchObject({ id: 'user-1' });
  });
  it('allows a privileged session only after verified 2FA', async () => {
    await expect(serviceForSession(sessionFixture(['SUPER_ADMIN'], true)).resolveSession('token')).resolves.toMatchObject({ roles: ['SUPER_ADMIN'] });
  });
  it('denies blocked accounts even with a previously verified admin session', async () => {
    const session = sessionFixture(['SUPER_ADMIN'], true);
    session.user.accountStatus = 'SUSPENDED';
    await expect(serviceForSession(session).resolveSession('token')).resolves.toBeNull();
  });
  it('denies a challenge issued before an account was suspended', async () => {
    const prisma = { twoFactorChallenge: { findUnique: vi.fn().mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000), usedAt: null,
      user: { deletedAt: null, accountStatus: 'SUSPENDED' },
    }) } };
    const service = new AuthService(prisma as never, {} as never,
      { hash: vi.fn().mockReturnValue('hash') } as never, {} as never, {} as never, {} as never, {} as never);
    await expect(service.verifyTwoFactor('challenge', '123456')).rejects.toThrow('invalid or expired');
  });
  it('limits password attempts before querying accounts or computing a password hash', async () => {
    const prisma = { user: { findUnique: vi.fn() }, securityEvent: { create: vi.fn() } };
    const passwords = { verify: vi.fn() };
    const redis = { fixedWindowLimit: vi.fn().mockResolvedValue(false) };
    const service = new AuthService(prisma as never, passwords as never, {} as never, {} as never, redis as never, {} as never, {} as never);
    await expect(service.login('owner', 'wrong', { ip: '127.0.0.1' })).rejects.toThrow('Invalid username or password');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(passwords.verify).not.toHaveBeenCalled();
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'LOGIN_RATE_LIMITED' }) }));
  });

  it('signs an admin in with the password alone when ADMIN_TWO_FACTOR_REQUIRED=false, and records it', async () => {
    const previous = process.env.ADMIN_TWO_FACTOR_REQUIRED;
    process.env.ADMIN_TWO_FACTOR_REQUIRED = 'false';
    try {
      const admin = { id: 'admin-1', publicId: 'cadmin', username: 'boss', passwordHash: 'h', roles: ['SUPER_ADMIN'], deletedAt: null, accountStatus: 'ACTIVE', createdAt: new Date() };
      const prisma = {
        user: { findUnique: vi.fn().mockResolvedValue(admin) },
        session: { findFirst: vi.fn().mockResolvedValue({ id: 'known' }), create: vi.fn() },
        sellerProfile: { findUnique: vi.fn().mockResolvedValue(null) },
        securityEvent: { create: vi.fn() },
        twoFactorChallenge: { updateMany: vi.fn(), create: vi.fn() },
      };
      const passwords = { hash: vi.fn().mockResolvedValue('dummy'), verify: vi.fn().mockResolvedValue(true) };
      const tokens = { issue: vi.fn().mockReturnValue({ token: 't', tokenHash: 'th' }), hash: vi.fn() };
      const redis = { fixedWindowLimit: vi.fn().mockResolvedValue(true) };
      const service = new AuthService(prisma as never, passwords as never, tokens as never, {} as never, redis as never, {} as never, {} as never);
      const result = await service.login('boss', 'Abcdefgh12345678', { ip: '127.0.0.1' }) as { session?: { expiresAt: Date }; twoFactor?: unknown };
      expect(result.twoFactor).toBeUndefined();
      expect(prisma.twoFactorChallenge.create).not.toHaveBeenCalled();
      expect(prisma.securityEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'ADMIN_LOGIN' }) }));
      // Admin sessions last 12 hours, not 30 days.
      const hours = (result.session!.expiresAt.getTime() - Date.now()) / 3_600_000;
      expect(hours).toBeGreaterThan(11.9);
      expect(hours).toBeLessThan(12.1);
      expect(redis.fixedWindowLimit).toHaveBeenCalledWith(expect.stringMatching(/^admin-login:/), 5, 900);
    } finally {
      if (previous === undefined) delete process.env.ADMIN_TWO_FACTOR_REQUIRED;
      else process.env.ADMIN_TWO_FACTOR_REQUIRED = previous;
    }
  });
});
