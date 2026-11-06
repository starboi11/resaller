import { describe, expect, it } from 'vitest';
import { generateAdminPassword } from './admin-account.js';
import { isStrongAdminPassword } from '../auth/auth.service.js';

describe('admin password generator', () => {
  it('always yields 16 mixed characters without look-alikes, all different', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) {
      const password = generateAdminPassword();
      expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]{16}$/);
      expect(isStrongAdminPassword(password)).toBe(true);
      seen.add(password);
    }
    expect(seen.size).toBe(2000);
  });

  it('rejects short or single-class admin passwords', () => {
    for (const weak of ['123456', 'Parol123', 'abcdefghijklmnop', 'ABCDEFGHIJKLMNOP1', 'abcdefghijklmno1'])
      expect(isStrongAdminPassword(weak)).toBe(false);
    expect(isStrongAdminPassword('Ab3defghijklmnop')).toBe(true);
  });
});
