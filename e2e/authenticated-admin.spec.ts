import { expect, test } from '@playwright/test';

const ADMIN = `${process.env.E2E_ADMIN_URL ?? 'http://localhost:3001'}/owner`;
const API = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';
import pg from 'pg';
import { enrollAdmin } from './helpers/admin-auth';
import { testDatabaseUrl } from './helpers/test-database';

test('authenticated superadmin can use the private owner control center', async ({ page }, testInfo) => {
  const database = new pg.Client({ connectionString: testDatabaseUrl() });
  await database.connect();
  const username = `admin_e2e_${testInfo.project.name.replace(/\W/g, '').slice(0, 6)}_${Date.now()}`.slice(0, 32);
  try {
    await page.goto(ADMIN);
    const registered = await page.evaluate(async ({ username, api }) => {
      const response = await fetch(`${api}/auth/register`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password: 'Resaller-Admin-E2E-2026' }) });
      return response.ok;
    }, { username, api: API });
    expect(registered).toBe(true);
    await database.query('UPDATE "User" SET roles = ARRAY[$1, $2]::"Role"[] WHERE username = $3', ['BUYER', 'SUPER_ADMIN', username]);
    const denied = await page.request.get(`${API}/admin/overview`);
    expect(denied.status()).toBe(401);
    await enrollAdmin(page, username, 'Resaller-Admin-E2E-2026');
    await expect(page.getByRole('heading', { name: 'Superadmin boshqaruvi' })).toBeVisible();
    await expect(page.getByText('Kuzatuv ma’lumotlari yangilandi.')).toBeVisible();
    await expect(page.getByText('Berilgan buyurtmalar')).toBeVisible();
    await expect(page.getByText('Bugungi noyob brauzerlar')).toBeVisible();
    const verificationLink = page.getByRole('link', { name: 'Sotuvchini tekshirish' });
    await verificationLink.click();
    await expect(verificationLink).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('link', { name: 'Boshqaruv', exact: true })).not.toHaveAttribute('aria-current', 'page');
    await page.getByRole('link', { name: 'Barcha modullar' }).click();
    await expect(page.getByRole('heading', { name: 'Operatsion modullar' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sharhlar/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Q&A reportlar/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Xavfsizlik/ })).toBeVisible();
  } finally {
    await database.query('DELETE FROM "User" WHERE username = $1', [username]);
    await database.end();
  }
});
