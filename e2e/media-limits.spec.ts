import { expect, test } from '@playwright/test';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { testDatabaseUrl } from './helpers/test-database';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';
// The API rejects state-changing requests without a trusted Origin. Playwright's
// APIRequestContext does not add one, so these direct calls send it explicitly.
const WEB_ORIGIN = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const browserHeaders = { origin: WEB_ORIGIN };
test('variant field after image is saved and product video may exceed the image limit', async ({ page }, info) => {
  const database = new pg.Client({ connectionString: testDatabaseUrl() });
  await database.connect();
  const username = `media_${Date.now()}${info.workerIndex}`;
  let userId: string | undefined, storeId: string | undefined, listingId: string | undefined;
  try {
    const registered = await page.request.post(`${API}/auth/register`, { headers: browserHeaders, data: { username, password: 'Media-Test-2026' } });
    expect(registered.status()).toBe(201);
    const user = await database.query('SELECT id FROM "User" WHERE username=$1', [username]);
    userId = user.rows[0].id;
    const seller = await database.query('INSERT INTO "SellerProfile" (id,"userId","verifiedAt") VALUES (gen_random_uuid(),$1,now()) RETURNING id', [userId]);
    const store = await database.query('INSERT INTO "Store" (id,"publicId","sellerProfileId",username,"nameUz","orderPrefix","updatedAt",status) VALUES (gen_random_uuid(),$1,$2,$1,$1,$3,now(),\'ACTIVE\') RETURNING id', [username, seller.rows[0].id, `M${Date.now().toString().slice(-6)}`]);
    storeId = store.rows[0].id;
    const category = await database.query('INSERT INTO "Category" (id,slug,"nameUz") VALUES (gen_random_uuid(),\'media-test\',\'Media test\') ON CONFLICT (slug) DO UPDATE SET "nameUz"=EXCLUDED."nameUz" RETURNING id');
    const listing = await database.query('INSERT INTO "Listing" (id,"publicId","storeId","categoryId","nameUz","descriptionUz","priceMinor","updatedAt") VALUES (gen_random_uuid(),$1,$2,$3,$1,\'Upload regression\',10000,now()) RETURNING id', [username, storeId, category.rows[0].id]);
    listingId = listing.rows[0].id;
    const variant = await database.query('INSERT INTO "ListingVariant" (id,"listingId",sku,options) VALUES (gen_random_uuid(),$1,$2,\'{}\') RETURNING id', [listingId, username]);
    const variantId = variant.rows[0].id;
    const uploaded = await page.request.post(`${API}/media/listings/${username}/images`, {
      headers: browserHeaders,
      multipart: { file: { name: 'image.webp', mimeType: 'image/webp', buffer: readFileSync('apps/web/public/brand/resaller-cinematic-hero.webp') }, variantId },
    });
    expect(uploaded.status(), await uploaded.text()).toBe(201);
    expect((await uploaded.json()).variantId).toBe(variantId);
    const video = Buffer.alloc(6 * 1024 * 1024);
    video.write('ftypisom', 4, 'ascii');
    const uploadedVideo = await page.request.post(`${API}/media/listings/${username}/video`, {
      headers: browserHeaders,
      multipart: { file: { name: 'limit-fixture.mp4', mimeType: 'video/mp4', buffer: video } },
    });
    expect(uploadedVideo.status(), await uploadedVideo.text()).toBe(201);
    expect((await uploadedVideo.json()).storageKey).toMatch(/\.mp4$/);
    const tooLargeImage = await page.request.post(`${API}/media/listings/${username}/images`, {
      headers: browserHeaders,
      multipart: { file: { name: 'too-large.webp', mimeType: 'image/webp', buffer: video } },
    });
    expect(tooLargeImage.status()).toBe(413);
  } finally {
    if (listingId) await database.query('DELETE FROM "Listing" WHERE id=$1', [listingId]);
    if (storeId) await database.query('DELETE FROM "Store" WHERE id=$1', [storeId]);
    if (userId) {
      await database.query('DELETE FROM "SellerProfile" WHERE "userId"=$1', [userId]);
      await database.query('DELETE FROM "User" WHERE id=$1', [userId]);
    }
    await database.end();
  }
});
