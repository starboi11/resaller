import { describe, expect, it } from 'vitest';
import { couponDiscount } from './coupon-policy.js';

describe('couponDiscount', () => {
  it('calculates fixed discounts without making totals negative', () =>
    expect(
      couponDiscount(
        {
          kind: 'FIXED',
          valueMinor: 500n,
          minimumMinor: null,
          maximumDiscountMinor: null,
        },
        300n,
      ),
    ).toBe(300n));
  it('calculates percentage basis points and respects the cap', () =>
    expect(
      couponDiscount(
        {
          kind: 'PERCENT',
          valueMinor: 2500n,
          minimumMinor: null,
          maximumDiscountMinor: 200n,
        },
        1000n,
      ),
    ).toBe(200n));
  it('does not apply below the minimum', () =>
    expect(
      couponDiscount(
        {
          kind: 'FIXED',
          valueMinor: 100n,
          minimumMinor: 1000n,
          maximumDiscountMinor: null,
        },
        999n,
      ),
    ).toBe(0n));
});
