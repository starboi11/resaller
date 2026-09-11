import { describe, expect, it } from 'vitest';
import { PlatformController } from './platform.controller.js';

describe('PlatformController', () => {
  it('keeps payment settlement deferred and exposes all bounded contexts', () => {
    const result = new PlatformController().capabilities();
    expect(result.settlement).toBe('deferred');
    expect(result.sellerAcceptanceMinutes).toBe(60);
    expect(result.modules).toContain('audit');
    expect(result.modules).toContain('orders');
  });
});
