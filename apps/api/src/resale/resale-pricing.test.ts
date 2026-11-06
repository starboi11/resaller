import { describe, expect, it } from 'vitest';
import {
  earningAmount,
  inventoryVariantId,
  isMarkupAllowed,
  marginPerUnit,
  markupWindow,
  resellerUnitPrice,
  wholesaleUnitPrice,
} from './resale-pricing.js';

describe('resale pricing', () => {
  it('adds the markup and rounds up to a whole so‘m', () => {
    expect(resellerUnitPrice(100_000n, 1000)).toBe(110_000n);
    expect(resellerUnitPrice(100_000n, 2500)).toBe(125_000n);
    expect(resellerUnitPrice(99_999n, 1000)).toBe(109_999n); // 109 998.9 -> 109 999
    expect(resellerUnitPrice(1n, 1)).toBe(2n);
    expect(resellerUnitPrice(0n, 2500)).toBe(0n);
  });

  it('never loses precision on large prices', () => {
    const huge = 900_000_000_000n;
    expect(resellerUnitPrice(huge, 1500)).toBe(1_035_000_000_000n);
    expect(marginPerUnit(huge, 1500)).toBe(135_000_000_000n);
  });

  it('rejects invalid markups and negative prices', () => {
    expect(() => resellerUnitPrice(100n, -1)).toThrow(RangeError);
    expect(() => resellerUnitPrice(100n, 10_001)).toThrow(RangeError);
    expect(() => resellerUnitPrice(100n, 12.5)).toThrow(RangeError);
    expect(() => resellerUnitPrice(-1n, 100)).toThrow(RangeError);
  });

  it('uses the 10–25 % default window and respects supplier bounds', () => {
    const defaults = markupWindow({ minMarkupBps: null, maxMarkupBps: null });
    expect(defaults).toEqual({ min: 1000, max: 2500 });
    expect(isMarkupAllowed(999, defaults)).toBe(false);
    expect(isMarkupAllowed(1000, defaults)).toBe(true);
    expect(isMarkupAllowed(2500, defaults)).toBe(true);
    expect(isMarkupAllowed(2501, defaults)).toBe(false);
    expect(isMarkupAllowed(500, markupWindow({ minMarkupBps: 500, maxMarkupBps: 800 }))).toBe(true);
  });

  it('resolves wholesale price and inventory variant like checkout does', () => {
    expect(wholesaleUnitPrice({ priceOverrideMinor: null }, { priceMinor: 50n })).toBe(50n);
    expect(wholesaleUnitPrice({ priceOverrideMinor: 70n }, { priceMinor: 50n })).toBe(70n);
    expect(inventoryVariantId({ id: 'own', sourceVariantId: null })).toBe('own');
    expect(inventoryVariantId({ id: 'resale', sourceVariantId: 'supplier' })).toBe('supplier');
  });

  it('pays coupons from the margin and refuses coupons larger than it', () => {
    expect(earningAmount(30_000n, 10_000n)).toBe(20_000n);
    expect(earningAmount(30_000n, 30_000n)).toBe(0n);
    expect(earningAmount(30_000n, 30_001n)).toBeNull();
  });
});
