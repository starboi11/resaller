import { describe, expect, it } from 'vitest';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_NAME,
  SessionTokenService,
} from './session-token.service.js';

describe('SessionTokenService', () => {
  it('issues opaque tokens and stores only deterministic hashes', () => {
    const service = new SessionTokenService();
    const issued = service.issue();
    expect(issued.token).not.toBe(issued.tokenHash);
    expect(service.hash(issued.token)).toBe(issued.tokenHash);
    expect(SESSION_COOKIE_NAME.startsWith('__Host-')).toBe(
      process.env.NODE_ENV === 'production',
    );
    expect(SESSION_COOKIE).toMatchObject({
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  });
});
