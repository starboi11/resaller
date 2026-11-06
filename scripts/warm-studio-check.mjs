import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.WARM_PREVIEW_URL || 'http://localhost:3100';
const out = 'artifacts/warm-studio';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
for (const width of [1440, 360]) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const route of [
    '/',
    '/marketplace',
    '/cart',
    '/login',
    '/favorites',
    '/account',
    '/orders',
    '/seller/manage',
  ]) {
    const response = await page.goto(base + route);
    await page.waitForTimeout(500);
    const name = route === '/' ? 'home' : route.slice(1).replaceAll('/', '-');
    await page.screenshot({
      path: `${out}/${name}-${width}.png`,
      fullPage: true,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    results.push({
      route,
      width,
      status: response.status(),
      overflow,
      errors: [...errors],
      violations: axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    });
    errors.length = 0;
  }
  await page.goto(base);
  await page
    .getByRole('link', { name: 'Mahsulotlarni ko‘rish', exact: false })
    .first()
    .click();
  if (!page.url().includes('/marketplace'))
    throw new Error('Catalog CTA failed');
  await page.goto(base);
  await page.getByText('Buyurtmam qayerda?', { exact: true }).click();
  if (
    !(await page
      .locator('.warm-faq details')
      .first()
      .getAttribute('open')
      .then((v) => v !== null))
  )
    throw new Error('FAQ failed');
  await page.evaluate(() => localStorage.setItem('resaller-theme', 'dark'));
  await page.reload();
  if ((await page.locator('html').getAttribute('data-theme')) !== 'dark')
    throw new Error('Saved theme failed');
  await page.screenshot({
    path: `${out}/home-dark-${width}.png`,
    fullPage: true,
  });
  const darkAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  results.push({
    route: '/?theme=dark',
    width,
    status: 200,
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    errors: [...errors],
    violations: darkAxe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  });
  await page.route('**/api/v1/assistant/message', (route) => route.abort());
  await page.getByRole('button', { name: 'AI yordamchini ochish' }).click();
  await page
    .getByLabel('Savolingiz', { exact: true })
    .fill('Telefon topishga yordam bering');
  await page
    .getByRole('button', { name: 'Yordam so‘rash', exact: true })
    .click();
  await page
    .getByText('Yordamchiga ulanib bo‘lmadi.', { exact: false })
    .waitFor();
  if (
    await page
      .getByRole('button', { name: 'Yordam so‘rash', exact: true })
      .isDisabled()
  )
    throw new Error('Assistant cannot retry');
  await context.close();
}
await browser.close();
await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (
  results.some(
    (r) =>
      r.overflow || r.errors.length || r.status >= 500 || r.violations.length,
  )
)
  process.exitCode = 1;
