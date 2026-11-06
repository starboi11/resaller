import { describe, expect, it } from 'vitest';
import { EndpointCryptoService } from './endpoint-crypto.service.js';

describe('EndpointCryptoService', () => {
  it('encrypts endpoint values with randomized authenticated encryption', () => {
    const crypto = new EndpointCryptoService();
    const first = crypto.encrypt('target@example.com');
    const second = crypto.encrypt('target@example.com');
    expect(first).not.toBe(second);
    expect(first).not.toContain('target@example.com');
    expect(crypto.decrypt(first)).toBe('target@example.com');
    expect(crypto.hash('target@example.com')).toBe(crypto.hash('target@example.com'));
  });

  it('tags ciphertext with the key generation so the key can be rotated', () => {
    const crypto = new EndpointCryptoService();
    expect(crypto.encrypt('+998901234567').startsWith('v1.')).toBe(true);
  });

  it('reads rows written before the version prefix existed', () => {
    const crypto = new EndpointCryptoService();
    const legacy = crypto.encrypt('+998901234567').split('.').slice(1).join('.');
    expect(crypto.decrypt(legacy)).toBe('+998901234567');
  });

  it('decrypts with the previous key while a rotation is in progress', () => {
    const originalKey = process.env.DATA_ENCRYPTION_KEY;
    try {
      process.env.DATA_ENCRYPTION_KEY = 'rotation-test-old-key-at-least-32-characters';
      const written = new EndpointCryptoService().encrypt('Chilonzor 1');
      process.env.DATA_ENCRYPTION_KEY = 'rotation-test-new-key-at-least-32-characters';
      process.env.DATA_ENCRYPTION_KEY_PREVIOUS = 'rotation-test-old-key-at-least-32-characters';
      expect(new EndpointCryptoService().decrypt(written)).toBe('Chilonzor 1');
      delete process.env.DATA_ENCRYPTION_KEY_PREVIOUS;
      expect(() => new EndpointCryptoService().decrypt(written)).toThrow();
    } finally {
      delete process.env.DATA_ENCRYPTION_KEY_PREVIOUS;
      if (originalKey === undefined) delete process.env.DATA_ENCRYPTION_KEY;
      else process.env.DATA_ENCRYPTION_KEY = originalKey;
    }
  });

  it('rejects a tampered payload instead of returning partial plaintext', () => {
    const crypto = new EndpointCryptoService();
    const [version, iv, tag] = crypto.encrypt('+998901234567').split('.');
    expect(() => crypto.decrypt(`${version}.${iv}.${tag}.${Buffer.from('tampered').toString('base64url')}`)).toThrow();
  });
});
