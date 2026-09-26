import { expect, test } from '@playwright/test';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';

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
  await page.getByLabel('Parol').fill('Abcd12');
  await page.getByRole('button', { name: 'Hisob yaratish' }).click();
  await expect(page).toHaveURL(/marketplace/);
  const sessionCookies = (await page.context().cookies(API)).filter((cookie) =>
    cookie.name.endsWith('resaller_session'),
  );
  expect(sessionCookies).toHaveLength(1);
  expect(sessionCookies[0]).toMatchObject({
    httpOnly: true,
    secure: API.startsWith('https:'),
  });
  await page.reload();
  const currentUser = await page.evaluate(async (api) => {
    const response = await fetch(`${api}/auth/me`, { credentials: 'include' });
    return response.status;
  }, API);
  expect(currentUser).toBe(200);
  await page.goto('/account');
  await expect(
    page.getByRole('heading', { name: 'Hisob va xavfsizlik' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Faol qurilmalar' }),
  ).toBeVisible();
  await expect(page.getByText('Invalid Date')).toHaveCount(0);
  await expect(page.getByText('Joriy qurilma', { exact: false })).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByText('Savat bo‘sh')).toBeVisible();
  await expect(page.locator('.rs-state__icon svg')).toBeVisible();
});

test('password recovery keeps account existence private', async ({ page }) => {
  await page.goto('/recovery');
  await page.getByLabel('Username').fill(`missing_${Date.now()}`);
  await page.getByRole('button', { name: 'Tiklashni boshlash' }).click();
  await expect(page.getByText('Agar hisob mavjud bo‘lsa')).toBeVisible();
});
