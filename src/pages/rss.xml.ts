import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPosts } from '../lib/content';
import { site } from '../site.config';

export const GET: APIRoute = async (context) => {
  const posts = await getPosts();

  return rss({
    title: `${site.name} — Writing`,
    description:
      'Essays on supply chain, operations, entrepreneurship and endurance sport by Avinash Sadana.',
    site: context.site ?? site.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/writing/${post.id}/`,
      categories: [...post.data.tags],
    })),
    customData: '<language>en</language>',
  });
};
