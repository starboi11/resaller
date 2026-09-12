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
});
