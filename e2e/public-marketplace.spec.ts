import { expect, test } from '@playwright/test';

test('buyer can navigate the mobile-first marketplace shell', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Xarid qilish va sotishning yaxshiroq yo‘li',
  );
  await page
    .getByRole('link', { name: 'Mahsulotlarni ko‘rish →', exact: true })
    .first()
    .click();
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
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(() => localStorage.setItem('resaller-theme', 'system'));
  await page.reload();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  const theme = page.getByRole('button', { name: /mavzu/i });
  await expect(theme).toBeVisible();
  for (const expected of ['light', 'dark', 'system']) {
    await theme.click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('resaller-theme')))
      .toBe(expected);
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      /light|dark/,
    );
  }
});

test('reduced motion removes decorative animation without hiding content', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const motion = await page
    .locator('.market-hero__scene')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationDuration: Number.parseFloat(style.animationDuration),
        transitionDuration: Number.parseFloat(style.transitionDuration),
      };
    });
  expect(motion.animationDuration).toBeLessThanOrEqual(0.01);
  expect(motion.transitionDuration).toBeLessThanOrEqual(0.01);
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
  for (const route of [
    '/',
    '/marketplace',
    '/product/demo-1',
    '/categories',
    '/login',
  ]) {
    await page.goto(route);
    // The Next.js development toolbar is not part of the product UI and adds
    // icon-only buttons while the test server is running in development mode.
    await page.locator('nextjs-portal').evaluateAll((nodes) =>
      nodes.forEach((node) => node.remove()),
    );
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(
      overflow,
      `${route} must not scroll horizontally`,
    ).toBeLessThanOrEqual(1);
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

test('marketplace keeps the query while switching Uzbek and Russian', async ({
  page,
}) => {
  await page.goto('/marketplace?q=telefon&lang=uz');
  await page.getByRole('link', { name: 'RU', exact: true }).click();
  await expect(page).toHaveURL(/q=telefon/);
  await expect(page).toHaveURL(/lang=ru/);
  await expect(page.getByText(/товаров найдено/)).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'UZ', exact: true }),
  ).toBeVisible();
});
