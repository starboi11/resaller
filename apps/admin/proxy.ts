import { NextResponse, type NextRequest } from 'next/server';

// Every "not here" answer is this plain page: no stylesheet, no script, no
// link. Next's own 404 page would load assets from <secret path>/_next/… and so
// reveal the secret admin path to anyone who requests a missing URL.
const PLAIN_404 = '<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>404</title></head><body><main><h1>Sahifa topilmadi</h1></main></body></html>';

function notFound() {
  return new NextResponse(PLAIN_404, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}

const SECRET = process.env.ADMIN_BASE_PATH?.trim() || '';

export function proxy(request: NextRequest) {
  // Outside the secret path, or the bare secret root: answer the plain 404.
  if (SECRET && request.nextUrl.basePath !== SECRET) return notFound();
  if (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '') return notFound();
  return NextResponse.next();
}

export const config = { matcher: '/:path*' };
