import { expect, test } from '@playwright/test';

test('buyer can use the clearly labelled grounded assistant', async ({
  page,
}) => {
  await page.route('**/api/v1/assistant/message', async (route) => {
    const body = route.request().postDataJSON() as {
      mode: string;
      message: string;
    };
    expect(body).toMatchObject({
      mode: 'DISCOVER',
      message: 'Ishonchli telefon top',
    });
    await route.fulfill({
      json: {
        status: 'OK',
        answer: 'Siz uchun 1 ta faol mahsulot topdim.',
        sources: [
          {
            type: 'PRODUCT',
            id: 'phone-1',
            title: 'Smartfon Pro',
            href: '/product/phone-1',
            detail: '1 800 000 UZS · Ishonchli do‘kon',
          },
        ],
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /AI yordamchi/ }).click();
  await expect(
    page.getByText(/order, stock yoki rolni o‘zgartirmaydi/i),
  ).toBeVisible();
  await page
    .getByPlaceholder(/ishonchli telefon/i)
    .fill('Ishonchli telefon top');
  await page.getByRole('button', { name: 'Yordam so‘rash' }).click();
  await expect(
    page.getByText('Siz uchun 1 ta faol mahsulot topdim.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Smartfon Pro/ })).toBeVisible();
});
