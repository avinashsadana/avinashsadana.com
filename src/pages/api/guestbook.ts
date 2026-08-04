import type { APIRoute } from 'astro';
import { clean, cleanMultiline, fail, hashIp, json, looksAutomated, readJson } from '../../lib/api';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export const prerender = false;

const RATE_LIMIT = 2;
const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Public list — only ever returns entries that have been approved. */
export const GET: APIRoute = async () => {
  if (!isSupabaseConfigured()) return json({ ok: true, entries: [] });

  const { data, error } = await getSupabase()
    .from('guestbook_entries')
    .select('id, name, role, message, created_at')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[guestbook] read failed', error);
    return json({ ok: true, entries: [] });
  }

  return json({ ok: true, entries: data ?? [] });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await readJson(request);

  if (looksAutomated({ honeypot: body.website, elapsedMs: Number(body.elapsedMs) })) {
    return json({ ok: true, message: 'Thanks — your note is with me for review.' });
  }

  const name = clean(body.name, 80);
  const role = clean(body.role, 120);
  const message = cleanMultiline(body.message, 600);

  if (name.length < 2) return fail('Please add your name.', 422, 'name');
  if (message.length < 5) return fail('Please write a slightly longer note.', 422, 'message');

  if (!isSupabaseConfigured()) {
    return fail('The guestbook is not configured yet.', 503);
  }

  const supabase = getSupabase();
  const ipHash = hashIp(request);

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error: countError } = await supabase
    .from('guestbook_entries')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);

  if (countError) {
    console.error('[guestbook] rate limit check failed', countError);
    return fail('Something went wrong on my end. Please try again shortly.', 500);
  }

  if ((count ?? 0) >= RATE_LIMIT) {
    return fail('You’ve already signed the guestbook today. Thank you!', 429);
  }

  // `approved` defaults to false at the database level — nothing a stranger
  // writes can appear on the site until it has been read.
  const { error } = await supabase.from('guestbook_entries').insert({
    name,
    role: role || null,
    message,
    ip_hash: ipHash,
  });

  if (error) {
    console.error('[guestbook] insert failed', error);
    return fail('Something went wrong on my end. Please try again shortly.', 500);
  }

  return json({ ok: true, message: 'Thanks — your note is with me for review.' });
};

export const ALL: APIRoute = () => fail('Method not allowed.', 405);
