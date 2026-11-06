import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsController } from './analytics.controller.js';
import { PrismaService } from '../infrastructure/prisma.service.js';

afterEach(() => vi.unstubAllEnvs());

describe('privacy-minimal visit counting', () => {
  it('sets a protected first-party token and upserts one browser/day', async () => {
    vi.stubEnv('SESSION_SECRET', 'local-test-only-secret-1234567890123456');
    vi.stubEnv('NODE_ENV', 'production');
    const upsert = vi.fn().mockResolvedValue({});
    const setCookie = vi.fn();
    const controller = new AnalyticsController({ siteVisit: { upsert } } as unknown as PrismaService);
    await expect(controller.visit({ cookies: {} } as never, { setCookie } as never)).resolves.toEqual({ recorded: true });
    expect(setCookie).toHaveBeenCalledWith('rs_visit', expect.any(String), expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax' }));
    const input = upsert.mock.calls[0]![0];
    expect(input.where.day_visitorHash.visitorHash).toMatch(/^[0-9a-f]{64}$/);
    expect(input.create).not.toHaveProperty('ip');
    expect(input.update.pageViews).toEqual({ increment: 1 });
  });

  it('reuses a valid token instead of making another browser identity', async () => {
    vi.stubEnv('SESSION_SECRET', 'local-test-only-secret-1234567890123456');
    const upsert = vi.fn().mockResolvedValue({});
    const setCookie = vi.fn();
    const controller = new AnalyticsController({ siteVisit: { upsert } } as unknown as PrismaService);
    const token = '15d7e333-d932-45e1-88d2-f58836c78a90';
    await controller.visit({ cookies: { rs_visit: token } } as never, { setCookie } as never);
    await controller.visit({ cookies: { rs_visit: token } } as never, { setCookie } as never);
    expect(setCookie).not.toHaveBeenCalled();
    expect(upsert.mock.calls[0]![0].where.day_visitorHash.visitorHash).toBe(upsert.mock.calls[1]![0].where.day_visitorHash.visitorHash);
  });
});
