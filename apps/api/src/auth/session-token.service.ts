import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

const isProduction = process.env.NODE_ENV === 'production';

// The __Host- prefix requires Secure, which browsers correctly reject over the
// plain HTTP origin used by local development and browser tests. Production
// keeps the stronger host-only cookie while local environments use an explicit
// non-prefixed development cookie.
export const SESSION_COOKIE_NAME = isProduction
  ? '__Host-resaller_session'
  : 'resaller_session';
export const SESSION_COOKIE = Object.freeze({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
});

@Injectable()
export class SessionTokenService {
  issue(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: this.hash(token) };
  }
  hash(token: string): string {
    return createHash('sha256').update(token).digest('base64url');
  }
}
