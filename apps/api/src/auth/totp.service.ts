import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class TotpService {
  generateSecret(): string {
    return this.base32Encode(randomBytes(20));
  }

  provisioningUri(username: string, secret: string): string {
    const issuer = 'Resaller.uz';
    return `otpauth://totp/${encodeURIComponent(`${issuer}:${username}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  }

  verify(secret: string, code: string, now = Date.now()): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    const counter = Math.floor(now / 30_000);
    return [-1, 0, 1].some((offset) => {
      const expected = this.code(secret, counter + offset);
      return timingSafeEqual(Buffer.from(expected), Buffer.from(code));
    });
  }

  encrypt(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
  }

  decrypt(payload: string): string {
    const [ivValue, tagValue, encryptedValue] = payload.split('.');
    if (!ivValue || !tagValue || !encryptedValue) throw new Error('Invalid encrypted TOTP secret');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
  }

  private code(secret: string, counter: number): string {
    const value = Buffer.alloc(8);
    value.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', this.base32Decode(secret)).update(value).digest();
    const offset = digest[digest.length - 1]! & 0x0f;
    const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    return binary.toString().padStart(6, '0');
  }

  private encryptionKey(): Buffer {
    return createHash('sha256')
      .update(process.env.DATA_ENCRYPTION_KEY ?? process.env.SESSION_SECRET ?? 'development-only')
      .digest();
  }

  private base32Encode(input: Buffer): string {
    let bits = '';
    for (const byte of input) bits += byte.toString(2).padStart(8, '0');
    let output = '';
    for (let index = 0; index < bits.length; index += 5) output += BASE32[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
    return output;
  }

  private base32Decode(input: string): Buffer {
    let bits = '';
    for (const character of input.replace(/=+$/u, '').toUpperCase()) {
      const index = BASE32.indexOf(character);
      if (index < 0) throw new Error('Invalid base32 secret');
      bits += index.toString(2).padStart(5, '0');
    }
    const bytes: number[] = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
    return Buffer.from(bytes);
  }
}
