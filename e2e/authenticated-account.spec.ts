import { expect, test } from '@playwright/test';

test('new buyer can register and reach protected account and cart screens', async ({
  page,
}, testInfo) => {
  const username =
    `e2e_${testInfo.project.name.replace(/\W/g, '').slice(0, 8)}_${Date.now()}`.slice(
      0,
      32,
    );
  await page.goto('/login');
  await page.getByRole('button', { name: 'Yangi hisob yaratish' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Parol').fill('Resaller-E2E-Password-2026');
  await page.getByRole('button', { name: 'Hisob yaratish' }).click();
  await expect(page).toHaveURL(/marketplace/);
  await page.goto('/account');
  await expect(
    page.getByRole('heading', { name: 'Hisob va xavfsizlik' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Faol qurilmalar' }),
  ).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByText('Savat bo‘sh')).toBeVisible();
});

test('password recovery keeps account existence private', async ({ page }) => {
  await page.goto('/recovery');
  await page.getByLabel('Username').fill(`missing_${Date.now()}`);
  await page.getByRole('button', { name: 'Tiklashni boshlash' }).click();
  await expect(page.getByText('Agar hisob mavjud bo‘lsa')).toBeVisible();
});
