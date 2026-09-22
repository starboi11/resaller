import { expect, test } from '@playwright/test';

test('homepage visual baseline', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('resaller-theme', 'dark');
  });
  await page.reload();
  // Fixed controls and the Next.js dev indicator are separate surfaces. Their
  // position can overlap the hero by a few pixels depending on browser timing.
  await page.locator('.ai-assistant, nextjs-portal').evaluateAll((nodes) => {
    for (const node of nodes) {
      (node as HTMLElement).style.visibility = 'hidden';
    }
  });
  await expect(page.locator('.market-hero')).toHaveScreenshot(
    'homepage-dark.png',
    {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    },
  );
});

test('marketplace empty and outage-safe layout baseline', async ({ page }) => {
  await page.goto(
    '/marketplace?q=__resaller_visual_baseline_empty_catalog_49f26c__',
  );
  await page.waitForLoadState('networkidle');
  await expect(page.locator('main.catalog-page')).toHaveScreenshot(
    'marketplace-empty.png',
    { animations: 'disabled', maxDiffPixelRatio: 0.02 },
  );
});
