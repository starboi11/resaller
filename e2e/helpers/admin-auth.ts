import { createHmac } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

function currentCode(secret: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret].map((char) => alphabet.indexOf(char).toString(2).padStart(5, '0')).join('');
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((byte) => Number.parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', bytes).update(counter).digest();
  return ((digest.readUInt32BE(digest[digest.length - 1]! & 15) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

// Use the real password + authenticator UI after test-only role bootstrapping.
export async function enrollAdmin(page: Page, username: string, password: string) {
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Xavfsiz kirish' })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Parol', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  const secret = page.locator('code');
  await expect(secret).toBeVisible();
  await page.getByLabel('6 xonali kod').fill(currentCode((await secret.innerText()).trim()));
  await page.getByRole('button', { name: 'Tasdiqlash', exact: true }).click();
  await expect(page.getByText('Kuzatuv ma’lumotlari yangilandi.')).toBeVisible();
}
