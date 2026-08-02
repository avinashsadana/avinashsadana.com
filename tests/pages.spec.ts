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
  expect(body).toContain('Sitemap: https://avinashsadana.com/sitemap-index.xml');
  expect(body, 'admin is not crawlable').toContain('Disallow: /admin');
});

// The sitemap itself is emitted at build time, so it is verified against the
// build output by `npm run verify:build` rather than against the dev server.

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
  await expect(page.getByRole('heading', { name: /Avinash/ })).toBeVisible();
  await expect(page.getByText(/programme management and strategy support/)).toBeVisible();
  await context.close();
});
