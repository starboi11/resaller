// Browser checks for the 2026-11-04 account/admin changes. Desktop 1280px and
// phone 360px. Needs a running stack (see README.md). The admin password is
// read from ADMIN_PASSWORD_FILE and never printed.
import { readFileSync } from 'node:fs';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const WEB = 'http://localhost:3000';
const ADMIN = 'http://localhost:3001';
const SECRET = readFileSync(process.env.ADMIN_SECRET_FILE, 'utf8').trim();
const ADMIN_PASSWORD = readFileSync(process.env.ADMIN_PASSWORD_FILE, 'utf8').trim();
const OUT = process.env.SHOTS_DIR ?? './shots';
const RUN = Date.now().toString(36).slice(-5);
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? ' — ' + detail : ''}`); };
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true,
  args: [...chromium.args.filter((a) => !['--single-process', '--disable-web-security', '--disable-site-isolation-trials'].includes(a)), '--host-resolver-rules=MAP localhost 127.0.0.1'] });
const viewports = { desktop: { width: 1280, height: 900 }, mobile: { width: 360, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (page) => page.evaluate(() => document.body.innerText);
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const [vp, viewport] of Object.entries(viewports)) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // The site uses smooth scrolling; Puppeteer clicks before a smooth scroll
  // finishes and would hit the fixed bottom nav. Real taps are unaffected
  // (verified with a touch swipe: the submit button sits above the nav).
  await page.evaluateOnNewDocument(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.scrollBehavior = 'auto'; }));
  // Login page: username + password only
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle0' });
  const loginInputs = await page.$$eval('main form input', (els) => els.map((e) => e.name));
  check(`[${vp}] login asks only username and password`, JSON.stringify(loginInputs) === '["username","password"]', JSON.stringify(loginInputs));
  await shot(page, `${vp}-1-login`);
  // Register: name, phone, username, password (6 digits)
  await page.evaluate(() => [...document.querySelectorAll('main form button')].find((b) => b.textContent.includes('Yangi hisob'))?.click());
  await wait(300);
  const registerInputs = await page.$$eval('main form input', (els) => els.map((e) => e.name));
  check(`[${vp}] register asks name, phone, username, password`, JSON.stringify(registerInputs) === '["fullName","phone","username","password"]', JSON.stringify(registerInputs));
  await shot(page, `${vp}-2-register`);
  const username = `mijoz_${vp.slice(0, 1)}_${RUN}`;
  const phone = `90 ${vp === 'desktop' ? '1' : '2'}${RUN.length}${String(parseInt(RUN, 36) % 100000).padStart(5, '0').slice(0, 1)} ${String(parseInt(RUN, 36) % 100).padStart(2, '0')} ${vp === 'desktop' ? '11' : '22'}`;
  await page.type('input[name="fullName"]', 'Aziza Rahimova');
  await page.type('input[name="phone"]', phone);
  await page.type('input[name="username"]', username);
  await page.type('input[name="password"]', '123456');
  // Bring the button to the middle of the screen first, as a person scrolls
  // it into view; Puppeteer would otherwise tap the very bottom edge, which is
  // under the fixed bottom navigation.
  await page.$eval('main form button.rs-button', (el) => el.scrollIntoView({ block: 'center' }));
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}), page.click('main form button.rs-button')]);
  await wait(600);
  check(`[${vp}] registration with a 6-digit password signs in`, page.url().includes('/marketplace'), page.url());
  if (vp === 'mobile') {
    // Real-finger check: after a swipe the submit button is tappable, not under the nav.
    const probe = await context.newPage();
    await probe.setViewport(viewport);
    await probe.goto(`${WEB}/login`, { waitUntil: 'networkidle0' });
    await probe.evaluate(() => [...document.querySelectorAll('main form button')].find((b) => b.textContent.includes('Yangi hisob'))?.click());
    await wait(300);
    await probe.touchscreen.touchStart(180, 600); await probe.touchscreen.touchMove(180, 200); await probe.touchscreen.touchEnd(); await wait(700);
    const tappable = await probe.evaluate(() => { const r = document.querySelector('main form button.rs-button').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('button')?.textContent?.trim(); });
    check(`[${vp}] after a swipe the "Hisob yaratish" button is tappable above the bottom nav`, tappable === 'Hisob yaratish', String(tappable));
    await probe.close();
  }
  // Account page
  await page.goto(`${WEB}/account`, { waitUntil: 'networkidle0' });
  await wait(500);
  const account = await text(page);
  check(`[${vp}] account shows name, formatted phone and username`, account.includes('Aziza Rahimova') && /\+998 90 \d{3} \d{2} \d{2}/.test(account) && account.includes(`@${username}`));
  check(`[${vp}] account is simple: no channel form, devices folded`, !/Kanal qo‘shish|Email, Telegram va push/.test(account) && account.includes('Faol qurilmalar') && account.includes('Parolni o‘zgartirish'));
  check(`[${vp}] account page fits 360px width`, (await overflow(page)) <= 1, `${await overflow(page)}px`);
  await shot(page, `${vp}-3-account`);
  // Checkout prefill: put one owner product in the cart through the API
  await page.evaluate(async () => {
    const api = 'http://localhost:4000/api/v1';
    const list = await (await fetch(`${api}/marketplace/listings`, { credentials: 'include' })).json();
    const item = list.items.find((i) => i.variants?.some((v) => (v.inventory?.available ?? 0) > 0));
    const detail = await (await fetch(`${api}/marketplace/listings/${item.publicId}`, { credentials: 'include' })).json();
    const variant = detail.variants.find((v) => (v.inventory?.available ?? 0) > 0);
    await fetch(`${api}/cart/items`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ listingPublicId: item.publicId, variantId: variant.id, quantity: 1 }) });
  });
  await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle0' });
  await wait(800);
  const prefill = await page.evaluate(() => ({ name: document.querySelector('input[name="fullName"]')?.value, phone: document.querySelector('input[name="phone"]')?.value }));
  check(`[${vp}] checkout prefills name and phone from the account`, prefill.name === 'Aziza Rahimova' && /^\+99890\d{7}$/.test(prefill.phone ?? ''), JSON.stringify(prefill));
  await page.evaluate(() => document.querySelector('input[name="phone"]')?.scrollIntoView({ block: 'center' }));
  await shot(page, `${vp}-4-checkout-prefill`);
  check(`[${vp}] customer pages without JS errors`, errors.length === 0, errors.join(' | '));
  await context.close();

  // Admin: hidden path, password only (ADMIN_TWO_FACTOR_REQUIRED=false)
  const adminContext = await browser.createBrowserContext();
  const admin = await adminContext.newPage();
  await admin.setViewport(viewport);
  const adminErrors = [];
  admin.on('pageerror', (e) => adminErrors.push(e.message));
  await admin.evaluateOnNewDocument(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.scrollBehavior = 'auto'; }));
  const guessed = await admin.goto(`${ADMIN}/owner`, { waitUntil: 'networkidle0' });
  const guessedBody = await admin.content();
  check(`[${vp}] guessed admin URL /owner is a plain 404 without the secret`, guessed.status() === 404 && !guessedBody.includes(SECRET) && !guessedBody.includes('_next'));
  const real = await admin.goto(`${ADMIN}${SECRET}/owner`, { waitUntil: 'networkidle0' });
  check(`[${vp}] admin page opens at the secret path with its styles`, real.status() === 200 && (await admin.evaluate(() => document.styleSheets.length)) > 0);
  await shot(admin, `${vp}-5-admin-login`);
  await admin.type('input[name="username"]', 'sayt_admin');
  await admin.type('input[name="password"]', ADMIN_PASSWORD);
  await admin.$eval('main form button.rs-button', (el) => el.scrollIntoView({ block: 'center' }));
  await admin.click('main form button.rs-button');
  await wait(2500);
  const dashboard = await text(admin);
  check(`[${vp}] admin signs in with the 16-character password, no 2FA prompt`, !/Google Authenticator|kodni kiriting|2FA|authenticator/i.test(dashboard) && !/Login yoki parol noto‘g‘ri/.test(dashboard) && /Nizolar|Moderatsiya|Boshqaruv|Mahsulotlar/.test(dashboard), dashboard.slice(0, 160).replace(/\n/g, ' '));
  check(`[${vp}] admin page shows no password on screen`, !dashboard.includes(ADMIN_PASSWORD));
  await shot(admin, `${vp}-6-admin-dashboard`);
  check(`[${vp}] admin pages without JS errors`, adminErrors.length === 0, adminErrors.join(' | '));
  await adminContext.close();
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} browser checks passed`);
process.exit(failed ? 1 : 0);
