import { expect, test } from '@playwright/test';

test('login exposes native validation and survives API outage', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /Kirish/ }).click();
  const username = page.getByLabel('Username');
  await expect(username).toHaveJSProperty('validity.valueMissing', true);
  await page.route('**/api/v1/auth/login', (route) => route.abort('failed'));
  await username.fill('test_buyer');
  await page.getByLabel('Parol').fill('Resaller-Test-Password-2026');
  await page.getByRole('button', { name: /Kirish/ }).click();
  await expect(page.getByText(/Server bilan ulanib bo‘lmadi/i)).toBeVisible();
});

test('expired session and denied permission are clearly explained', async ({
  page,
}) => {
  await page.route('**/api/v1/seller/stores', (route) =>
    route.fulfill({
      status: 401,
      json: { code: 'UNAUTHORIZED', message: 'Session expired' },
    }),
  );
  await page.goto('/seller/manage');
  await expect(page.getByText(/kiring|session|ruxsat/i).first()).toBeVisible();
});

test('homepage has keyboard landmarks and a bounded initial resource budget', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'uz');
  await expect(
    page
      .getByRole('navigation', { name: /Asosiy navigatsiya|Mobil navigatsiya/ })
      .first(),
  ).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  const transfer = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .reduce(
        (sum, entry) =>
          sum + ((entry as PerformanceResourceTiming).transferSize || 0),
        0,
      ),
  );
  expect(transfer).toBeLessThan(8 * 1024 * 1024);
});
