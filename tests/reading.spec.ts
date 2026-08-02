import { expect, test } from '@playwright/test';

test.describe('bookshelf', () => {
  test('shows every book by default and filters to one shelf', async ({ page }) => {
    await page.goto('/reading');

    const spines = page.locator('.shelf-item');
    const total = await spines.count();
    expect(total).toBeGreaterThan(20);
    await expect(spines.filter({ visible: true })).toHaveCount(total);

    await page.getByRole('button', { name: /Business & strategy/ }).click();

    const visible = await page.locator('.shelf-item:visible').count();
    expect(visible).toBeGreaterThan(0);
    expect(visible, 'filtering actually hides other shelves').toBeLessThan(total);

    await page.getByRole('button', { name: /Everything/ }).click();
    await expect(page.locator('.shelf-item:visible')).toHaveCount(total);
  });

  test('selecting a spine shows its title and author', async ({ page }) => {
    await page.goto('/reading');

    await page.locator('.spine').first().click();
    const detail = page.locator('[data-shelf-detail]');
    await expect(detail).toContainText(/\w/);
    await expect(detail.locator('strong')).not.toBeEmpty();
  });

  test('every book is readable without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/reading');

    // No JS means no filtering — which must mean everything shows, not nothing.
    const count = await page.locator('.shelf-item').count();
    expect(count).toBeGreaterThan(20);
    await expect(page.locator('.shelf-item').first()).toBeVisible();
    await context.close();
  });
});
