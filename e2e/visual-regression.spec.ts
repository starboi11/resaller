import { expect, test } from '@playwright/test';

test('homepage visual baseline', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('resaller-theme', 'dark');
  });
  await page.reload();
  await expect(page).toHaveScreenshot('homepage-dark.png', {
    fullPage: true,
    animations: 'disabled',
    mask: [page.locator('time')],
  });
});

test('marketplace empty and outage-safe layout baseline', async ({ page }) => {
  await page.route('**/api/v1/marketplace/listings**', (route) =>
    route.fulfill({
      json: {
        items: [],
        pagination: { page: 1, pageSize: 12, total: 0, pages: 0 },
      },
    }),
  );
  await page.route('**/api/v1/categories', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto('/marketplace');
  await expect(page).toHaveScreenshot('marketplace-empty.png', {
    fullPage: true,
    animations: 'disabled',
  });
});
