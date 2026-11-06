// Runs identical scenarios against the NestJS API and the Go API on the same
// database and compares status codes, JSON bodies and security headers.
// Volatile values (ids, timestamps, tokens) are masked before comparison.
// Usage: node parity.mjs http://127.0.0.1:4000 http://127.0.0.1:4100
import { createHmac } from 'node:crypto';
const [NODE, GO] = process.argv.slice(2);
const ORIGIN = 'http://localhost:3000';
const RUN = process.env.RUN_TAG ?? Date.now().toString(36).slice(-5);

async function call(base, method, path, { body, cookie, origin = true, raw, xff } = {}) {
  const headers = {};
  if (xff) headers['x-forwarded-for'] = xff;
  if (origin) headers.origin = ORIGIN;
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(base + '/api/v1' + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, json, headers: res.headers, cookie: setCookie ? setCookie.split(';')[0] : null, setCookie };
}

// A unique, valid Uzbek mobile number per name, written in a "human" format
// so the server's normalisation is exercised too.
let phoneSeq = 0;
const phoneFor = (name) => {
  let h = 7; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 9_000_000;
  const n = String(1_000_000 + ((h + phoneSeq++ * 7919) % 9_000_000)).slice(-7);
  return `+998 90 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5)}`;
};
const profile = (name) => ({ fullName: '  Ali   Valiyev ', phone: phoneFor(name) });

const mask = (value, tag) => JSON.parse(JSON.stringify(value ?? null)
  .replaceAll(tag, '<tag>')
  .replace(/"req-[0-9a-z]+"/g, '"<req>"')
  .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g, '<date>')
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>')
  .replace(/"c[0-9a-z]{20,30}"/g, '"<cuid>"')
  .replace(/"(challengeToken|secret)":"[^"]+"/g, '"$1":"<token>"')
  .replace(/"phone":"(\+998\d{8})\d"/g, '"phone":"$1#"')
  .replace(/secret=[A-Z2-7]+/g, 'secret=<secret>'));

