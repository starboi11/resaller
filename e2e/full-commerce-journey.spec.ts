import {
  devices,
  expect,
  test,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import pg from 'pg';
import { orderStatusLabel } from '../apps/web/app/lib/order-status';

const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const ADMIN = process.env.E2E_ADMIN_URL ?? 'http://localhost:3001';
const API = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';
const PASSWORD = 'Resaller-E2E-2026';

async function verifyAuthenticatedSseLoad(
  context: BrowserContext,
  orderPublicId: string,
) {
  const cookie = (await context.cookies(API))
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const clients = 25;
  try {
    const results = await Promise.all(
      Array.from({ length: clients }, async () => {
        const response = await fetch(
          `${API}/orders/${orderPublicId}/messages/stream`,
          {
            headers: { accept: 'text/event-stream', cookie },
            signal: controller.signal,
          },
        );
        if (!response.ok || !response.body)
          return { status: response.status, received: false };
        const firstEvent = await response.body.getReader().read();
        return { status: response.status, received: !firstEvent.done };
      }),
    );
    expect(results).toHaveLength(clients);
    expect(results.map((result) => result.status)).toEqual(
      Array(clients).fill(200),
    );
    expect(results.map((result) => result.received)).toEqual(
      Array(clients).fill(true),
    );
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

async function register(
  context: BrowserContext,
  baseUrl: string,
  username: string,
) {
  const page = await context.newPage();
  await page.goto(baseUrl);
  const ok = await page.evaluate(
    async ({ username, password, api }) => {
      const response = await fetch(
        `${api}/auth/register`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username, password }),
        },
      );
      return response.ok;
    },
    { username, password: PASSWORD, api: API },
  );
  expect(ok).toBe(true);
  return page;
}

async function createStore(page: Page, stamp: string) {
  await page.goto(`${WEB}/seller/manage`);
  await page.getByRole('button', { name: 'Ariza boshlash' }).click();
  const storeForm = page
    .getByRole('heading', { name: '3. Do‘kon yaratish' })
    .locator('..');
  await storeForm
    .getByPlaceholder('Do‘kon nomi')
    .fill(`Journey Store ${stamp}`);
  await storeForm
    .getByPlaceholder('username')
    .fill(`journey_store_${stamp}`.slice(0, 30));
  await storeForm.getByPlaceholder('ORDER PREFIX').fill(`J${stamp.slice(-6)}`);
  await storeForm.getByRole('button', { name: 'Yaratish' }).click();
  await expect(
    page.getByRole('heading', { name: `Journey Store ${stamp}` }),
  ).toBeVisible();
}

