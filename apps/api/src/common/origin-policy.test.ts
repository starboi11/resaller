import { describe, expect, it } from 'vitest';
import { isOriginAllowed } from './origin-policy.js';

describe('origin policy', () => {
  const allowed = ['https://resaller.uz', 'https://admin.resaller.uz'];
  it('allows safe requests without an origin decision', () => expect(isOriginAllowed('GET', 'https://evil.example', allowed)).toBe(true));
  it('allows trusted state-changing browser requests', () => expect(isOriginAllowed('POST', allowed[0], allowed)).toBe(true));
  it('blocks cross-site state-changing browser requests', () => expect(isOriginAllowed('PATCH', 'https://evil.example', allowed)).toBe(false));
  it('blocks state-changing requests that omit Origin', () => expect(isOriginAllowed('POST', undefined, allowed)).toBe(false));
  it('still allows reads that omit Origin', () => expect(isOriginAllowed('GET', undefined, allowed)).toBe(true));
});
