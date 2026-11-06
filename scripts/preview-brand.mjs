import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'artifacts/brand-preview';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const results = [];
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 360, 800]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:3100/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (await page.locator('a[href^="/seller"], a[href="#sotuvchi"]').count()) throw new Error('Seller invitation on buyer homepage');
    await page.getByText('Buyurtmamni qayerdan kuzataman?', { exact: true }).click();
    const faq = await page.locator('details[open]').innerText();
    const accessibility = await new AxeBuilder({ page }).analyze();
    await page.getByRole('link', { name: 'Xarid qilish ↗', exact: true }).click();
    await page.waitForURL('**/marketplace');
    await page.screenshot({ path: `${output}/${name}-marketplace.png`, fullPage: true });
    const marketplaceOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    results.push({ name, overflow, marketplaceOverflow, faqWorks: faq.includes('Buyurtmalar'), destination: page.url(), errors, violations: accessibility.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })) });
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.some(r => r.overflow || r.marketplaceOverflow || !r.faqWorks || r.errors.length || r.violations.length)) process.exitCode = 1;
