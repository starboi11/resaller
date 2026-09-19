import { expect, test } from '@playwright/test';

const buyerRoutes = [
  '/',
  '/marketplace',
  '/categories',
  '/cart',
  '/orders',
  '/favorites',
  '/recent',
  '/account',
  '/seller',
  '/seller/manage',
  '/checkout/success',
  '/login',
];

test('buyer and seller workspaces remain readable at each device width', async ({
  page,
}) => {
  for (const route of buyerRoutes) {
    await page.goto(route);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('main').first()).toBeVisible();
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Application error');
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, `${route} has horizontal overflow`).toBeLessThanOrEqual(1);
  }
});

test('admin entry and operator workspace render without clipping', async ({
  page,
}) => {
  for (const route of ['/', '/operations']) {
    await page.goto(`http://localhost:3001${route}`);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('main').first()).toBeVisible();
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Application error');
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(
      overflow,
      `admin ${route} has horizontal overflow`,
    ).toBeLessThanOrEqual(1);
  }
});
