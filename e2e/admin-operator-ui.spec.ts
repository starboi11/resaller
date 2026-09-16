import { expect, test } from '@playwright/test';

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

  await page.goto('http://localhost:3001/operations');
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

  await page.goto('http://localhost:3001');
  await expect(page.getByText('Test Seller LLC')).toBeVisible();
  await page.getByRole('button', { name: 'Tasdiqlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Moderatsiya qarori' });
  await dialog.getByRole('textbox').fill('Hujjat va rekvizitlar mos keldi');
  await dialog.getByRole('button', { name: 'Qarorni tasdiqlash' }).click();
  await expect.poll(() => decisionBody?.status).toBe('APPROVED');
});
