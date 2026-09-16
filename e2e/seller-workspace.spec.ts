import { expect, test } from '@playwright/test';

test('seller can start onboarding and create a draft store', async ({
  page,
}, testInfo) => {
  const stamp = `${Date.now()}${testInfo.workerIndex}`;
  const username = `seller_${stamp}`.slice(0, 32);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Yangi hisob yaratish' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Parol').fill('Resaller-Seller-E2E-2026');
  await page.getByRole('button', { name: 'Hisob yaratish' }).click();
  await expect(page).toHaveURL(/marketplace/);
  await page.goto('/seller/manage');
  await page.getByRole('button', { name: 'Ariza boshlash' }).click();
  const storeForm = page
    .getByRole('heading', { name: '3. Do‘kon yaratish' })
    .locator('..');
  await storeForm.getByPlaceholder('Do‘kon nomi').fill(`E2E Store ${stamp}`);
  await storeForm
    .getByPlaceholder('username')
    .fill(`store_${stamp}`.slice(0, 30));
  await storeForm.getByPlaceholder('ORDER PREFIX').fill(`E${stamp.slice(-6)}`);
  await storeForm.getByRole('button', { name: 'Yaratish' }).click();
  await expect(
    page.getByRole('heading', { name: `E2E Store ${stamp}` }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Marketing va analytics' }),
  ).toBeVisible();
});