test('seller → admin → buyer → fulfillment → verified review journey', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-iphone' && process.platform === 'win32',
    'The Windows WebKit mobile runner stalls during the long multi-context transaction. iPhone layout and authenticated modules remain covered by the responsive suite.',
  );
  test.setTimeout(testInfo.project.name === 'mobile-iphone' ? 360_000 : 240_000);
  const database = new pg.Client({
    connectionString: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL,
  });
  await database.connect();
  const stamp = `${Date.now()}${testInfo.workerIndex}`;
  const sellerName = `journey_seller_${stamp}`.slice(0, 32);
  const buyerName = `journey_buyer_${stamp}`.slice(0, 32);
  const adminName = `journey_admin_${stamp}`.slice(0, 32);
  const productName = `Journey mahsulot ${stamp}`;
  const contexts: BrowserContext[] = [];
  const contextOptions =
    testInfo.project.name === 'mobile-iphone'
      ? devices['iPhone 13']
      : testInfo.project.name === 'mobile-android'
        ? devices['Pixel 7']
      : { viewport: { width: 1440, height: 900 } };
  const capture = async (page: Page, name: string) => {
    // Dedicated visual suites own device screenshots. Keeping transactional
    // evidence on Chromium avoids WebKit spending minutes serializing long pages.
    if (testInfo.project.name !== 'desktop-chromium') return;
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  };

  try {
    const sellerContext = await browser.newContext(contextOptions);
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
    await expect(wizard).toBeVisible();
    await capture(sellerPage, 'seller-wizard');
    await wizard.getByPlaceholder('Mahsulot nomi').fill(productName);
    await wizard
      .getByPlaceholder('Batafsil tavsif')
      .fill('E2E savdo yo‘li uchun haqiqiy sinov mahsuloti.');
    await wizard.getByPlaceholder('Kategoriya slug').fill('other');
    await wizard.getByRole('button', { name: 'Media bosqichi →' }).click();
    await wizard.getByRole('button', { name: 'Narx va variant →' }).click();
    await wizard.getByPlaceholder('Narx', { exact: true }).fill('189000');
    await wizard.getByPlaceholder('Soni').fill('5');
    await wizard.getByPlaceholder('SKU').fill(`SKU-${stamp}`);
    await wizard.getByRole('button', { name: 'Preview →' }).click();
    await wizard
      .getByRole('button', { name: 'Draft va mediani yaratish' })
      .click();

    const productCard = sellerPage
      .locator('article')
      .filter({ hasText: productName });
    await expect(productCard).toBeVisible();
    await productCard
      .locator('input[type=file][accept*="image/"]')
      .setInputFiles('apps/web/public/brand/resaller-cinematic-hero.webp');
    await expect(
      sellerPage.getByText('Rasm siqildi va thumbnail yaratildi.'),
    ).toBeVisible();
    await productCard
      .getByRole('button', { name: 'Moderatsiyaga yuborish' })
      .click();
    await expect(productCard).toContainText('PENDING_REVIEW');

    const adminContext = await browser.newContext(contextOptions);
    contexts.push(adminContext);
    const adminPage = await register(adminContext, ADMIN, adminName);
    await database.query(
      'UPDATE "User" SET roles = ARRAY[$1, $2]::"Role"[] WHERE username = $3',
      ['BUYER', 'MODERATOR', adminName],
    );
    await adminPage.reload();
    const moderationRow = adminPage
      .locator('article.queue-row')
      .filter({ hasText: productName });
    await expect(moderationRow).toBeVisible();
    await capture(adminPage, 'admin-moderation');
    await adminPage.getByRole('link', { name: 'Barcha modullar' }).click();
    await expect(
      adminPage.getByRole('heading', { name: 'Operatsion modullar' }),
    ).toBeVisible();
    await adminPage.getByRole('link', { name: 'Sharhlar' }).click();
    await expect(adminPage).toHaveURL(/\/operations#reviews$/);
    await expect(adminPage.getByRole('heading', { name: /Sharhlar \(/ })).toBeVisible();
    await capture(adminPage, 'admin-operations');
    await adminPage.goto(ADMIN);
    await moderationRow.getByRole('button', { name: 'Tasdiqlash' }).click();
    const decision = adminPage.getByRole('dialog', {
      name: 'Moderatsiya qarori',
    });
    await decision
      .locator('textarea')
      .fill('Mahsulot ma’lumotlari va rasmi tekshirildi.');
    await decision.getByRole('button', { name: 'Qarorni tasdiqlash' }).click();
    await expect(moderationRow).toHaveCount(0);

    const listing = await database.query<{ publicId: string }>(
      'SELECT "publicId" FROM "Listing" WHERE "nameUz" = $1',
      [productName],
    );
    const listingPublicId = listing.rows[0]?.publicId;
    expect(listingPublicId).toBeTruthy();

    const buyerContext = await browser.newContext(contextOptions);
    contexts.push(buyerContext);
    const buyerPage = await register(buyerContext, WEB, buyerName);
    await buyerPage.getByRole('button', { name: 'AI yordamchini ochish' }).click();
    await buyerPage.getByLabel('Savolingiz').fill(`${productName} ni top`);
    await buyerPage.getByRole('button', { name: 'Yordam so‘rash' }).click();
    await expect(
      buyerPage.locator('.ai-assistant__reply').getByRole('link', { name: new RegExp(productName) }),
    ).toBeVisible();
    await buyerPage.locator('.ai-assistant__panel header button').click();
    await buyerPage.goto(
      `${WEB}/marketplace?q=${encodeURIComponent(productName)}`,
    );
    await buyerPage
      .getByRole('region', { name: 'Mahsulotlar' })
      .getByRole('link', { name: new RegExp(productName) })
      .click();
    await expect(buyerPage).toHaveURL(/\/product\//);
    await expect(
      buyerPage.getByRole('heading', { name: productName }),
    ).toBeVisible();
    const imageSrc = await buyerPage
      .locator('.product-gallery img')
      .first()
      .getAttribute('src');
    expect(imageSrc).toBeTruthy();
    const imageResponse = await buyerPage.request.get(imageSrc!);
    expect(imageResponse.status(), await imageResponse.text()).toBe(200);
    expect(imageResponse.headers()['content-type']).toContain('image/webp');
    expect(imageResponse.headers()['cross-origin-resource-policy']).toBe(
      'cross-origin',
    );
    expect((await imageResponse.body()).length).toBeGreaterThan(0);
    const browserImage = await buyerPage.evaluate(async (src) => {
      const response = await fetch(src);
      return {
        status: response.status,
        type: response.headers.get('content-type'),
        size: (await response.arrayBuffer()).byteLength,
      };
    }, imageSrc!);
    expect(browserImage.status).toBe(200);
    expect(browserImage.type).toContain('image/webp');
    expect(browserImage.size).toBeGreaterThan(0);
    await expect
      .poll(() =>
        buyerPage
          .locator('.product-gallery img')
          .first()
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await capture(buyerPage, 'buyer-product');
    await buyerPage.getByRole('button', { name: 'Savatga qo‘shish' }).click();
    await expect(
      buyerPage.getByRole('button', { name: 'Savatga qo‘shildi ✓' }),
    ).toBeVisible();
    await buyerPage.goto(`${WEB}/cart`);
    await capture(buyerPage, 'buyer-cart');
    await buyerPage.getByPlaceholder('Ism va familiya').fill('Journey Buyer');
    await buyerPage.getByPlaceholder('Telefon').fill('+998901234567');
    await buyerPage.getByPlaceholder('Viloyat / shahar').fill('Toshkent');
    await buyerPage
      .getByPlaceholder('To‘liq manzil')
      .fill('Amir Temur ko‘chasi 1');
    await buyerPage.getByRole('button', { name: 'Buyurtma berish' }).click();
    await buyerPage.getByRole('link', { name: 'Buyurtmani kuzatish' }).click();
    await expect(buyerPage.getByRole('timer')).toContainText('60 daqiqada');
    await buyerPage
      .getByPlaceholder('Xabar yozing…')
      .fill('Assalomu alaykum, buyurtmam qachon jo‘natiladi?');
    await buyerPage.getByRole('button', { name: 'Yuborish' }).click();
    await expect(
      buyerPage.getByText('Assalomu alaykum, buyurtmam qachon jo‘natiladi?'),
    ).toBeVisible();
    await capture(buyerPage, 'buyer-order-chat');
    const orderUrl = buyerPage.url();
    expect(orderUrl).toContain('/orders/');
    if (testInfo.project.name === 'desktop-chromium') {
      const orderPublicId = new URL(orderUrl).pathname.split('/').pop();
      expect(orderPublicId).toBeTruthy();
      await verifyAuthenticatedSseLoad(buyerContext, orderPublicId!);
    }

    await sellerPage.goto(`${WEB}/seller`);
    await sellerPage.getByRole('button', { name: 'Qabul qilish' }).click();
    await sellerPage.goto(orderUrl);
    for (const status of [
      'PREPARING',
      'READY',
      'SHIPPED',
      'DELIVERED',
      'COMPLETED',
    ]) {
      const transitionPending = sellerPage.waitForResponse((response) =>
        response.url().endsWith('/transition') && response.request().method() === 'POST',
      );
      await sellerPage
        .getByRole('button', {
          name: `${orderStatusLabel(status)} holatiga o‘tkazish`,
        })
        .click();
      const transitionResponse = await transitionPending;
      expect(transitionResponse.ok(), await transitionResponse.text()).toBe(true);
      await expect(
        sellerPage.getByText(orderStatusLabel(status), { exact: true }).first(),
      ).toBeVisible();
    }

    await buyerPage.reload();
    await buyerPage.getByRole('button', { name: 'Sharh yozish' }).click();
    await buyerPage.getByLabel('Baho').selectOption('5');
    await buyerPage
      .getByLabel('Sharh')
      .fill('Mahsulot va buyurtma jarayoni juda yaxshi ishladi.');
    const reviewResponsePending = buyerPage.waitForResponse((response) =>
      response.url().endsWith('/review') && response.request().method() === 'POST',
    );
    await buyerPage.getByRole('button', { name: 'Sharhni yuborish' }).click();
    const reviewResponse = await reviewResponsePending;
    expect(reviewResponse.status(), await reviewResponse.text()).toBe(201);
    await expect(
      buyerPage.getByRole('button', { name: 'Sharh yozish' }),
    ).toHaveCount(0);
    await buyerPage.goto(`${WEB}/product/${listingPublicId}`);
    await expect(
      buyerPage.getByText('Mahsulot va buyurtma jarayoni juda yaxshi ishladi.'),
    ).toBeVisible();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await database.end();
  }
});
