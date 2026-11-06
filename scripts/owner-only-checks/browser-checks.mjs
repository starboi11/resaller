import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const WEB = 'http://localhost:3000';
const OUT = process.env.SHOTS_DIR ?? './shots';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args.filter((a) => !['--single-process', '--disable-web-security', '--disable-site-isolation-trials'].includes(a)), '--host-resolver-rules=MAP localhost 127.0.0.1'], headless: true });
const viewports = { desktop: { width: 1280, height: 900, deviceScaleFactor: 1 }, mobile: { width: 360, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };

async function session(role, viewport) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (role !== 'guest') {
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle0' });
    await page.type('input[name="username"]', role);
    await page.type('input[name="password"]', 'Parol123');
    await Promise.all([page.waitForNetworkIdle({ idleTime: 600 }).catch(() => {}), page.click('form button.rs-button')]);
    await new Promise((r) => setTimeout(r, 800));
  }
  return { context, page, errors };
}
const text = (page) => page.evaluate(() => document.body.innerText);
async function visit(page, path, file) {
  await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: false });
  return text(page);
}
async function accountMenu(page) {
  const summary = await page.$('.header-account summary');
  if (!summary) return null;
  await summary.click(); await new Promise((r) => setTimeout(r, 300));
  return page.$eval('.header-account__menu', (el) => el.innerText).catch(() => null);
}

for (const [vp, viewport] of Object.entries(viewports)) {
  // Buyer
  { const { page, errors, context } = await session('xaridor', viewport);
    const market = await visit(page, '/marketplace', `${vp}-1-buyer-catalogue`);
    check(`[${vp}] buyer catalogue shows the owner's products only`, market.includes('Simsiz quloqchin TWS Pro') && !market.includes('ESKI DOKON'));
    check(`[${vp}] no seller-trust filter in catalogue`, !/Seller ishonchi|Top Seller|Trusted/.test(market));
    const product = await visit(page, '/product/clistowner000000000000001', `${vp}-2-buyer-product`);
    check(`[${vp}] product page says "Sotuvchi: Resaller", no trust badges`, product.includes('Sotuvchi: Resaller') && !/Shaxs tasdiqlangan|TOP SELLER|TRUSTED/i.test(product));
    const other = await visit(page, '/product/clistother000000000000001', `${vp}-3-buyer-old-store-product`);
    check(`[${vp}] old store product is not shown by direct link`, !other.includes('ESKI DOKON'));
    const manage = await visit(page, '/seller/manage', `${vp}-4-buyer-manage`);
    check(`[${vp}] buyer gets "faqat do‘kon egasi uchun" on management`, manage.includes('faqat do‘kon egasi uchun'));
    if (vp === 'desktop') { await page.goto(`${WEB}/marketplace`, { waitUntil: 'networkidle0' }); const menu = await accountMenu(page);
      await page.screenshot({ path: `${OUT}/${vp}-5-buyer-menu.png` });
      check(`[${vp}] buyer menu has no "Do‘kon boshqaruvi" or "Sotuvchi bo‘lish"`, menu !== null && !/Do‘kon boshqaruvi|Sotuvchi bo‘lish/.test(menu), JSON.stringify(menu)); }
    check(`[${vp}] buyer pages without JS errors`, errors.length === 0, errors.join(' | '));
    await context.close(); }
  // Old seller
  { const { page, errors, context } = await session('eski_sotuvchi', viewport);
    const manage = await visit(page, '/seller/manage', `${vp}-6-old-seller-manage`);
    check(`[${vp}] old SELLER account is not treated as owner`, manage.includes('faqat do‘kon egasi uchun') && !manage.includes('Eski do‘kon'));
    const center = await visit(page, '/seller/center/cstoreother0000000000002', `${vp}-7-old-seller-center`);
    check(`[${vp}] old SELLER cannot open Seller Center of its old store`, center.includes('faqat do‘kon egasi uchun') && !/Overview|Store Settings|Eski do‘kon/.test(center));
    if (vp === 'desktop') { await page.goto(`${WEB}/marketplace`, { waitUntil: 'networkidle0' }); const menu = await accountMenu(page);
      check(`[${vp}] old SELLER menu has no "Do‘kon boshqaruvi"`, menu !== null && !menu.includes('Do‘kon boshqaruvi'), JSON.stringify(menu)); }
    check(`[${vp}] old-seller pages without JS errors`, errors.length === 0, errors.join(' | '));
    await context.close(); }
  // Former team member of the owner store
  { const { page, errors, context } = await session('eski_azo', viewport);
    const manage = await visit(page, '/seller/manage', `${vp}-11-former-member-manage`);
    check(`[${vp}] former team member is not treated as owner`, manage.includes('faqat do‘kon egasi uchun') && !manage.includes('@resaller'));
    const center = await visit(page, '/seller/center/cstoreowner0000000000001', `${vp}-12-former-member-center`);
    check(`[${vp}] former team member cannot open the owner Seller Center`, center.includes('faqat do‘kon egasi uchun') && !/Overview|Store Settings/.test(center));
    if (vp === 'desktop') { await page.goto(`${WEB}/marketplace`, { waitUntil: 'networkidle0' }); const menu = await accountMenu(page);
      check(`[${vp}] former member menu has no "Do‘kon boshqaruvi"`, menu !== null && !menu.includes('Do‘kon boshqaruvi'), JSON.stringify(menu)); }
    check(`[${vp}] former-member pages without JS errors`, errors.length === 0, errors.join(' | '));
    await context.close(); }
  // Owner (not ID-verified)
  { const { page, errors, context } = await session('egasi', viewport);
    const manage = await visit(page, '/seller/manage', `${vp}-8-owner-manage`);
    check(`[${vp}] owner manages the store without ID verification`, manage.includes('Resaller') && !/shaxsingizni tasdiqlang|Seller arizasi|faqat do‘kon egasi uchun/.test(manage));
    const center = await visit(page, '/seller/center/cstoreowner0000000000001', `${vp}-9-owner-center`);
    check(`[${vp}] owner opens Seller Center; no reseller links`, /Overview/.test(center) && !/faqat do‘kon egasi uchun|ruxsat yo‘q|Supplier katalogi|Daromadlarim/.test(center));
    if (vp === 'desktop') { await page.goto(`${WEB}/marketplace`, { waitUntil: 'networkidle0' }); const menu = await accountMenu(page);
      await page.screenshot({ path: `${OUT}/${vp}-10-owner-menu.png` });
      check(`[${vp}] owner menu shows "Do‘kon boshqaruvi"`, menu?.includes('Do‘kon boshqaruvi') === true, JSON.stringify(menu)); }
    check(`[${vp}] owner pages without JS errors`, errors.length === 0, errors.join(' | '));
    await context.close(); }
}
// 360px: nothing may scroll sideways on the main buyer pages
{ const context = await browser.createBrowserContext(); const page = await context.newPage(); await page.setViewport(viewports.mobile);
  for (const path of ['/marketplace', '/product/clistowner000000000000001', '/store/resaller', '/cart']) {
    await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle0' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`[mobile] ${path} has no horizontal overflow at 360px`, overflow <= 1, `${overflow}px`);
  }
  await context.close(); }
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} browser checks passed`);
process.exit(failed ? 1 : 0);
