import type { APIRoute } from 'astro';
import { clean, cleanMultiline, fail, json, readJson } from '../../../lib/api';
import { isSignedIn } from '../../../lib/admin';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';
import { autoDescription, getPost, slugify } from '../../../lib/posts';

export const prerender = false;

/**
 * Writing, from /admin. One endpoint for the whole life of an article:
 * save, publish, unpublish, delete.
 *
 * The slug is derived from the title so nobody has to invent a filename, and
 * once an article is published its slug is frozen — changing it would break
 * every link already shared and every newsletter already sent.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSignedIn(cookies)) return fail('Not signed in.', 401);
  if (!isSupabaseConfigured()) return fail('Database is not configured.', 503);

  const input = await readJson(request);
  const action = typeof input.action === 'string' ? input.action : 'save';
  const supabase = getSupabase();

  if (action === 'delete') {
    const slug = clean(input.slug, 100);
    if (!slug) return fail('Which article?', 422);

    const existing = await getPost(slug);
    if (existing?.status === 'published') {
      return fail('Unpublish it first — deleting a live article breaks its links.', 409);
    }

    const { error } = await supabase.from('posts').delete().eq('slug', slug);
    if (error) return fail('Could not delete that draft.', 500);
    return json({ ok: true, deleted: slug });
  }

  if (action === 'publish' || action === 'unpublish') {
    const slug = clean(input.slug, 100);
    const post = await getPost(slug);
    if (!post) return fail('No article with that name.', 404);

    if (action === 'publish' && !post.title.trim()) {
      return fail('It needs a title before it can go live.', 422);
    }

    const { error } = await supabase
      .from('posts')
      .update({
        status: action === 'publish' ? 'published' : 'draft',
        // Publishing sets the date, so a piece drafted weeks ago is not
        // back-dated on the site the moment it goes live.
        ...(action === 'publish' && post.status === 'draft'
          ? { pub_date: new Date().toISOString() }
          : {}),
      })
      .eq('slug', slug);

    if (error) return fail('Could not change its status.', 500);
    return json({ ok: true, status: action === 'publish' ? 'published' : 'draft' });
  }

  if (action !== 'save') return fail('Unknown action.', 422);

  const title = clean(input.title, 200);
  const body = cleanMultiline(input.body, 60000);
  const existingSlug = clean(input.slug, 100);

  if (title.length < 3) return fail('Give it a title first.', 422, 'title');

  const tags = Array.isArray(input.tags)
    ? input.tags.map((tag: unknown) => clean(tag, 40)).filter(Boolean).slice(0, 5)
    : clean(input.tags, 200)
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 5);

  const description = clean(input.description, 400) || autoDescription(body);

  // Editing an existing article: keep its slug, whatever the title now says.
  if (existingSlug) {
    const { error } = await supabase
      .from('posts')
      .update({ title, description, body, tags })
      .eq('slug', existingSlug);

    if (error) {
      console.error('[posts] update failed', error);
      return fail('Could not save your changes.', 500);
    }
    return json({ ok: true, slug: existingSlug, saved: true });
  }

  // New article: derive a slug, and add a suffix rather than overwrite if the
  // obvious one is taken.
  const base = slugify(title) || `untitled-${Date.now()}`;
  let slug = base;
  for (let attempt = 2; attempt <= 20 && (await getPost(slug)); attempt += 1) {
    slug = `${base}-${attempt}`;
  }

  const { error } = await supabase
    .from('posts')
    .insert({ slug, title, description, body, tags, status: 'draft' });

  if (error) {
    console.error('[posts] insert failed', error);
    return fail('Could not create the draft.', 500);
  }

  return json({ ok: true, slug, created: true });
};

export const ALL: APIRoute = () => fail('Method not allowed.', 405);
