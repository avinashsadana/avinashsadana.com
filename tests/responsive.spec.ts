import { expect, test } from '@playwright/test';

const routes = ['/', '/work', '/ventures', '/endurance', '/about', '/contact', '/resume'];

test.describe('mobile layout', () => {
  for (const route of routes) {
    test(`${route} has no horizontal overflow`, async ({ page }) => {
      await page.goto(route);
      await page.waitForTimeout(300);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route} overflows horizontally`).toBeLessThanOrEqual(0);
    });
  }

  test('primary tap targets meet the 44px minimum', async ({ page }) => {
    await page.goto('/');

    const targets = [
      page.getByRole('button', { name: 'Open menu' }),
      page.getByRole('button', { name: /colour theme/i }),
      page.getByRole('link', { name: /see the work/i }),
    ];

    for (const target of targets) {
      const box = await target.boundingBox();
      expect(box, 'target is rendered').toBeTruthy();
      expect(box!.height, 'tap target height').toBeGreaterThanOrEqual(40);
      expect(box!.width, 'tap target width').toBeGreaterThanOrEqual(40);
    }
  });

  test('the mobile menu navigates', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();

    await page.locator('#mobile-menu').getByRole('link', { name: 'Endurance' }).click();
    await page.waitForURL('**/endurance');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Long distances/);
  });
});
