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
  await expect(
    page.getByRole('navigation', { name: 'Seller bo‘limlari' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Ariza boshlash' }).click();
  const storeForm = page
    .getByRole('heading', { name: '3. Do‘kon yaratish' })
    .locator('..');
  await storeForm.getByPlaceholder('Do‘kon nomi').fill(`E2E Store ${stamp}`);
  await storeForm
    .getByLabel('Do‘kon manzili')
    .fill(`store_${stamp}`.slice(0, 30));
  await storeForm.getByRole('button', { name: 'Yaratish' }).click();
  await expect(storeForm.getByRole('alert')).toContainText('Buyurtma kodi');
  await storeForm.getByLabel('Buyurtma kodi').fill(`E${stamp.slice(-6)}`);
  await storeForm.getByRole('button', { name: 'Yaratish' }).click();
  await expect(
    page.getByRole('heading', { name: `E2E Store ${stamp}` }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '2. Shaxsni tasdiqlash' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Do‘konni faollashtirish' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('link', { name: 'Marketing va analytics' }),
  ).toBeVisible();
  const sectionNav = page.getByRole('navigation', {
    name: 'Seller bo‘limlari',
  });
  await expect(
    sectionNav.getByRole('link', { name: 'Marketing va tahlil' }),
  ).toHaveAttribute('href', '#marketing');
  await expect(sectionNav.getByRole('link')).toHaveCount(7);
  const wizard = page.locator('form.product-wizard');
  await wizard.getByPlaceholder('Mahsulot nomi').fill('Sinov mahsuloti');
  await wizard
    .getByPlaceholder('Batafsil tavsif')
    .fill('Mahsulot uchun batafsil tavsif.');
  await wizard.getByRole('button', { name: '3. Narx va variant' }).click();
  await wizard.getByPlaceholder('Narx', { exact: true }).fill('10000');
  await wizard.getByPlaceholder('Soni').fill('1');
  await wizard.getByRole('button', { name: '4. Ko‘rish/publish' }).click();
  await wizard
    .getByRole('button', { name: 'Draft va mediani yaratish' })
    .click();
  await expect(wizard.getByRole('alert')).toContainText('SKU kodini kiriting');
  await expect(wizard.getByPlaceholder('SKU')).toBeVisible();
});
