import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPublishedPosts } from '../lib/posts';
import { site } from '../site.config';

// On demand, so a newly published article is in the feed straight away.
export const prerender = false;

export const GET: APIRoute = async (context) => {
  const posts = await getPublishedPosts();

  return rss({
    title: `${site.name} — Writing`,
    description:
      'Essays on business models, process, operations and endurance sport by Avinash Sadana.',
    site: context.site ?? site.url,
    items: posts.map((post) => ({
      title: post.title,
      description: post.description,
      pubDate: post.pubDate,
      link: `/writing/${post.slug}/`,
      categories: post.tags,
    })),
    customData: '<language>en</language>',
  });
};
