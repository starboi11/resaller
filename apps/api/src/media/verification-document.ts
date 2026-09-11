import { detectSafeImage } from './media-signature.js';

export type VerificationDocumentType = { mimeType: 'application/pdf' | 'image/jpeg' | 'image/png'; extension: 'pdf' | 'jpg' | 'png' };

export function detectVerificationDocument(bytes: Buffer): VerificationDocumentType | null {
  const image = detectSafeImage(bytes);
  if (image?.extension === 'jpg') return { mimeType: 'image/jpeg', extension: 'jpg' };
  if (image?.extension === 'png') return { mimeType: 'image/png', extension: 'png' };
  if (bytes.length >= 8 && bytes.subarray(0, 5).toString('ascii') === '%PDF-' && bytes.includes(Buffer.from('%%EOF'))) return { mimeType: 'application/pdf', extension: 'pdf' };
  return null;
}
