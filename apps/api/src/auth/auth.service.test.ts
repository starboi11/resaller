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
    );

    await expect(service.resolveSession('session-token')).resolves.toBeNull();
    expect(tokens.hash).toHaveBeenCalledWith('session-token');
  });
});
