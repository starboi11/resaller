import { expect, test } from '@playwright/test';

const ADMIN = process.env.E2E_ADMIN_URL ?? 'http://localhost:3001';

const roles = [
  'SUPER_ADMIN',
  'SECURITY_ADMIN',
  'DISPUTE_ADMIN',
  'SUPPORT_ADMIN',
  'MODERATOR',
  'VERIFICATION_ADMIN',
];

test('admin operator can inspect and resolve risk, security and dispute records', async ({
  page,
}) => {
  const reviewed = new Set<string>();
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { user: { username: 'operator', roles } } }),
  );
  await page.route('**/api/v1/admin/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'PATCH') {
      reviewed.add(path);
      return route.fulfill({ json: { ok: true } });
    }
    if (path.endsWith('/listings'))
      return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 50 } });
    if (path.endsWith('/risk-events'))
      return route.fulfill({
        json: [
          {
            id: 'risk-1',
            subjectType: 'STORE',
            subjectId: 'store-1',
            signal: 'ORDER_SPIKE',
            score: 86,
            metadata: { ordersInHour: 41, baseline: 4 },
            createdAt: '2026-09-16T10:00:00.000Z',
          },
        ],
      });
    if (path.endsWith('/security-events'))
      return route.fulfill({
        json: [
          {
            id: 'security-1',
            type: 'LOGIN_BRUTE_FORCE',
            severity: 'HIGH',
            ipHash: 'masked-ip-hash',
            metadata: { attempts: 18 },
            createdAt: '2026-09-16T10:05:00.000Z',
          },
        ],
      });
    if (path.endsWith('/disputes'))
      return route.fulfill({
        json: [
          {
            id: 'dispute-1',
            status: 'OPEN',
            reason: 'Mahsulot tavsifga mos emas',
            evidence: [
              {
                id: 'evidence-1',
                fileName: 'buyer-photo.jpg',
                mimeType: 'image/jpeg',
              },
            ],
          },
        ],
      });
    return route.fulfill({ json: [] });
  });

  await page.goto(`${ADMIN}/operations`);
  await expect(
    page.getByRole('heading', { name: 'Operatsion modullar' }),
  ).toBeVisible();

  await page.getByRole('button', { name: /Risk signallari/ }).click();
  await expect(page.getByText('ORDER_SPIKE')).toBeVisible();
  await page.getByRole('button', { name: 'Tafsilotlarni ko‘rish' }).click();
  await expect(
    page.getByRole('heading', { name: 'Operator tekshiruvi' }),
  ).toBeVisible();
  await expect(page.getByText('ordersInHour')).toBeVisible();
  await page.getByRole('button', { name: 'Yopish' }).click();
  await page.getByRole('button', { name: 'Moderatsiya' }).click();
  await page
    .getByPlaceholder('Kamida 10 belgili asos')
    .fill('Risk signali qo‘lda tekshirildi');
  await page.getByRole('button', { name: 'Tasdiqlash' }).click();
  await expect
    .poll(() => reviewed.has('/api/v1/admin/risk-events/risk-1/review'))
    .toBe(true);

  await page.getByRole('button', { name: /Xavfsizlik/ }).click();
  await expect(page.getByText('LOGIN_BRUTE_FORCE')).toBeVisible();
  await page.getByRole('button', { name: 'Hal qilish' }).click();
  await page
    .getByPlaceholder('Kamida 10 belgili asos')
    .fill('Shubhali urinishlar bloklandi');
  await page.getByRole('button', { name: 'Tasdiqlash' }).click();
  await expect
    .poll(() =>
      reviewed.has('/api/v1/admin/security-events/security-1/resolve'),
    )
    .toBe(true);

  await page.getByRole('button', { name: /Nizolar/ }).click();
  await page.getByRole('button', { name: 'Tafsilotlarni ko‘rish' }).click();
  await expect(
    page.getByRole('link', { name: /buyer-photo.jpg/ }),
  ).toBeVisible();
});

test('verification queue uses a reasoned confirmation dialog', async ({
  page,
}) => {
  let decisionBody: Record<string, unknown> | null = null;
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { user: { username: 'owner', roles: ['SUPER_ADMIN'] } } }));
  await page.route('**/api/v1/admin/overview', (route) => route.fulfill({ json: {
    metrics: { visitorsToday: 2, visitorDays30: 4, pageViews30: 7, ordersPlaced: 1, ordersCompleted: 0, storesActive: 1, listingsPublished: 1, listingsTotal: 2 },
    recentAudit: [], recentOrders: [], recentListings: [],
  } }));
  await page.route('**/api/v1/admin/queue', (route) =>
    route.fulfill({
      json: {
        stores: [],
        listings: [],
        openDisputes: 0,
        securityEvents24h: 0,
        verifications: [
          {
            id: 'verification-1',
            legalName: 'Test Seller LLC',
            documentType: 'BUSINESS_REGISTRATION',
            documentNumberMasked: '****3901',
            documentAvailable: true,
            sellerProfile: { user: { username: 'test_seller' } },
          },
        ],
      },
    }),
  );
  await page.route(
    '**/api/v1/admin/verifications/verification-1/status',
    async (route) => {
      decisionBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ json: { ok: true } });
    },
  );

  await page.goto(`${ADMIN}/owner`);
  await expect(page.getByText('Test Seller LLC')).toBeVisible();
  await page.getByRole('button', { name: 'Tasdiqlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Moderatsiya qarori' });
  await dialog.getByRole('textbox').fill('Hujjat va rekvizitlar mos keldi');
  await dialog.getByRole('button', { name: 'Qarorni tasdiqlash' }).click();
  await expect.poll(() => decisionBody?.status).toBe('APPROVED');
});

test('owner sees all seller posts and can restrict after publication', async ({ page }) => {
  let restriction: Record<string, unknown> | null = null;
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { user: { roles: ['SUPER_ADMIN'] } } }));
  await page.route('**/api/v1/admin/**', (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'PATCH') {
      restriction = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ json: { publicId: 'post-1', status: 'RESTRICTED' } });
    }
    if (url.pathname.endsWith('/listings')) {
      const pageNumber = Number(url.searchParams.get('page') ?? 1);
      return route.fulfill({ json: {
        items: pageNumber === 1
          ? [{ publicId: 'post-1', nameUz: 'Faol mahsulot', status: 'ACTIVE', store: { username: 'seller-one', nameUz: 'Store', status: 'ACTIVE' } }]
          : [{ publicId: 'post-2', nameUz: 'Draft mahsulot', status: 'DRAFT', store: { username: 'seller-two', nameUz: 'Store 2', status: 'ACTIVE' } }],
        total: 2, page: pageNumber, pageSize: 1,
      } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(`${ADMIN}/operations#listings`);
  await expect(page.getByRole('heading', { name: 'Seller postlari (2)' })).toBeVisible();
  await expect(page.getByText('Faol mahsulot')).toBeVisible();
  await page.getByRole('button', { name: 'Yana postlarni yuklash' }).click();
  await expect(page.getByText('Draft mahsulot')).toBeVisible();
  await page.getByRole('button', { name: 'Cheklash' }).click();
  await page.getByPlaceholder('Kamida 10 belgili asos').fill('Siyosatga zid mahsulot');
  await page.getByRole('button', { name: 'Tasdiqlash' }).click();
  await expect.poll(() => restriction?.status).toBe('RESTRICTED');
});
