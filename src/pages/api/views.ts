import type { APIRoute } from 'astro';
import { fail, json, readJson } from '../../lib/api';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export const prerender = false;

/**
 * Only paths the site actually serves may be counted, so nobody can seed the
 * table with arbitrary rows by POSTing invented paths.
 */
const ALLOWED_PATH = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;

export const POST: APIRoute = async ({ request }) => {
  // Validation comes first, deliberately. A malformed request is malformed
  // whether or not the database happens to be reachable, and answering 200 to
  // a bad path just because the backend is down hides real client bugs.
  const body = await readJson(request);
  const raw = typeof body.path === 'string' ? body.path : '/';
  const path = (raw.split('?')[0]?.replace(/\/+$/, '') || '/').slice(0, 200);

  if (!ALLOWED_PATH.test(path)) return fail('Invalid path.', 422);

  if (!isSupabaseConfigured()) return json({ ok: true, count: null });

  // The increment happens inside Postgres so two simultaneous requests cannot
  // read the same count and both write count + 1.
  const { data, error } = await getSupabase().rpc('increment_page_view', { page_path: path });

  if (error) {
    console.error('[views] increment failed', error);
    return json({ ok: true, count: null });
  }

  return json({ ok: true, count: typeof data === 'number' ? data : null });
};

export const ALL: APIRoute = () => fail('Method not allowed.', 405);
