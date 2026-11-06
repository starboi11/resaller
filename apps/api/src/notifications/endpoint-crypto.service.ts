import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Ciphertext carries its key generation so DATA_ENCRYPTION_KEY can be rotated
// without orphaning stored phone numbers and addresses. Writes always use the
// current key; reads accept the current key and, while a rotation is in
// progress, DATA_ENCRYPTION_KEY_PREVIOUS. Rows written before versioning was
// introduced have no prefix and are read with the current key.
const CURRENT_VERSION = 'v1';

@Injectable()
export class EndpointCryptoService {
  hash(value: string): string { return createHash('sha256').update(value).digest('base64url'); }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [CURRENT_VERSION, ...[iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url'))].join('.');
  }

  decrypt(payload: string): string {
    const parts = payload.split('.');
    const [iv, tag, encrypted] = parts.length === 4 && parts[0] === CURRENT_VERSION ? parts.slice(1) : parts;
    if (!iv || !tag || !encrypted) throw new InternalServerErrorException('Stored encrypted value is malformed');
    for (const key of this.readKeys()) {
      try {
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
        decipher.setAuthTag(Buffer.from(tag, 'base64url'));
        return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
      } catch {
        // Wrong generation or tampered payload; try the next accepted key.
      }
    }
    throw new InternalServerErrorException('Stored encrypted value could not be decrypted with any configured key');
  }

  private key(): Buffer {
    return this.derive(process.env.DATA_ENCRYPTION_KEY ?? process.env.SESSION_SECRET ?? 'development-only');
  }

  private readKeys(): Buffer[] {
    const previous = process.env.DATA_ENCRYPTION_KEY_PREVIOUS;
    return previous ? [this.key(), this.derive(previous)] : [this.key()];
  }

  private derive(secret: string): Buffer {
    return createHash('sha256').update(secret).digest();
  }
}
