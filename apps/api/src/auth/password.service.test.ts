import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  it('hashes with a unique salt and verifies without storing plaintext', async () => {
    const service = new PasswordService();
    const first = await service.hash('Correct Horse Battery Staple!');
    const second = await service.hash('Correct Horse Battery Staple!');
    expect(first).not.toBe(second);
    expect(first).not.toContain('Correct Horse');
    await expect(service.verify('Correct Horse Battery Staple!', first)).resolves.toBe(true);
    await expect(service.verify('wrong', first)).resolves.toBe(false);
  });
});
