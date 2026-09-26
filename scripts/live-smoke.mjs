const origin = process.env.LIVE_ORIGIN;
if (!origin) {
  console.error('Set LIVE_ORIGIN to the HTTPS site origin.');
  process.exit(2);
}

const site = new URL(origin);
if (site.protocol !== 'https:' || site.pathname !== '/') {
  console.error('LIVE_ORIGIN must be an HTTPS origin without a path.');
  process.exit(2);
}

const hosts = [site.host, `admin.${site.host}`];
const failures = [];
const check = (label, good, detail) => {
  console.log(`${good ? 'PASS' : 'FAIL'} ${label}: ${detail}`);
  if (!good) failures.push(label);
};

for (const host of hosts) {
  const http = await fetch(`http://${host}/`, { redirect: 'manual' });
  const location = http.headers.get('location');
  check(
    `${host} HTTP redirect`,
    [301, 302, 307, 308].includes(http.status) &&
      Boolean(location?.startsWith(`https://${host}/`)),
    `${http.status} ${location ?? '(no Location)'}`,
  );
  const https = await fetch(`https://${host}/`, { redirect: 'manual' });
  check(`${host} HTTPS`, https.ok, String(https.status));
  check(
    `${host} HSTS`,
    /max-age=\d+/.test(https.headers.get('strict-transport-security') ?? ''),
    https.headers.get('strict-transport-security') ?? '(missing)',
  );
}

const api = `${site.origin}/api/v1`;
for (const path of ['/categories', '/marketplace/listings']) {
  const response = await fetch(`${api}${path}`);
  check(`public ${path}`, response.status === 200, String(response.status));
}
for (const path of [
  '/auth/me',
  '/cart',
  '/orders',
  '/seller/stores',
  '/admin/queue',
  '/media/private/attachments/test',
  '/media/private/dispute-evidence/test',
  '/media/private/verifications/test/document',
]) {
  const response = await fetch(`${api}${path}`);
  check(`protected ${path}`, response.status === 401, String(response.status));
}
const readiness = await fetch(`${api}/health/ready`);
const body = await readiness.json().catch(() => null);
check('API readiness', readiness.status === 200 && body?.status === 'ok', `${readiness.status} ${body?.status ?? '(invalid JSON)'}`);

if (failures.length) {
  console.error(`${failures.length} live smoke check(s) failed.`);
  process.exit(1);
}
