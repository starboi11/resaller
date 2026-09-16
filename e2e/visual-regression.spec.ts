import { expect, test } from '@playwright/test';

test('homepage visual baseline', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('resaller-theme', 'dark');
  });
  await page.reload();
  await expect(page.locator('.market-hero')).toHaveScreenshot(
    'homepage-dark.png',
    {
      animations: 'disabled',
    },
  );
});

test('marketplace empty and outage-safe layout baseline', async ({ page }) => {
  await page.goto(
    '/marketplace?q=__resaller_visual_baseline_empty_catalog_49f26c__',
  );
  await expect(page.locator('main.catalog-page')).toHaveScreenshot(
    'marketplace-empty.png',
    { animations: 'disabled', maxDiffPixelRatio: 0.02 },
  );
});
