import { describe, expect, it } from 'vitest';
import { buyerCanCancelDirectly, canTransitionOrder, sellerAcceptBy } from './order-policy.js';

describe('order policy', () => {
  it('gives the seller exactly 60 minutes', () => {
    const created = new Date('2026-01-01T10:00:00.000Z');
    expect(sellerAcceptBy(created).toISOString()).toBe('2026-01-01T11:00:00.000Z');
  });
  it('prevents invalid lifecycle jumps', () => {
    expect(canTransitionOrder('WAITING_SELLER', 'ACCEPTED')).toBe(true);
    expect(canTransitionOrder('WAITING_SELLER', 'SHIPPED')).toBe(false);
  });
  it('allows direct buyer cancellation only before seller acceptance', () => {
    expect(buyerCanCancelDirectly('WAITING_SELLER')).toBe(true);
    expect(buyerCanCancelDirectly('ACCEPTED')).toBe(false);
  });
});
