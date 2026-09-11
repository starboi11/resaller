import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { processListingImage } from './image-processor.js';

describe('processListingImage', () => {
  it('normalizes a large upload and generates a square WebP thumbnail', async () => {
    const input = await sharp({
      create: { width: 2200, height: 1100, channels: 3, background: '#1bff9b' },
    })
      .png()
      .toBuffer();
    const result = await processListingImage(input);
    const full = await sharp(result.image).metadata();
    const thumbnail = await sharp(result.thumbnail).metadata();

    expect(result.mimeType).toBe('image/webp');
    expect(full.format).toBe('webp');
    expect(full.width).toBe(1600);
    expect(full.height).toBe(800);
    expect(thumbnail.width).toBe(480);
    expect(thumbnail.height).toBe(480);
  });
});
