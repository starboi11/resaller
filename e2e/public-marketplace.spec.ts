import { expect, test } from '@playwright/test';

test('buyer can navigate the mobile-first marketplace shell', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Mahsulot toping',
  );
  await page.getByRole('link', { name: 'Mahsulotlarni ko‘rish' }).click();
  await expect(page).toHaveURL(/marketplace/);
  await expect(
    page.getByRole('heading', { name: 'Marketplace' }),
  ).toBeVisible();
  await expect(page.getByRole('search')).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Asosiy navigatsiya' })
      .or(page.getByRole('navigation', { name: 'Mobil navigatsiya' })),
  ).toBeAttached();
});

test('keyboard focus and theme controls are available', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /asosiy qism/i })).toBeFocused();
  const theme = page.getByRole('button', { name: /mavzu/i });
  await expect(theme).toBeVisible();
  await theme.click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    /light|dark/,
  );
});

test('account-protected screens provide a safe login path', async ({
  page,
}) => {
  await page.goto('/cart');
  await expect(page.getByText('Savat uchun hisobga kiring')).toBeVisible();
  await page.goto('/orders');
  await expect(page.getByText('Hisobga kirish kerak')).toBeVisible();
});

test('public pages have named controls, image alternatives and no horizontal overflow', async ({
  page,
}) => {
  for (const route of ['/', '/marketplace', '/categories', '/login']) {
    await page.goto(route);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(
      page.locator('button:not([aria-label])').filter({ hasText: /^$/ }),
    ).toHaveCount(0);
    for (const image of await page.locator('img').all())
      await expect(image).toHaveAttribute('alt', /.+/);
  }
});

test('initial marketplace rendering stays within the local performance budget', async ({
  page,
}) => {
  await page.goto('/marketplace');
  const timing = await page.evaluate(() => {
    const entry = performance.getEntriesByType(
      'navigation',
    )[0] as PerformanceNavigationTiming;
    return { dom: entry.domContentLoadedEventEnd, load: entry.loadEventEnd };
  });
  expect(timing.dom).toBeLessThan(3000);
  expect(timing.load).toBeLessThan(5000);
});
