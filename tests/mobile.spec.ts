import { expect, test } from '@playwright/test';

/**
 * Mobile tests that check whether the phone experience is any *good*, not just
 * whether it fits. The previous suite only asserted "no horizontal overflow",
 * which a page can pass while being unusable — the timeline collapsed into a
 * column of identical grey boxes with no dates and still passed.
 */

test.describe('mobile: the timeline stays a chart', () => {
  test('keeps its year scale instead of collapsing to a list', async ({ page }) => {
    await page.goto('/work');

    const scale = page.locator('.tl-scale');
    await expect(scale, 'the year axis is what makes it a timeline').toBeVisible();
    await expect(page.locator('.tl-year').first()).toBeVisible();
  });

  test('scrolls horizontally rather than squashing', async ({ page }) => {
    await page.goto('/work');

    const metrics = await page.evaluate(() => {
      const s = document.querySelector('.tl-scroll') as HTMLElement;
      return { scrollWidth: s.scrollWidth, clientWidth: s.clientWidth };
    });
    expect(metrics.scrollWidth, 'chart is wider than the phone').toBeGreaterThan(
      metrics.clientWidth,
    );
  });

  test('opens on the present, not on the empty left edge', async ({ page }) => {
    await page.goto('/work');
    await page.waitForTimeout(400);

    const { scrollLeft, max } = await page.evaluate(() => {
      const s = document.querySelector('.tl-scroll') as HTMLElement;
      return { scrollLeft: s.scrollLeft, max: s.scrollWidth - s.clientWidth };
    });
    // The earliest years are nearly empty; landing there shows a blank chart.
    expect(scrollLeft).toBeGreaterThan(max * 0.5);
  });

  test('bars still carry readable labels', async ({ page }) => {
    await page.goto('/work');

    const widths = await page.evaluate(() =>
      [...document.querySelectorAll('.tl-bar')].map((b) => b.getBoundingClientRect().width),
    );
    // A bar under ~60px shows two characters and an ellipsis, which is useless.
    expect(Math.min(...widths), 'narrowest bar is still legible').toBeGreaterThan(55);
  });
});

test.describe('mobile: hierarchy and readability', () => {
  test('the name comes before the portrait', async ({ page }) => {
    await page.goto('/');

    const nameFirst = await page.evaluate(() => {
      const h1 = document.querySelector('main h1');
      const img = document.querySelector('.portrait-img');
      if (!h1 || !img) return null;
      // 4 === DOCUMENT_POSITION_FOLLOWING: the image comes after the heading.
      return Boolean(h1.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(nameFirst, 'a phone should not open on an unnamed photo').toBe(true);
  });

  test('no body text is smaller than 11px', async ({ page }) => {
    for (const route of ['/', '/work', '/reading', '/endurance']) {
      await page.goto(route);
      const tooSmall = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of document.querySelectorAll('p, li, a, span, dd, dt')) {
          if ((el.textContent ?? '').trim().length < 8) continue;
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          if (parseFloat(style.fontSize) < 11) bad.push(el.className || el.tagName);
        }
        return bad;
      });
      expect(tooSmall, `${route} has text under 11px`).toEqual([]);
    }
  });

  test('the hero fits without endless scrolling', async ({ page }) => {
    await page.goto('/');

    // The tagline is the payoff; it should be reachable in roughly one swipe.
    const taglineTop = await page.evaluate(() => {
      const el = [...document.querySelectorAll('main p')].find((p) =>
        p.textContent?.includes('Good ideas are everywhere'),
      );
      return el ? el.getBoundingClientRect().top + window.scrollY : Infinity;
    });
    expect(taglineTop).toBeLessThan(1200);
  });
});
