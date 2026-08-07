import type { APIRoute } from 'astro';
import { getPublishedPosts } from '../lib/posts';
import { site } from '../site.config';

// Generated on request rather than at build time. Articles live in the database
// now, so a build-time sitemap could not see them — and for a while it did not,
// which left every article invisible to search engines.
export const prerender = false;

/**
 * Pages that are always present, with a rough sense of how often each changes.
 * Utility and private routes are deliberately absent: /admin, /subscribed and
 * /unsubscribed are noindex, and listing a noindex page wastes crawl budget and
 * muddies the signal.
 */
const STATIC_PAGES: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/work', changefreq: 'monthly', priority: '0.9' },
  { path: '/writing', changefreq: 'weekly', priority: '0.9' },
  { path: '/ventures', changefreq: 'monthly', priority: '0.8' },
  { path: '/ventures/wedesi-festival', changefreq: 'yearly', priority: '0.7' },
  { path: '/ventures/cycle-n-chai', changefreq: 'yearly', priority: '0.7' },
  { path: '/endurance', changefreq: 'monthly', priority: '0.8' },
  { path: '/reading', changefreq: 'monthly', priority: '0.7' },
  { path: '/about', changefreq: 'monthly', priority: '0.9' },
  { path: '/resume', changefreq: 'monthly', priority: '0.8' },
  { path: '/contact', changefreq: 'yearly', priority: '0.6' },
  { path: '/guestbook', changefreq: 'weekly', priority: '0.5' },
];

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();

  const entries = [
    ...STATIC_PAGES.map((page) => ({
      loc: `${site.url}${page.path}`,
      lastmod: undefined as string | undefined,
      changefreq: page.changefreq,
      priority: page.priority,
    })),
    ...posts.map((post) => ({
      loc: `${site.url}/writing/${post.slug}`,
      // Real modification dates tell crawlers what is worth revisiting.
      lastmod: post.updatedAt.toISOString().slice(0, 10),
      changefreq: 'yearly',
      priority: '0.8',
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${escape(entry.loc)}</loc>${entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
};
