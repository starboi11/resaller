import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const publicRoutes = [
  '/',
  '/marketplace',
  '/categories',
  '/login',
  '/recovery',
];

for (const route of publicRoutes) {
  test(`${route} has no serious WCAG A/AA violations`, async ({ page }) => {
    await page.goto(route);
    await page.locator('nextjs-portal').evaluateAll((nodes) =>
      nodes.forEach((node) => node.remove()),
    );
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = result.violations.filter(({ impact }) =>
      impact === 'serious' || impact === 'critical',
    );
    expect(
      blocking.map(({ id, impact, help, nodes }) => ({
        id,
        impact,
        help,
        targets: nodes.map((node) => node.target),
      })),
    ).toEqual([]);
  });
}
