import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import pg from 'pg';

const WEB = 'http://localhost:3000';
const ADMIN = 'http://localhost:3001';
const PASSWORD = 'Resaller-E2E-2026';

async function register(context: BrowserContext, baseUrl: string, username: string) {
  const page = await context.newPage();
  await page.goto(baseUrl);
  const ok = await page.evaluate(
    async ({ username, password }) => {
      const response = await fetch('http://localhost:4000/api/v1/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      return response.ok;
    },
    { username, password: PASSWORD },
  );
  expect(ok).toBe(true);
  return page;
}

async function createStore(page: Page, stamp: string) {
  await page.goto(`${WEB}/seller/manage`);
  await page.getByRole('button', { name: 'Ariza boshlash' }).click();
  const storeForm = page.getByRole('heading', { name: '3. Do‘kon yaratish' }).locator('..');
  await storeForm.getByPlaceholder('Do‘kon nomi').fill(`Journey Store ${stamp}`);
  await storeForm.getByPlaceholder('username').fill(`journey_store_${stamp}`.slice(0, 30));
  await storeForm.getByPlaceholder('ORDER PREFIX').fill(`J${stamp.slice(-6)}`);
  await storeForm.getByRole('button', { name: 'Yaratish' }).click();
  await expect(page.getByRole('heading', { name: `Journey Store ${stamp}` })).toBeVisible();
}

test('seller → admin → buyer → fulfillment → verified review journey', async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  const database = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await database.connect();
  const stamp = `${Date.now()}${testInfo.workerIndex}`;
  const sellerName = `journey_seller_${stamp}`.slice(0, 32);
  const buyerName = `journey_buyer_${stamp}`.slice(0, 32);
  const adminName = `journey_admin_${stamp}`.slice(0, 32);
  const productName = `Journey mahsulot ${stamp}`;
  const contexts: BrowserContext[] = [];

  try {
    const sellerContext = await browser.newContext();
    contexts.push(sellerContext);
    const sellerPage = await register(sellerContext, WEB, sellerName);
    await createStore(sellerPage, stamp);

    await database.query(
      `UPDATE "SellerProfile" SET "verifiedAt" = now()
       WHERE "userId" = (SELECT id FROM "User" WHERE username = $1)`,
      [sellerName],
    );
    await database.query(
      `UPDATE "Store" SET status = 'ACTIVE'
       WHERE "sellerProfileId" = (
         SELECT id FROM "SellerProfile" WHERE "userId" =
           (SELECT id FROM "User" WHERE username = $1)
       )`,
      [sellerName],
    );

    await sellerPage.reload();
    const wizard = sellerPage.locator('form.product-wizard');
    await wizard.getByPlaceholder('Mahsulot nomi').fill(productName);
    await wizard.getByPlaceholder('Batafsil tavsif').fill('E2E savdo yo‘li uchun haqiqiy sinov mahsuloti.');
    await wizard.getByPlaceholder('Kategoriya slug').fill('other');
    await wizard.getByRole('button', { name: 'Media bosqichi →' }).click();
    await wizard.getByRole('button', { name: 'Narx va variant →' }).click();
    await wizard.getByPlaceholder('Narx').fill('189000');
    await wizard.getByPlaceholder('Soni').fill('5');
    await wizard.getByPlaceholder('SKU').fill(`SKU-${stamp}`);
    await wizard.getByRole('button', { name: 'Preview →' }).click();
    await wizard.getByRole('button', { name: 'Draft yaratish' }).click();

    const productCard = sellerPage.locator('article').filter({ hasText: productName });
    await expect(productCard).toBeVisible();
    await productCard.locator('input[type=file]').setInputFiles({
      name: 'journey-product.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await expect(sellerPage.getByText('Rasm siqildi va thumbnail yaratildi.')).toBeVisible();
    await productCard.getByRole('button', { name: 'Moderatsiyaga yuborish' }).click();
    await expect(productCard).toContainText('PENDING_REVIEW');

    const adminContext = await browser.newContext();
    contexts.push(adminContext);
    const adminPage = await register(adminContext, ADMIN, adminName);
    await database.query(
      'UPDATE "User" SET roles = ARRAY[$1, $2]::"Role"[] WHERE username = $3',
      ['BUYER', 'MODERATOR', adminName],
    );
    await adminPage.reload();
    const moderationRow = adminPage.locator('article.queue-row').filter({ hasText: productName });
    await expect(moderationRow).toBeVisible();
    await moderationRow.getByRole('button', { name: 'Tasdiqlash' }).click();
    const decision = adminPage.getByRole('dialog', { name: 'Moderatsiya qarori' });
    await decision.locator('textarea').fill('Mahsulot ma’lumotlari va rasmi tekshirildi.');
    await decision.getByRole('button', { name: 'Qarorni tasdiqlash' }).click();
    await expect(moderationRow).toHaveCount(0);

    const listing = await database.query<{ publicId: string }>(
      'SELECT "publicId" FROM "Listing" WHERE "nameUz" = $1',
      [productName],
    );
    const listingPublicId = listing.rows[0]?.publicId;
    expect(listingPublicId).toBeTruthy();

    const buyerContext = await browser.newContext();
    contexts.push(buyerContext);
    const buyerPage = await register(buyerContext, WEB, buyerName);
    await buyerPage.goto(`${WEB}/marketplace?q=${encodeURIComponent(productName)}`);
    await buyerPage.getByRole('link', { name: new RegExp(productName) }).click();
    await buyerPage.getByRole('button', { name: 'Savatga qo‘shish' }).click();
    await expect(buyerPage.getByRole('button', { name: 'Savatga qo‘shildi ✓' })).toBeVisible();
    await buyerPage.goto(`${WEB}/cart`);
    await buyerPage.getByPlaceholder('Ism va familiya').fill('Journey Buyer');
    await buyerPage.getByPlaceholder('Telefon').fill('+998901234567');
    await buyerPage.getByPlaceholder('Viloyat / shahar').fill('Toshkent');
    await buyerPage.getByPlaceholder('To‘liq manzil').fill('Amir Temur ko‘chasi 1');
    await buyerPage.getByRole('button', { name: 'Buyurtma berish' }).click();
    await expect(buyerPage.getByRole('timer')).toContainText('60 daqiqada');
    const orderUrl = buyerPage.url();
    expect(orderUrl).toContain('/orders/');

    await sellerPage.goto(`${WEB}/seller`);
    await sellerPage.getByRole('button', { name: 'Qabul qilish' }).click();
    await sellerPage.goto(orderUrl);
    for (const status of ['PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'COMPLETED']) {
      await sellerPage.getByRole('button', { name: `${status} holatiga o‘tkazish` }).click();
      await expect(sellerPage.getByText(status, { exact: true }).first()).toBeVisible();
    }

    await buyerPage.reload();
    await buyerPage.getByRole('button', { name: 'Sharh yozish' }).click();
    await buyerPage.getByLabel('Baho').selectOption('5');
    await buyerPage.getByLabel('Sharh').fill('Mahsulot va buyurtma jarayoni juda yaxshi ishladi.');
    await buyerPage.getByRole('button', { name: 'Sharhni yuborish' }).click();
    await expect(buyerPage.getByRole('button', { name: 'Sharh yozish' })).toHaveCount(0);
    await buyerPage.goto(`${WEB}/product/${listingPublicId}`);
    await expect(buyerPage.getByText('Mahsulot va buyurtma jarayoni juda yaxshi ishladi.')).toBeVisible();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await database.end();
  }
});
