import type { NextConfig } from 'next';
const apiOrigin = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
    ).origin;
  } catch {
    return "'self'";
  }
})();
const testEval =
  process.env.NODE_ENV !== 'production' &&
  process.env.E2E_ALLOW_WEBPACK_EVAL === 'true'
    ? " 'unsafe-eval'"
    : '';
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'${testEval}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: ${apiOrigin}; font-src 'self' data:; connect-src 'self' ${apiOrigin}`,
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
];
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@resaller/ui', '@resaller/types'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
export default nextConfig;
