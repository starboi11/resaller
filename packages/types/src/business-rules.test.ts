import { describe, expect, it } from 'vitest';
import { ACCOUNT_ROLES, PLATFORM_BUSINESS_RULES } from './index.js';

describe('Phase A business contract', () => {
  it('locks zero commission and deferred settlement', () => {
    expect(PLATFORM_BUSINESS_RULES.commissionBasisPoints).toBe(0);
    expect(PLATFORM_BUSINESS_RULES.paymentCollection).toBe('DEFERRED');
    expect(PLATFORM_BUSINESS_RULES.escrow).toBe('DEFERRED');
    expect(PLATFORM_BUSINESS_RULES.settlement).toBe('DEFERRED');
  });
  it('locks the seller acceptance window', () => expect(PLATFORM_BUSINESS_RULES.sellerAcceptanceMinutes).toBe(60));
  it('keeps privileged roles distinct', () => expect(new Set(ACCOUNT_ROLES).size).toBe(ACCOUNT_ROLES.length));
});
