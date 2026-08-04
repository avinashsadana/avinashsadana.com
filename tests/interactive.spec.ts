import { expect, test } from '@playwright/test';
import { cleanup, contactMessageExists, db, guestbookEntry } from './helpers/db';

/** Unique per run so assertions never collide with a previous run's rows. */
const stamp = () => `pw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Tests that need a real backend are skipped when credentials are absent rather
 * than failed. Without them the API routes correctly answer 503, so failing
 * would only be reporting "CI has no database" over and over — which is true,
 * expected, and not a defect in the site.
 */
const hasDb = () => db() !== null;
const needsBackend = () =>
  test.skip(!hasDb(), 'needs Supabase credentials — set them as repository secrets to run');

test.describe('theme', () => {
  test('toggling persists across a client-side navigation', async ({ page }) => {
    await page.goto('/');

    // The handler is attached when its module runs; clicking before that is a
    // no-op. Waiting on the bound marker removes the race instead of sleeping.
    await expect(page.locator('#theme-toggle')).toHaveAttribute('data-bound', 'true');

    const before = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );

    await page.getByRole('button', { name: /colour theme/i }).click();
    const after = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(after).toBe(!before);

    await page.getByRole('link', { name: 'Ventures', exact: true }).first().click();
    await page.waitForURL('**/ventures');

    const afterNavigation = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(afterNavigation, 'theme survives navigation').toBe(after);

    const stored = await page.evaluate(() => localStorage.getItem('theme'));
    expect(stored).toBe(after ? 'dark' : 'light');
  });
});

test.describe('share buttons', () => {
  test('encode the current page URL correctly for each network', async ({ page }) => {
    await page.goto('/ventures/cycle-n-chai');

    const encoded = encodeURIComponent('https://avinashsadana.com/ventures/cycle-n-chai');

    const linkedIn = page.getByRole('link', { name: 'Share on LinkedIn' });
    await expect(linkedIn).toHaveAttribute('href', new RegExp(encoded));

    const whatsapp = page.getByRole('link', { name: 'Share on WhatsApp' });
    await expect(whatsapp).toHaveAttribute('href', new RegExp(encoded));

    const facebook = page.getByRole('link', { name: 'Share on Facebook' });
    await expect(facebook).toHaveAttribute('href', new RegExp(encoded));

    // Every share target must open away from the site safely.
    for (const link of [linkedIn, whatsapp, facebook]) {
      await expect(link).toHaveAttribute('rel', /noopener/);
      await expect(link).toHaveAttribute('target', '_blank');
    }
  });

  test('the native share button appears only when the browser supports it', async ({ page }) => {
    await page.goto('/endurance');
    const native = page.locator('[data-share-native]');

    const supported = await page.evaluate(() => typeof navigator.share === 'function');
    if (supported) {
      await expect(native).toBeVisible();
    } else {
      await expect(native).toBeHidden();
    }
  });
});

test.describe('contact form', () => {
  test('rejects a bad email before it ever hits the network', async ({ page }) => {
    await page.goto('/contact');

    await page.fill('#name', 'Test Person');
    await page.fill('#email', 'not-an-email');
    await page.fill('#message', 'This message is definitely long enough to pass.');

    let requestMade = false;
    page.on('request', (request) => {
      if (request.url().includes('/api/contact')) requestMade = true;
    });

    await page.getByRole('button', { name: /send message/i }).click();

    await expect(page.locator('#email-error')).toBeVisible();
    await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true');
    expect(requestMade, 'no request for a client-side validation failure').toBe(false);
  });

  test('submits successfully and stores the message', async ({ page }) => {
    needsBackend();
    const marker = stamp();
    await page.goto('/contact');

    await page.fill('#name', 'Playwright Probe');
    await page.fill('#email', 'probe@example.com');
    await page.fill('#subject', `Test ${marker}`);
    await page.fill('#message', `Automated test message ${marker}. Please ignore.`);

    // The server rejects anything submitted in under three seconds as automated.
    await page.waitForTimeout(3200);

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/contact')),
      page.getByRole('button', { name: /send message/i }).click(),
    ]);

    expect(response.status()).toBe(200);
    await expect(page.locator('[data-form-status]')).toContainText(/on its way/i);
    await expect(page.locator('#name')).toHaveValue('');

    // Confirm it is genuinely persisted, not just optimistically reported.
    expect(await contactMessageExists(marker), 'message row exists in the database').toBe(true);
    await cleanup(marker);
  });

  test('silently absorbs a honeypot submission without storing it', async ({ page }) => {
    needsBackend();
    const marker = stamp();
    await page.goto('/contact');

    await page.fill('#name', 'Spam Bot');
    await page.fill('#email', 'bot@example.com');
    await page.fill('#message', `Honeypot probe ${marker} which is long enough.`);
    // Only an automated client fills the off-screen field.
    await page.fill('#company', 'Definitely A Bot Inc');

    await page.waitForTimeout(3200);

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/contact')),
      page.getByRole('button', { name: /send message/i }).click(),
    ]);

    // The bot is told everything is fine — telling it otherwise teaches it.
    expect(response.status()).toBe(200);

    expect(await contactMessageExists(marker), 'honeypot submission was NOT stored').toBe(false);
  });
});

test.describe('guestbook', () => {
  test('a new entry is stored unapproved and stays off the public page', async ({
    page,
    request,
  }) => {
    needsBackend();
    const marker = stamp();
    await page.goto('/guestbook');

    await page.fill('#name', 'Playwright Guest');
    await page.fill('#role', 'Automated test');
    await page.fill('#message', `Guestbook probe ${marker}`);

    await page.waitForTimeout(3200);

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/guestbook')),
      page.getByRole('button', { name: /sign the guestbook/i }).click(),
    ]);

    expect(response.status()).toBe(200);
    await expect(page.locator('[data-form-status]')).toContainText(/review/i);

    // The public list must not show it.
    const publicList = await request.get('/api/guestbook');
    const body = await publicList.json();
    const messages = (body.entries ?? []).map((entry: { message: string }) => entry.message);
    expect(messages, 'unapproved entry is not public').not.toContain(`Guestbook probe ${marker}`);

    await page.reload();
    await expect(page.locator('body')).not.toContainText(marker);

    // And confirm the row exists but is flagged unapproved.
    const row = await guestbookEntry(marker);
    expect(row, 'entry was stored').toBeTruthy();
    expect(row!.approved, 'entry is stored unapproved').toBe(false);
    await cleanup(marker);
  });
});

test.describe('view counter', () => {
  test('increments and renders a number', async ({ page }) => {
    needsBackend();
    await page.goto('/about');

    const response = await page.waitForResponse((r) => r.url().includes('/api/views'));
    expect(response.status()).toBe(200);

    const first = (await response.json()).count as number | null;
    expect(typeof first === 'number' || first === null).toBe(true);

    if (typeof first === 'number') {
      await expect(page.locator('[data-view-counter]')).toBeVisible();

      const second = await page.evaluate(async () => {
        const r = await fetch('/api/views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '/about' }),
        });
        return (await r.json()).count as number;
      });
      expect(second, 'count increases').toBeGreaterThan(first);
    }
  });

  test('refuses a path that the site does not serve', async ({ request }) => {
    const response = await request.post('/api/views', {
      data: { path: '/../../etc/passwd' },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(422);
  });
});

test.describe('api hardening', () => {
  test('rejects non-POST methods', async ({ request }) => {
    const response = await request.get('/api/contact', { failOnStatusCode: false });
    expect(response.status()).toBe(405);
  });

  test('rejects an empty contact submission with a field-specific error', async ({ request }) => {
    const response = await request.post('/api/contact', {
      data: { name: '', email: '', message: '' },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(422);
    expect((await response.json()).field).toBe('name');
  });

  test('moderation endpoint refuses unauthenticated callers', async ({ request }) => {
    const response = await request.post('/api/admin/moderate', {
      data: { id: '00000000-0000-0000-0000-000000000000', action: 'approve' },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(401);
  });

  test('admin login rejects a wrong password', async ({ request }) => {
    test.skip(!process.env.ADMIN_PASSWORD, 'needs ADMIN_PASSWORD set');
    const response = await request.post('/api/admin/login', {
      data: { password: 'definitely-not-the-password' },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('accessibility basics', () => {
  test('skip link works and focus is visible', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(focused).toBe('Skip to content');
  });

  test('every image has alt text', async ({ page }) => {
    for (const route of ['/', '/work', '/about', '/ventures']) {
      await page.goto(route);
      const missing = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll('img')).filter((img) => !img.hasAttribute('alt'))
            .length,
      );
      expect(missing, `${route} images without alt`).toBe(0);
    }
  });

  test('the mobile menu opens, closes on Escape, and returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const toggle = page.getByRole('button', { name: 'Open menu' });
    await toggle.click();
    await expect(page.locator('#mobile-menu')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-menu')).toBeHidden();
    await expect(toggle).toBeFocused();
  });
});