function totp(secret, ms = Date.now()) {
  const B = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const ch of secret) bits += B.indexOf(ch).toString(2).padStart(5, '0');
  const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const v = Buffer.alloc(8); v.writeBigUInt64BE(BigInt(Math.floor(ms / 30000)));
  const d = createHmac('sha1', Buffer.from(bytes)).update(v).digest(); const o = d[d.length - 1] & 15;
  return ((d.readUInt32BE(o) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}

// Each scenario receives (base, tag) and returns comparable steps.
const scenarios = {
  'health': async (b) => [mask((await call(b, 'GET', '/health')).json)],
  'health ready': async (b) => { const r = await call(b, 'GET', '/health/ready'); return [r.status, mask(r.json)]; },
  'unknown route 404': async (b) => { const r = await call(b, 'GET', '/no-such-route?x=1'); return [r.status, mask(r.json)]; },
  'login without Origin is blocked': async (b) => { const r = await call(b, 'POST', '/auth/login', { body: { username: 'a', password: 'b' }, origin: false }); return [r.status, mask(r.json)]; },
  'security headers': async (b) => { const h = (await call(b, 'GET', '/health')).headers;
    return ['content-security-policy', 'cross-origin-opener-policy', 'cross-origin-resource-policy', 'origin-agent-cluster', 'referrer-policy',
      'strict-transport-security', 'x-content-type-options', 'x-dns-prefetch-control', 'x-download-options', 'x-frame-options',
      'x-permitted-cross-domain-policies', 'x-xss-protection'].map((k) => `${k}: ${h.get(k)}`); },
  'CORS for allowed origin': async (b) => { const h = (await call(b, 'GET', '/health')).headers; return [h.get('access-control-allow-origin'), h.get('access-control-allow-credentials')]; },
  'register → me → sessions → rotate → logout': async (b, tag) => {
    const name = `p_${tag}_${RUN}`;
    const reg = await call(b, 'POST', '/auth/register', { body: { ...profile(name), username: `  ${name.toUpperCase()} `, password: 'Parol123' } });
    const me = await call(b, 'GET', '/auth/me', { cookie: reg.cookie });
    const sessions = await call(b, 'GET', '/auth/sessions', { cookie: reg.cookie });
    const rotate = await call(b, 'POST', '/auth/session/rotate', { cookie: reg.cookie });
    const oldAfterRotate = await call(b, 'GET', '/auth/me', { cookie: reg.cookie });
    const logout = await call(b, 'POST', '/auth/logout', { cookie: rotate.cookie });
    const afterLogout = await call(b, 'GET', '/auth/me', { cookie: rotate.cookie });
    return [reg.status, mask(reg.json, tag), /HttpOnly/i.test(reg.setCookie ?? '') && /SameSite=Lax/i.test(reg.setCookie ?? '') && /Path=\//.test(reg.setCookie ?? ''),
      me.status, mask(me.json, tag), sessions.status, mask(sessions.json, tag), rotate.status, mask(rotate.json, tag),
      oldAfterRotate.status, logout.status, logout.json, afterLogout.status, mask(afterLogout.json, tag)];
  },
  'duplicate username': async (b, tag) => { const r = await call(b, 'POST', '/auth/register', { body: { ...profile(`dup_${tag}`), username: `p_${tag}_${RUN}`, password: 'Parol123' } }); return [r.status, mask(r.json, tag)]; },
  'register: 6-digit password, phone normalised, profile': async (b, tag) => {
    const name = `six_${tag}_${RUN}`;
    // Unique per run and per backend; the last digit is masked when comparing.
    const middle = String(parseInt(RUN, 36) % 1_000_000).padStart(6, '0');
    const digit = tag === 'nq7' ? '8' : '9';
    const reg = await call(b, 'POST', '/auth/register', { body: { fullName: 'Dilnoza  Karimova', phone: `(91) ${middle.slice(0, 3)}-${middle.slice(3, 5)}-${middle.slice(5)}${digit}`, username: name, password: '123456' } });
    const prof = await call(b, 'GET', '/auth/profile', { cookie: reg.cookie });
    const login = await call(b, 'POST', '/auth/login', { body: { username: name, password: '123456' } });
    // The phone is unique per account across the whole database.
    const again = await call(b, 'POST', '/auth/register', { body: { fullName: 'Boshqa Odam', phone: `+998 91 ${middle.slice(0, 3)} ${middle.slice(3, 5)} ${middle.slice(5)}${digit}`, username: `${name}_2`, password: '654321' } });
    return [reg.status, prof.status, mask(prof.json, tag), login.status, again.status, mask(again.json)];
  },
  'register: bad name, phone and short password': async (b) => {
    const r = await call(b, 'POST', '/auth/register', { body: { fullName: 'A1', phone: '12345', username: 'ok_name', password: '123' } });
    return [r.status, mask(r.json)];
  },
  'change password': async (b, tag) => {
    const name = `chg_${tag}_${RUN}`;
    const first = await call(b, 'POST', '/auth/register', { body: { ...profile(name), username: name, password: 'Eski123' } });
    const second = await call(b, 'POST', '/auth/login', { body: { username: name, password: 'Eski123' } });
    const wrong = await call(b, 'POST', '/auth/password/change', { cookie: first.cookie, body: { currentPassword: 'xato12', newPassword: '777777' } });
    const short = await call(b, 'POST', '/auth/password/change', { cookie: first.cookie, body: { currentPassword: 'Eski123', newPassword: '12' } });
    const ok = await call(b, 'POST', '/auth/password/change', { cookie: first.cookie, body: { currentPassword: 'Eski123', newPassword: '777777' } });
    const keptHere = await call(b, 'GET', '/auth/me', { cookie: first.cookie });
    const otherDevice = await call(b, 'GET', '/auth/me', { cookie: second.cookie });
    const oldPassword = await call(b, 'POST', '/auth/login', { body: { username: name, password: 'Eski123' } });
    const newPassword = await call(b, 'POST', '/auth/login', { body: { username: name, password: '777777' } });
    return [wrong.status, mask(wrong.json), short.status, mask(short.json), ok.status, ok.json, keptHere.status, otherDevice.status, oldPassword.status, newPassword.status];
  },
  'register validation': async (b) => { const r = await call(b, 'POST', '/auth/register', { body: { username: 'ab', password: 'weak' } }); return [r.status, mask(r.json)]; },
  'register with no fields': async (b) => { const r = await call(b, 'POST', '/auth/register', { body: {} }); return [r.status, mask(r.json)]; },
  'login with wrong types': async (b) => { const r = await call(b, 'POST', '/auth/login', { body: { username: 'x'.repeat(31), password: 'y' } }); return [r.status, mask(r.json)]; },
  '2FA malformed input': async (b) => { const r = await call(b, 'POST', '/auth/2fa/verify', { body: { challengeToken: 'short', code: '12ab' } }); return [r.status, mask(r.json)]; },
  'reset weak password': async (b) => { const r = await call(b, 'POST', '/auth/password/reset', { body: { token: 'x'.repeat(40), newPassword: 'abc' } }); return [r.status, mask(r.json)]; },
  // Security review 2026-11-03 (F1, F3): the client-supplied left-most hop
  // must not key limits; only the address our proxy appended (right-most) does.
  'spoofed X-Forwarded-For cannot dodge the register limit': async (b, tag) => {
    const real = tag === 'nq7' ? '198.51.100.11' : '198.51.100.22';
    const codes = [];
    for (let i = 0; i < 11; i += 1) {
      const r = await call(b, 'POST', '/auth/register', { xff: `10.9.${i}.1, ${real}`, body: { ...profile(`sp_${tag}_${i}`), username: `sp_${tag}_${RUN}_${i}`, password: 'Parol123' } });
      codes.push(r.status);
      if (i === 10) codes.push(mask(r.json));
    }
    return codes;
  },
  'account limit holds across rotating addresses': async (b, tag) => {
    const name = `p_${tag}_${RUN}`;
    const codes = [];
    for (let i = 0; i < 30; i += 1) codes.push((await call(b, 'POST', '/auth/login', { xff: `203.0.${tag === 'nq7' ? 1 : 2}.${i}`, body: { username: `lk_${tag}_${RUN}`, password: 'Wrong123' } })).status);
    const blocked = await call(b, 'POST', '/auth/login', { xff: '192.0.2.200', body: { username: `lk_${tag}_${RUN}`, password: 'Parol123' } });
    return [codes.every((c) => c === 401), blocked.status, mask(blocked.json)];
  },
  'password reset flood is absorbed silently': async (b, tag) => {
    const codes = [];
    for (let i = 0; i < 5; i += 1) codes.push((await call(b, 'POST', '/auth/password/request-reset', { xff: `198.18.${tag === 'nq7' ? 1 : 2}.${i}`, body: { username: `lk_${tag}_${RUN}` } })).status);
    return codes;
  },
  'register unknown property': async (b) => { const r = await call(b, 'POST', '/auth/register', { body: { username: 'abc_def', password: 'Parol123', role: 'SUPER_ADMIN' } }); return [r.status, mask(r.json)]; },
  'login wrong password': async (b, tag) => { const r = await call(b, 'POST', '/auth/login', { body: { username: `p_${tag}_${RUN}`, password: 'Wrong123' } }); return [r.status, mask(r.json, tag)]; },
  'login unknown user': async (b) => { const r = await call(b, 'POST', '/auth/login', { body: { username: 'nobody_here', password: 'Wrong123' } }); return [r.status, mask(r.json)]; },
  'login ok → revoke others': async (b, tag) => {
    const a = await call(b, 'POST', '/auth/login', { body: { username: `p_${tag}_${RUN}`, password: 'Parol123' } });
    const c = await call(b, 'POST', '/auth/login', { body: { username: `p_${tag}_${RUN}`, password: 'Parol123' } });
    const revoke = await call(b, 'POST', '/auth/sessions/revoke-others', { cookie: c.cookie });
    const firstNow = await call(b, 'GET', '/auth/me', { cookie: a.cookie });
    const bad = await call(b, 'DELETE', '/auth/sessions/00000000-0000-4000-8000-000000000000', { cookie: c.cookie });
    return [a.status, mask(a.json, tag), revoke.status, revoke.json, firstNow.status, bad.status, mask(bad.json)];
  },
  'me without cookie': async (b) => { const r = await call(b, 'GET', '/auth/me'); return [r.status, mask(r.json)]; },
  'password reset request': async (b, tag) => { const r = await call(b, 'POST', '/auth/password/request-reset', { body: { username: `p_${tag}_${RUN}` } });
    const u = await call(b, 'POST', '/auth/password/request-reset', { body: { username: 'nobody_here' } }); return [r.status, r.json, u.status, u.json]; },
  'password reset bad token': async (b) => { const r = await call(b, 'POST', '/auth/password/reset', { body: { token: 'x'.repeat(40), newPassword: 'Parol123' } }); return [r.status, mask(r.json)]; },
  'admin 2FA enrol → verify → me': async (b, tag) => {
    const login = await call(b, 'POST', '/auth/login', { body: { username: `adm_${tag}_${RUN}`, password: 'Parol123' } });
    const tf = login.json?.twoFactor;
    const wrong = await call(b, 'POST', '/auth/2fa/verify', { body: { challengeToken: tf?.challengeToken, code: '000000' } });
    const ok = await call(b, 'POST', '/auth/2fa/verify', { body: { challengeToken: tf?.challengeToken, code: totp(tf?.secret ?? 'A') } });
    const me = await call(b, 'GET', '/auth/me', { cookie: ok.cookie });
    const second = await call(b, 'POST', '/auth/login', { body: { username: `adm_${tag}_${RUN}`, password: 'Parol123' } });
    // With ADMIN_TWO_FACTOR_REQUIRED=false the login itself returns the session.
    const adminCookie = ok.cookie ?? login.cookie;
    const sessions = await call(b, 'GET', '/auth/sessions', { cookie: adminCookie });
    const hours = sessions.json?.[0] ? Math.round((Date.parse(sessions.json[0].expiresAt) - Date.now()) / 3_600_000) : null;
    const weak = await call(b, 'POST', '/auth/password/change', { cookie: adminCookie, body: { currentPassword: 'Parol123', newPassword: '123456' } });
    return [login.status, mask(login.json, tag), wrong.status, mask(wrong.json), ok.status, mask(ok.json, tag), me.status, mask(me.json, tag),
      second.json?.twoFactor?.mode, 'secret' in (second.json?.twoFactor ?? {}), `admin session ~${hours}h`, weak.status, mask(weak.json)];
  },
};

const results = [];
const nodeResults = {};
for (const [name, run] of Object.entries(scenarios)) {
  const [n, g] = [await run(NODE, 'nq7'), await run(GO, 'gq7')];
  nodeResults[name] = n;
  const same = JSON.stringify(n) === JSON.stringify(g);
  results.push(same);
  console.log(`${same ? 'PASS' : 'DIFF'}  ${name}`);
  if (!same) { console.log('   node:', JSON.stringify(n)); console.log('   go:  ', JSON.stringify(g)); }
}

// Interoperability: a session issued by one backend must work on the other.
const cross = [];
for (const [from, to, tag] of [[NODE, GO, 'nq7'], [GO, NODE, 'gq7']]) {
  const login = await call(from, 'POST', '/auth/login', { body: { username: `p_${tag}_${RUN}`, password: 'Parol123' } });
  const me = await call(to, 'GET', '/auth/me', { cookie: login.cookie });
  cross.push(me.status === 200 && me.json?.user?.username === `p_${tag}_${RUN}`);
}
const adminCross = await call(NODE, 'POST', '/auth/login', { body: { username: `adm_gq7_${RUN}`, password: 'Parol123' } });
const twoFactorOn = process.env.ADMIN_TWO_FACTOR_REQUIRED !== 'false';
const adminCrossOk = twoFactorOn ? adminCross.json?.twoFactor?.mode === 'VERIFY' : adminCross.status === 200 && !adminCross.json?.twoFactor && Boolean(adminCross.cookie);
console.log(`${cross.every(Boolean) ? 'PASS' : 'FAIL'}  sessions issued by Node work on Go and vice versa`);
console.log(`${adminCrossOk ? 'PASS' : 'FAIL'}  ${twoFactorOn ? 'TOTP enrolled through Go is recognised by Node' : 'admin signs in with password only (2FA off) on both'}`);

// "Identical" is not "correct": absolute expectations for the new rules.
const admin = nodeResults['admin 2FA enrol → verify → me'];
const six = nodeResults['register: 6-digit password, phone normalised, profile'];
const change = nodeResults['change password'];
const expectations = [
  ['admin session lasts about 12 hours', admin?.includes('admin session ~12h')],
  ['weak admin password is refused (400)', admin?.[admin.length - 2] === 400],
  ['6-digit customer password accepted, phone normalised to +998…', six?.[0] === 201 && six?.[3] === 200
    && six?.[2]?.phone === `+99891${String(parseInt(RUN, 36) % 1_000_000).padStart(6, '0')}#` && six?.[2]?.fullName === 'Dilnoza Karimova'],
  ['same phone cannot open a second account (409)', six?.[4] === 409],
  ['password change: wrong current 400, ok 200, this device kept, others signed out', change?.[0] === 400 && change?.[4] === 200 && change?.[6] === 200 && change?.[7] === 401 && change?.[8] === 401 && change?.[9] === 200],
];
for (const [label, passed] of expectations) console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}`);
const ok = results.every(Boolean) && cross.every(Boolean) && adminCrossOk && expectations.every(([, passed]) => passed);
console.log(`\n${results.filter(Boolean).length}/${results.length} scenarios identical; interoperability ${cross.every(Boolean) ? 'OK' : 'FAILED'}`);
process.exit(ok ? 0 : 1);
