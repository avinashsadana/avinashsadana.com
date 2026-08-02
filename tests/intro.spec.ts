import { expect, test } from '@playwright/test';

/**
 * The intro overlay is the one thing on the site that deliberately covers the
 * page. These tests exist so it can never become a way to get stuck.
 */
test.describe('intro animation', () => {
  test('clears itself and leaves the page usable', async ({ page }) => {
    await page.goto('/');

    // Generous: the animation finishes ~1.1s after the stylesheet applies.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const el = document.querySelector('.preloader');
            return !el || getComputedStyle(el).visibility === 'hidden';
          }),
        { timeout: 6000, message: 'intro overlay never cleared' },
      )
      .toBe(true);

    // And the page underneath is genuinely interactive afterwards.
    await page.getByRole('link', { name: /see the work/i }).click();
    await page.waitForURL('**/work');
  });

  test('never blocks clicks even while it is on screen', async ({ page }) => {
    await page.goto('/');
    const pointerEvents = await page.evaluate(() => {
      const el = document.querySelector('.preloader');
      return el ? getComputedStyle(el).pointerEvents : 'absent';
    });
    // 'none' means a click during the animation still reaches the page.
    expect(['none', 'absent']).toContain(pointerEvents);
  });

  test('plays once per session, not on every page', async ({ page }) => {
    await page.goto('/');
    await page.goto('/about');
    const done = await page.evaluate(() =>
      document.documentElement.classList.contains('intro-done'),
    );
    expect(done, 'second load in the same session skips the intro').toBe(true);
  });

  test('is never shown to visitors who asked for reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');

    const display = await page.evaluate(() => {
      const el = document.querySelector('.preloader');
      return el ? getComputedStyle(el).display : 'absent';
    });
    expect(['none', 'absent']).toContain(display);
    await context.close();
  });
});
