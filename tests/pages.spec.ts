import { expect, test } from '@playwright/test';

const routes = [
  '/',
  '/about',
  '/work',
  '/ventures',
  '/ventures/wedesi-festival',
  '/ventures/cycle-n-chai',
  '/endurance',
  '/writing',
  '/guestbook',
  '/contact',
  '/resume',
  '/admin',
];

test.describe('every route renders', () => {
  for (const route of routes) {
    test(`${route} returns 200 with a heading and no console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));

      const response = await page.goto(route);
      expect(response?.status(), `${route} status`).toBe(200);

      // Scoped to <main>: the page's own heading, not any chrome around it.
      await expect(page.locator('main h1')).toBeVisible();
      expect(errors, `${route} console errors`).toEqual([]);
    });
  }
});

test('unknown routes render the 404 page', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('doesn’t exist');
});

test('robots.txt is served and points at the sitemap', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);

  const body = await robots.text();
  expect(body).toContain('Sitemap: https://avinashsadana.com/sitemap.xml');
  expect(body, 'admin is not crawlable').toContain('Disallow: /admin');
});

// The sitemap is generated on request now, so it is asserted directly further
// down rather than against the build output.

test('the RSS feed is valid XML', async ({ request }) => {
  const response = await request.get('/rss.xml');
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain('<rss');
  expect(body).toContain('<channel>');
});

test('the home page carries Person JSON-LD for search engines', async ({ page }) => {
  await page.goto('/');
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const parsed = blocks.map((block) => JSON.parse(block));

  const person = parsed.find((entry) => entry['@type'] === 'Person');
  expect(person, 'Person schema present').toBeTruthy();
  expect(person.name).toBe('Avinash Sadana');
  expect(person.sameAs).toContain('https://www.linkedin.com/in/avinashsadana');
  expect(person.alumniOf.length).toBeGreaterThan(0);
});

test('pages declare canonical URLs and Open Graph images', async ({ page }) => {
  await page.goto('/work');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://avinashsadana.com/work',
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://avinashsadana.com/og.jpg',
  );
});

test('the admin page is excluded from search engines', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('content is readable with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');

  // Scroll-reveal and the intro overlay must never be the reason content is
  // missing: both are progressive enhancements layered over real HTML.
  // Asserted structurally rather than against exact copy, so rewriting the
  // marketing text can never break this check.
  await expect(page.getByRole('heading', { name: /Avinash/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();

  const visibleText = await page.evaluate(() => document.body.innerText.trim().length);
  expect(visibleText, 'substantial content renders without JS').toBeGreaterThan(800);

  await context.close();
});

test.describe('search engines can find everything', () => {
  test('the sitemap includes every published article', async ({ request }) => {
    // Articles are database-backed, so a build-time sitemap cannot see them —
    // and once did not, leaving every article invisible to search engines.
    const [sitemap, feed] = await Promise.all([
      (await request.get('/sitemap.xml')).text(),
      (await request.get('/rss.xml')).text(),
    ]);

    const articleUrls = [...feed.matchAll(/<link>([^<]*\/writing\/[^<]+)<\/link>/g)].map((m) =>
      m[1].replace(/\/$/, ''),
    );
    expect(articleUrls.length, 'there are articles to check').toBeGreaterThan(0);

    for (const url of articleUrls) {
      expect(sitemap, `${url} must be in the sitemap`).toContain(url);
    }
  });

  test('the sitemap excludes private and noindex pages', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    for (const path of ['/admin', '/subscribed', '/unsubscribed', '/api/']) {
      expect(sitemap, `${path} must not be advertised to crawlers`).not.toContain(path);
    }
  });

  test('the homepage heading reads as the full name', async ({ page }) => {
    await page.goto('/');
    // Two block spans concatenate for crawlers and screen readers; without a
    // space between them this said "AvinashSadana".
    const text = await page.locator('main h1').innerText();
    expect(text.replace(/\s+/g, ' ').trim()).toBe('Avinash Sadana');
  });

  test('an article declares valid structured data with an image', async ({ page }) => {
    await page.goto('/writing/bikepacking-what-you-carry');
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const graphs = blocks.map((b) => JSON.parse(b)).flatMap((b) => b['@graph'] ?? [b]);

    const article = graphs.find((n) => n['@type'] === 'BlogPosting');
    expect(article, 'BlogPosting present').toBeTruthy();
    expect(article.image, 'articles need an image for rich results').toBeTruthy();
    expect(article.headline.length, 'headline within Google’s limit').toBeLessThanOrEqual(110);
    expect(article.datePublished).toBeTruthy();

    const crumbs = graphs.find((n) => n['@type'] === 'BreadcrumbList');
    expect(crumbs, 'breadcrumbs present').toBeTruthy();
    expect(crumbs.itemListElement).toHaveLength(3);
  });
});
