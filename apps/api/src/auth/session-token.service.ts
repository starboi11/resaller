import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE_NAME = '__Host-resaller_session';
export const SESSION_COOKIE = Object.freeze({ httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' });

@Injectable()
export class SessionTokenService {
  issue(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: this.hash(token) };
  }
  hash(token: string): string { return createHash('sha256').update(token).digest('base64url'); }
}
