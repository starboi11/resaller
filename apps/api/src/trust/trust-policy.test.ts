import { describe, expect, it } from 'vitest';
import { calculateTrust } from './trust-policy.js';

describe('trust policy', () => {
  it('never grants a badge before identity verification', () =>
    expect(
      calculateTrust({
        verified: false,
        completed: 100,
        cancelled: 0,
        timedOut: 0,
        disputes: 0,
      }).badge,
    ).toBe('NEW'));
  it('earns badges only from operational history', () => {
    expect(
      calculateTrust({
        verified: true,
        completed: 10,
        cancelled: 1,
        timedOut: 0,
        disputes: 0,
      }).badge,
    ).toBe('TRUSTED');
    expect(
      calculateTrust({
        verified: true,
        completed: 50,
        cancelled: 1,
        timedOut: 0,
        disputes: 0,
      }).badge,
    ).toBe('TOP_SELLER');
  });
  it('marks elevated timeout patterns as a review signal', () =>
    expect(
      calculateTrust({
        verified: true,
        completed: 3,
        cancelled: 0,
        timedOut: 2,
        disputes: 0,
      }).timeoutRisk,
    ).toBe(true));
});
