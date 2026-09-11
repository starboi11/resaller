import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard.js';

const context = (roles: string[]) => ({ getHandler: vi.fn(), getClass: vi.fn(), switchToHttp: () => ({ getRequest: () => ({ user: { roles } }) }) }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  it('allows a required role', () => expect(new RolesGuard({ getAllAndOverride: () => ['MODERATOR'] } as never).canActivate(context(['MODERATOR']))).toBe(true));
  it('allows super admin override', () => expect(new RolesGuard({ getAllAndOverride: () => ['SECURITY_ADMIN'] } as never).canActivate(context(['SUPER_ADMIN']))).toBe(true));
  it('rejects unrelated roles', () => expect(new RolesGuard({ getAllAndOverride: () => ['MODERATOR'] } as never).canActivate(context(['BUYER']))).toBe(false));
});
