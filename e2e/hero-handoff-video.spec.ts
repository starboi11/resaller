import { expect, test } from '@playwright/test';

test('desktop hero plays the muted handoff loop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/');
  const video = page.locator('.market-hero__video');
  await expect(video).toBeAttached();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
  await expect(video).toHaveAttribute('loop', '');
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThan(0);
});

test('reduced motion and small screens keep the static poster', async (
  { page },
  testInfo,
) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.market-hero__scene')).toBeVisible();
  await expect(page.locator('.market-hero__video')).toHaveCount(0);

  if (testInfo.project.name === 'desktop-chromium') {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.market-hero__video')).toHaveCount(0);
  }
});
