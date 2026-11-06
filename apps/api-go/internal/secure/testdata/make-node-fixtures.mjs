// Generates fixtures with Node's crypto, using the exact algorithms of the
// NestJS services, so the Go tests prove byte-level compatibility.
import { createCipheriv, createHash, createHmac, randomBytes, scryptSync } from 'node:crypto';
const b64 = (b) => Buffer.from(b).toString('base64url');
const salt = randomBytes(16);
const key = scryptSync('Resaller-2026', salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const k = (s) => createHash('sha256').update(s).digest();
const gcm = (secret, value) => {
  const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', k(secret), iv);
  const data = Buffer.concat([c.update(value, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map(b64);
};
const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const code = (s, ms) => { /* TotpService.code */
  const B = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits='';
  for (const ch of s) bits += B.indexOf(ch).toString(2).padStart(5,'0');
  const bytes=[]; for (let i=0;i+8<=bits.length;i+=8) bytes.push(parseInt(bits.slice(i,i+8),2));
  const v=Buffer.alloc(8); v.writeBigUInt64BE(BigInt(Math.floor(ms/30000)));
  const d=createHmac('sha1',Buffer.from(bytes)).update(v).digest(); const o=d[d.length-1]&15;
  return ((d.readUInt32BE(o)&0x7fffffff)%1000000).toString().padStart(6,'0');
};
console.log(JSON.stringify({
  passwordHash: `scrypt$32768$8$1$${b64(salt)}$${b64(key)}`,
  endpointV1: ['v1', ...gcm('data-key-0123456789-0123456789-01', '+998901234567')].join('.'),
  endpointLegacy: gcm('data-key-0123456789-0123456789-01', 'legacy@example.uz').join('.'),
  endpointPrevious: ['v1', ...gcm('old-key-0123456789-0123456789-012', 'rotated')].join('.'),
  totpEncrypted: gcm('data-key-0123456789-0123456789-01', secret).join('.'),
  tokenHash: createHash('sha256').update('example-token').digest('base64url'),
  hmac: createHmac('sha256', 'session-secret').update('alice\x00127.0.0.1').digest('base64url'),
  totpSecret: secret, totpAt: 1793000000000, totpCode: code(secret, 1793000000000),
}, null, 2));
