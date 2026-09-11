import { describe, expect, it } from 'vitest';
import { TotpService } from './totp.service.js';

describe('TotpService', () => {
  const service = new TotpService();

  it('validates the RFC 6238 SHA-1 vector truncated to six digits', () => {
    expect(service.verify('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59_000)).toBe(true);
    expect(service.verify('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287083', 59_000)).toBe(false);
  });

  it('encrypts secrets with authenticated encryption', () => {
    const secret = service.generateSecret();
    const encrypted = service.encrypt(secret);
    expect(encrypted).not.toContain(secret);
    expect(service.decrypt(encrypted)).toBe(secret);
  });
});
