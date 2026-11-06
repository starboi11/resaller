// Admin production server. It stands in front of Next.js and answers every
// request outside the secret ADMIN_BASE_PATH with a plain 404 before Next sees
// it: Next's own 404 page loads assets from <secret>/_next/… and would reveal
// the secret path to anyone requesting a missing URL (found by fuzzing on
// 2026-11-04). Caddy applies the same rule in front of this server.
import { createServer } from 'node:http';
import next from 'next';
import { fileURLToPath } from 'node:url';

const SECRET = process.env.ADMIN_BASE_PATH?.trim() || '';
const PORT = Number(process.env.PORT ?? 3001);
if (process.env.ADMIN_REQUIRE_BASE_PATH === 'true' && !SECRET) {
  console.error('ADMIN_BASE_PATH is required for the production admin image');
  process.exit(1);
}

const PLAIN_404 =
  '<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>404</title></head><body><main><h1>Sahifa topilmadi</h1></main></body></html>';
const notFound = (res) => {
  res.writeHead(404, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Content-Security-Policy':
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  });
  res.end(PLAIN_404);
};

/** True only for "<secret>/<something>" — never the bare secret root. */
export const insideSecret = (url, secret) => {
  if (!secret) return true;
  const path = (url ?? '/').split('?')[0];
  return path.startsWith(`${secret}/`) && path.length > secret.length + 1;
};

const app = next({
  dev: false,
  dir: fileURLToPath(new URL('.', import.meta.url)),
});
const handle = app.getRequestHandler();
await app.prepare();
createServer((req, res) => {
  if (!insideSecret(req.url, SECRET)) return notFound(res);
  return handle(req, res);
}).listen(PORT, process.env.HOSTNAME ?? '0.0.0.0', () =>
  console.log(`admin listening on ${PORT}`),
);
