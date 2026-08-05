import { Marked } from 'marked';
import { getSupabase, isSupabaseConfigured } from './supabase';

/**
 * Articles, stored in the database rather than as files.
 *
 * The point is that writing happens in exactly one place — /admin — with no
 * filenames, no frontmatter and no commits. Everything the site needs about an
 * article comes from here: the writing pages, the RSS feed and the newsletter.
 */

export interface Post {
  slug: string;
  title: string;
  description: string;
  body: string;
  tags: string[];
  status: 'draft' | 'published';
  pubDate: Date;
  updatedAt: Date;
}

interface Row {
  slug: string;
  title: string;
  description: string;
  body: string;
  tags: string[] | null;
  status: string;
  pub_date: string;
  updated_at: string;
}

const toPost = (row: Row): Post => ({
  slug: row.slug,
  title: row.title,
  description: row.description ?? '',
  body: row.body ?? '',
  tags: row.tags ?? [],
  status: row.status === 'published' ? 'published' : 'draft',
  pubDate: new Date(row.pub_date),
  updatedAt: new Date(row.updated_at),
});

const COLUMNS = 'slug, title, description, body, tags, status, pub_date, updated_at';

async function query(filter: 'published' | 'draft' | 'all'): Promise<Post[]> {
  if (!isSupabaseConfigured()) return [];

  let builder = getSupabase().from('posts').select(COLUMNS).order('pub_date', { ascending: false });
  if (filter !== 'all') builder = builder.eq('status', filter);

  const { data, error } = await builder;
  if (error) {
    console.error('[posts] read failed', error);
    return [];
  }
  return (data as unknown as Row[]).map(toPost);
}

/** Live articles. This is what the public sees, the feed carries and email sends. */
export const getPublishedPosts = () => query('published');

/** Still being worked on. Never public. */
export const getDraftPosts = () => query('draft');

export const getAllPosts = () => query('all');

export async function getPost(slug: string): Promise<Post | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await getSupabase()
    .from('posts')
    .select(COLUMNS)
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) return null;
  return toPost(data as unknown as Row);
}

/**
 * Markdown → HTML.
 *
 * Raw HTML in the source is escaped rather than passed through. Only an
 * authenticated admin can write an article, so this is not defending against
 * hostile input so much as making sure a stray angle bracket in ordinary prose
 * cannot break the page.
 */
const marked = new Marked({ gfm: true, breaks: false });

export function renderMarkdown(body: string): string {
  return marked.parse(escapeRawHtml(body), { async: false }) as string;
}

function escapeRawHtml(source: string): string {
  // Leave fenced code blocks alone; escape angle brackets everywhere else.
  return source
    .split(/(```[\s\S]*?```)/g)
    .map((chunk, index) =>
      index % 2 === 1 ? chunk : chunk.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    )
    .join('');
}

/** A URL-safe slug derived from a title, so nobody has to invent filenames. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export function readingTime(body: string): string {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

/** First sentence or two, used when a description was left blank. */
export function autoDescription(body: string): string {
  const first = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find((block) => block.length > 40 && !block.startsWith('#') && !block.startsWith('>'));

  if (!first) return '';
  const clean = first
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s*\n\s*/g, ' ');
  return clean.length > 200 ? `${clean.slice(0, 197).trimEnd()}…` : clean;
}
