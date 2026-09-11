import { describe, expect, it } from 'vitest';
import { detectVerificationDocument } from './verification-document.js';

describe('detectVerificationDocument', () => {
  it('accepts a structurally bounded PDF signature', () => expect(detectVerificationDocument(Buffer.from('%PDF-1.7\nbody\n%%EOF'))?.extension).toBe('pdf'));
  it('rejects a PDF prefix without an EOF marker', () => expect(detectVerificationDocument(Buffer.from('%PDF-1.7\nbody'))).toBeNull());
  it('rejects arbitrary executable bytes', () => expect(detectVerificationDocument(Buffer.from('MZ executable'))).toBeNull());
});
