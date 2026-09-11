import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
const KEY_LENGTH = 64;
const COST = 32_768;
const derive = (password: string, salt: Buffer, n: number, r = 8, p = 1): Promise<Buffer> =>
  new Promise((resolve, reject) => nodeScrypt(password, salt, KEY_LENGTH, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt, COST);
    return `scrypt$${COST}$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    const [algorithm, n, r, p, saltText, keyText] = encoded.split('$');
    if (algorithm !== 'scrypt' || !n || !r || !p || !saltText || !keyText) return false;
    const expected = Buffer.from(keyText, 'base64url');
    if (expected.length !== KEY_LENGTH) return false;
    try {
      const actual = await derive(password, Buffer.from(saltText, 'base64url'), Number(n), Number(r), Number(p));
      return timingSafeEqual(expected, actual);
    } catch { return false; }
  }
}
