const origin = process.env.LIVE_ORIGIN;
if (!origin) {
  console.error('Set LIVE_ORIGIN to the HTTPS site origin.');
  process.exit(2);
}

const site = new URL(origin);
if (site.protocol !== 'https:' || site.pathname !== '/' || site.search || site.hash || site.username || site.password) {
  console.error('LIVE_ORIGIN must be an HTTPS origin without a path.');
  process.exit(2);
}

const hosts = [site.host, `admin.${site.host}`];
const failures = [];
const get = async (url, options = {}) => {
  try { return await fetch(url, { ...options, signal: AbortSignal.timeout(15_000) }); }
  catch { console.error(`NETWORK ERROR: ${new URL(url).host}${new URL(url).pathname}`); return new Response('', { status: 599 }); }
};
const check = (label, good, detail) => {
  console.log(`${good ? 'PASS' : 'FAIL'} ${label}: ${detail}`);
  if (!good) failures.push(label);
};

for (const host of hosts) {
  const http = await get(`http://${host}/`, { redirect: 'manual' });
  const location = http.headers.get('location');
  check(
    `${host} HTTP redirect`,
    [301, 302, 307, 308].includes(http.status) &&
      Boolean(location?.startsWith(`https://${host}/`)),
    `${http.status} ${location ?? '(no Location)'}`,
  );
  const https = await get(`https://${host}/`, { redirect: 'manual' });
  const expectedStatus = host.startsWith('admin.') ? 404 : 200;
  check(`${host} HTTPS`, https.status === expectedStatus, String(https.status));
  check(
    `${host} HSTS`,
    /max-age=[1-9]\d*/i.test(https.headers.get('strict-transport-security') ?? ''),
    https.headers.get('strict-transport-security') ?? '(missing)',
  );
}

const adminOrigin = `https://admin.${site.host}`;
const owner = await get(`${adminOrigin}/owner`, { redirect: 'manual' });
check('owner entry page', owner.status === 200, String(owner.status));
check(
  'admin noindex',
  /noindex/i.test(owner.headers.get('x-robots-tag') ?? ''),
  owner.headers.get('x-robots-tag') ?? '(missing)',
);

const api = `${site.origin}/api/v1`;
for (const path of ['/categories', '/marketplace/listings']) {
  const response = await get(`${api}${path}`);
  check(`public ${path}`, response.status === 200, String(response.status));
}
for (const path of [
  '/auth/me',
  '/cart',
  '/orders',
  '/seller/stores',
  '/admin/queue',
  '/admin/overview',
  '/admin/listings',
  '/media/private/attachments/test',
  '/media/private/dispute-evidence/test',
  '/media/private/verifications/test/document',
]) {
  const response = await get(`${api}${path}`);
  check(`protected ${path}`, response.status === 401, String(response.status));
}
const readiness = await get(`${api}/health/ready`);
const body = await readiness.json().catch(() => null);
check('API readiness', readiness.status === 200 && body?.status === 'ok', `${readiness.status} ${body?.status ?? '(invalid JSON)'}`);

if (failures.length) {
  console.error(`${failures.length} live smoke check(s) failed.`);
  process.exit(1);
}
