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
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
];
// Secret admin path (owner decision 2026-11-04). The admin app is served only
// under ADMIN_BASE_PATH, a random value from scripts/generate-admin-path.mjs, so
// the panel cannot be found by guessing or fuzzing common paths. It is fixed at
// build time; production builds refuse to run without a valid one. This hides
// the page only: every admin action is still authorised by the API.
const adminBasePath = (() => {
  const value = process.env.ADMIN_BASE_PATH?.trim();
  if (!value) {
    // The production image (Dockerfile.admin) sets ADMIN_REQUIRE_BASE_PATH, so
    // it can neither be built NOR started without a secret path (`next start`
    // reads this file again; without the path the panel would sit at /owner).
    // Local and CI builds can run without it.
    if (process.env.ADMIN_REQUIRE_BASE_PATH === 'true')
      throw new Error('ADMIN_BASE_PATH is required for the production admin image (node scripts/generate-admin-path.mjs)');
    return undefined;
  }
  if (!/^\/[A-Za-z0-9_-]{24,64}$/.test(value))
    throw new Error('ADMIN_BASE_PATH must be "/" followed by 24-64 random URL-safe characters');
  return value;
})();

const nextConfig: NextConfig = {
  ...(adminBasePath ? { basePath: adminBasePath } : {}),
  reactStrictMode: true,
  transpilePackages: ['@resaller/ui'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
export default nextConfig;
