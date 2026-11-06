import { expect, test } from '@playwright/test';

const ADMIN = process.env.E2E_ADMIN_URL ?? 'http://localhost:3001';
const API = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';

test('owner route is unlisted and anonymous data access is denied', async ({ page }) => {
  const root = await page.goto(ADMIN);
  expect(root?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /not found|topilmadi/i })).toBeVisible();
  await page.goto(`${ADMIN}/owner`);
  await expect(page.getByRole('heading', { name: 'Superadmin boshqaruvi' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Xavfsiz kirish' })).toBeVisible();
  await expect(page.getByText('Berilgan buyurtmalar')).toHaveCount(0);
  const overview = await page.request.get(`${API}/admin/overview`);
  const listings = await page.request.get(`${API}/admin/listings`);
  expect(overview.status()).toBe(401);
  expect(listings.status()).toBe(401);
});
