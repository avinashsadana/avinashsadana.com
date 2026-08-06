import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { db } from './helpers/db';

/**
 * Sending is the one action on this site that cannot be undone, so these tests
 * are about what must never happen: sending without being signed in, sending
 * the same article twice, and an unsubscribe link that does not work.
 */

const hasDb = () => db() !== null;
const needsBackend = () => test.skip(!hasDb(), 'needs Supabase credentials');

test.describe('newsletter: nothing sends without authorisation', () => {
  test('the send endpoint refuses an unauthenticated caller', async ({ request }) => {
    const response = await request.post('/api/admin/newsletter', {
      data: { action: 'send', slug: 'bikepacking-what-you-carry' },
      failOnStatusCode: false,
    });
    expect(response.status(), 'must not be reachable without signing in').toBe(401);
  });

  test('preview is equally protected', async ({ request }) => {
    const response = await request.post('/api/admin/newsletter', {
      data: { action: 'preview', slug: 'bikepacking-what-you-carry' },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(401);
  });

  test('the scheduled job refuses an unsigned request', async ({ request }) => {
    const response = await request.get('/api/cron/newsletter', { failOnStatusCode: false });
    // 401 when CRON_SECRET is set. Never 200 to an anonymous caller in production.
    expect([401, 503]).toContain(response.status());
  });
});

test.describe('newsletter: unsubscribe always works', () => {
  test('a bad token fails safely rather than erroring', async ({ page }) => {
    await page.goto('/api/unsubscribe?token=not-a-real-token-at-all');
    await expect(page).toHaveURL(/\/unsubscribed\?status=invalid/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('one-click POST always answers 200 for mail providers', async ({ request }) => {
    // Gmail and Outlook POST here directly. An error status would make them
    // report the unsubscribe as broken to the recipient.
    const response = await request.post('/api/unsubscribe?token=whatever', {
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(200);
  });

  test('a real token unsubscribes, and only that subscriber', async ({ page }) => {
    needsBackend();
    const supabase = db()!;
    const email = `pw-unsub-${Date.now()}@example.com`;

    const { data: created } = await supabase
      .from('newsletter_subscribers')
      .insert({ email, status: 'confirmed', confirm_token: `pw${Date.now()}confirmtoken` })
      .select('unsubscribe_token')
      .single();

    await page.goto(`/api/unsubscribe?token=${created!.unsubscribe_token}`);
    await expect(page).toHaveURL(/status=ok/);

    const { data: after } = await supabase
      .from('newsletter_subscribers')
      .select('status')
      .eq('email', email)
      .single();
    expect(after!.status, 'that subscriber is unsubscribed').toBe('unsubscribed');

    await supabase.from('newsletter_subscribers').delete().eq('email', email);
  });
});

test.describe('newsletter: an article cannot be sent twice', () => {
  test('the database refuses a second live send record for one article', async () => {
    needsBackend();
    const supabase = db()!;
    const slug = `pw-guard-${Date.now()}`;

    const first = await supabase
      .from('newsletter_sends')
      .insert({ post_slug: slug, subject: 'First', status: 'sent' });
    expect(first.error, 'first send record is accepted').toBeNull();

    const second = await supabase
      .from('newsletter_sends')
      .insert({ post_slug: slug, subject: 'Second', status: 'sending' });
    expect(second.error, 'a second send for the same article is rejected').not.toBeNull();

    await supabase.from('newsletter_sends').delete().eq('post_slug', slug);
  });
});

test.describe('cross-origin protection', () => {
  test('a cross-site form POST to a write endpoint is still refused', async ({ request }) => {
    // The unsubscribe exemption must not have opened up everything else.
    const response = await request.post('/api/contact', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', origin: 'https://evil.test' },
      data: 'name=x&email=x@example.com&message=hello+there+friend',
      failOnStatusCode: false,
    });
    expect(response.status(), 'cross-site form POST is blocked').toBe(403);
  });

  test('the guestbook is protected the same way', async ({ request }) => {
    const response = await request.post('/api/guestbook', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', origin: 'https://evil.test' },
      data: 'name=x&message=hello+there',
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(403);
  });
});

test.describe('drafts stay private', () => {
  test('a draft never appears in the public feed or listing', async ({ request }) => {
    // Articles live in the database now, so this is the check that matters:
    // every item the feed carries must also be on the public writing page.
    const feed = await (await request.get('/rss.xml')).text();
    const listing = await (await request.get('/writing')).text();

    for (const title of [...feed.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)]
      .map((m) => m[1])
      .slice(1)) {
      expect(listing, `"${title}" is in the feed but not on /writing`).toContain(title);
    }
  });

  test('the send endpoint will not accept a draft', async ({ request }) => {
    // Unauthenticated, so this only proves the endpoint is closed — the
    // published-only lookup behind it is asserted by the build verifier.
    const response = await request.post('/api/admin/newsletter', {
      data: { action: 'send', slug: 'a-draft-that-does-not-exist' },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('writing from /admin', () => {
  test('the posts endpoint refuses an unauthenticated caller', async ({ request }) => {
    for (const action of ['save', 'publish', 'unpublish', 'delete']) {
      const response = await request.post('/api/admin/posts', {
        data: { action, slug: 'anything', title: 'Injected', body: 'nope' },
        failOnStatusCode: false,
      });
      expect(response.status(), `${action} must require sign-in`).toBe(401);
    }
  });

  test('a draft is not reachable from the public listing', async ({ request }) => {
    const listing = await (await request.get('/writing')).text();
    expect(listing).not.toContain('Draft — visible by link');
  });
});

test.describe('photo upload prerequisites', () => {
  test('the security policy permits the blob URLs the uploader needs', () => {
    // The writing box reads a chosen file through URL.createObjectURL, which
    // produces a blob: URL. A Content-Security-Policy without blob: in img-src
    // silently breaks every upload — it did exactly that once, and the failure
    // showed up only as "could not read that image".
    //
    // Asserted against vercel.json rather than a live response header, because
    // the header is applied by Vercel and is absent from the dev server this
    // suite runs against.
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
    const csp = config.headers
      .flatMap((entry: { headers: { key: string; value: string }[] }) => entry.headers)
      .find((header: { key: string }) => header.key === 'Content-Security-Policy')?.value as string;

    const imgSrc = csp.split(';').find((part) => part.trim().startsWith('img-src')) ?? '';

    expect(imgSrc, 'img-src must allow blob: or every upload fails').toContain('blob:');
    expect(imgSrc, 'img-src must allow the image host').toContain('supabase.co');
  });
});
