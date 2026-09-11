import { describe, expect, it } from 'vitest';
import { detectSafeImage } from './media-signature.js';

describe('detectSafeImage', () => {
  it('detects JPEG by bytes, not filename', () =>
    expect(
      detectSafeImage(Buffer.from([0xff, 0xd8, 0xff, 0x00]))?.mimeType,
    ).toBe('image/jpeg'));
  it('detects PNG signature', () =>
    expect(
      detectSafeImage(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )?.mimeType,
    ).toBe('image/png'));
  it('rejects executable or unknown bytes', () =>
    expect(detectSafeImage(Buffer.from('MZ executable'))).toBeNull());
});
