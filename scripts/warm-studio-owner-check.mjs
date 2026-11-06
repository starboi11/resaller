// UI contract checks only. Route fixtures do not test backend authorization.
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'msedge' });
const results = [];
for (const width of [1440, 360]) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto('http://localhost:3101/owner');
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `artifacts/warm-studio/admin-login-${width}.png`,
    fullPage: true,
  });
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  results.push({
    test: 'admin-login',
    width,
    overflow,
    violations: axe.violations.map((v) => v.id),
  });
  expect(overflow).toBe(false);
  expect(axe.violations).toEqual([]);
  let storesRequests = 0;
  await page.route('**/api/v1/seller/stores', (route) => {
    storesRequests++;
    return route.fulfill({ json: [] });
  });
  await page.route('**/api/v1/seller/owner-status', (route) =>
    route.fulfill({ json: { isOwner: false, roles: ['SELLER'] } }),
  );
  await page.goto('http://localhost:3100/seller/manage');
  await expect(
    page.getByText('Bu bo‘lim faqat do‘kon egasi uchun', { exact: true }),
  ).toBeVisible();
  expect(storesRequests).toBe(0);
  await page.screenshot({
    path: `artifacts/warm-studio/owner-denied-${width}.png`,
    fullPage: true,
  });
  results.push({ test: 'old-seller-ui-denied-fixture', width, passed: true });
  await page.unroute('**/api/v1/seller/owner-status');
  await page.route('**/api/v1/seller/owner-status', (route) =>
    route.fulfill({ json: { isOwner: true } }),
  );
  await page.goto('http://localhost:3100/');
  if (width === 1440) {
    await page.locator('.header-account summary').click();
    await expect(
      page.getByRole('link', { name: 'Do‘kon boshqaruvi', exact: true }),
    ).toBeVisible();
    results.push({ test: 'owner-menu-fixture', passed: true });
  }
  await context.close();
}
await browser.close();
await writeFile(
  'artifacts/warm-studio/owner-results.json',
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
