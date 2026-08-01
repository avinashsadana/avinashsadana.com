// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://avinashsadana.com',
  // Pages are static by default. Only the API routes opt out via
  // `export const prerender = false`, so every content page ships as
  // crawlable HTML with no server round-trip.
  adapter: vercel({
    webAnalytics: { enabled: true },
    imageService: true,
  }),
  integrations: [
    mdx(),
    sitemap({
      // Keep private and machine-only routes out of the index, matching robots.txt.
      filter: (page) => !page.includes('/api/') && !page.includes('/admin'),
    }),
  ],
  // The dev toolbar injects its own headings and landmarks into the page, which
  // makes accessibility assertions ambiguous. It stays on for normal `astro dev`
  // and is switched off for the Playwright run.
  devToolbar: { enabled: process.env.PW_TEST !== '1' },
  vite: {
    plugins: [tailwindcss()],
  },
});
