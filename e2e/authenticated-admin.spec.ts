import { expect, test } from '@playwright/test';

const ADMIN = process.env.E2E_ADMIN_URL ?? 'http://localhost:3001';
const API = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';
import pg from 'pg';

test('authenticated moderator can use the admin control center', async ({ page }, testInfo) => {
  const database = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL });
  await database.connect();
  const username = `admin_e2e_${testInfo.project.name.replace(/\W/g, '').slice(0, 6)}_${Date.now()}`.slice(0, 32);
  try {
    await page.goto(ADMIN);
    const registered = await page.evaluate(async ({ username, api }) => {
      const response = await fetch(`${api}/auth/register`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password: 'Resaller-Admin-E2E-2026' }) });
      return response.ok;
    }, { username, api: API });
    expect(registered).toBe(true);
    await database.query('UPDATE "User" SET roles = ARRAY[$1, $2]::"Role"[] WHERE username = $3', ['BUYER', 'MODERATOR', username]);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Admin boshqaruvi' })).toBeVisible();
    await expect(page.getByText('Moderatsiya navbati yangilandi.')).toBeVisible();
    await page.getByRole('link', { name: 'Barcha modullar' }).click();
    await expect(page.getByRole('heading', { name: 'Operatsion modullar' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sharhlar/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Q&A reportlar/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Xavfsizlik/ })).toHaveCount(0);
  } finally {
    await database.query('DELETE FROM "User" WHERE username = $1', [username]);
    await database.end();
  }
});
