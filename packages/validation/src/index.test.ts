import { describe, expect, it } from 'vitest';
import { moneyMinorSchema, passwordSchema, usernameSchema } from './index.js';

describe('shared validation', () => {
  it('accepts integer minor money units only', () => {
    expect(moneyMinorSchema.safeParse(125_000).success).toBe(true);
    expect(moneyMinorSchema.safeParse(12.5).success).toBe(false);
  });
  it('normalizes the public username boundary', () => {
    expect(usernameSchema.safeParse('resaller_uz').success).toBe(true);
    expect(usernameSchema.safeParse('Bad Name').success).toBe(false);
  });
  it('requires a strong baseline password', () => {
    expect(passwordSchema.safeParse('LongEnoughPassword1').success).toBe(true);
    expect(passwordSchema.safeParse('Abcd12').success).toBe(true);
    expect(passwordSchema.safeParse('Abc12').success).toBe(false);
    expect(passwordSchema.safeParse('alllowercaseonly').success).toBe(false);
  });
});
