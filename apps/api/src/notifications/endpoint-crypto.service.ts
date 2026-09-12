import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

@Injectable()
export class EndpointCryptoService {
  hash(value: string): string { return createHash('sha256').update(value).digest('base64url'); }
  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
  }
  decrypt(payload: string): string {
    const [iv, tag, encrypted] = payload.split('.');
    if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted endpoint');
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
  }
  private key(): Buffer { return createHash('sha256').update(process.env.SESSION_SECRET ?? 'development-only').digest(); }
}
