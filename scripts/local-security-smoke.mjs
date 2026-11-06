import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

// This suite creates/removes its own fixture only in an isolated local test DB.
const api = new URL(process.env.SECURITY_TEST_API ?? 'http://127.0.0.1:4100/api/v1/');
const database = new URL(process.env.DATABASE_URL ?? '');
if (!['127.0.0.1', 'localhost'].includes(api.hostname) || !['127.0.0.1', 'localhost'].includes(database.hostname) || !database.pathname.endsWith('_e2e'))
  throw new Error('This suite requires a loopback API and an isolated local *_e2e database');
const db = new pg.Client({ connectionString: database.toString() });
await db.connect();
const username = `security_${randomBytes(7).toString('hex')}`;
const password = `Audit-${randomBytes(16).toString('hex')}A1`;
const request = (path, options = {}) => fetch(new URL(path, api), { ...options, signal: AbortSignal.timeout(20_000) });
const json = (body, headers = {}) => ({ method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
let checks = 0;
const pass = (message) => { checks += 1; console.log(`PASS ${message}`); };
try {
  let response = await request('auth/register', json({ username, password, roles: ['SUPER_ADMIN'] }));
  assert.equal(response.status, 400);
  pass('role injection rejected');
  response = await request('auth/register', json({ username, password }, { origin: 'https://untrusted.example' }));
  assert.equal(response.status, 403);
  pass('cross-origin mutation rejected');
  response = await request('auth/login', json({ username: "' OR 1=1 --", password }));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('set-cookie'), null);
  pass('SQL-shaped login cannot authenticate');
  response = await request('auth/register', json({ username, password }));
  assert.equal(response.status, 201);
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  const cookie = setCookie.split(';')[0];
  pass('login session uses HttpOnly and SameSite cookie');
  response = await request('admin/overview', { headers: { cookie } });
  assert.equal(response.status, 403);
  pass('buyer cannot access owner API');
  const form = new FormData();
  form.append('file', new Blob(['X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'], { type: 'image/png' }), 'scanner-test.png');
  response = await request('media/listings/isolated-security-fixture/images', { method: 'POST', headers: { cookie }, body: form });
  // A clean file with this nonexistent listing returns 404; 415 proves that
  // the actual upload pipeline rejected the antivirus test before persistence.
  assert.equal(response.status, 415);
  pass('ClamAV blocks EICAR through actual upload endpoint');
  response = await request('auth/logout', { method: 'POST', headers: { cookie } });
  assert.equal(response.status, 204);
  response = await request('auth/me', { headers: { cookie } });
  assert.equal(response.status, 401);
  pass('logout revokes the server-side session');
  console.log(`${checks} local security checks passed. This is not a full penetration test.`);
} finally {
  await db.query('DELETE FROM "User" WHERE username=$1', [username]);
  await db.end();
}
