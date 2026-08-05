import type { APIRoute } from 'astro';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export const prerender = false;

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

async function unsubscribe(token: string): Promise<'ok' | 'invalid' | 'error'> {
  if (!TOKEN.test(token) || !isSupabaseConfigured()) return 'invalid';

  const { data, error } = await getSupabase()
    .from('newsletter_subscribers')
    .update({ status: 'unsubscribed' })
    .eq('unsubscribe_token', token)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[unsubscribe] update failed', error);
    return 'error';
  }
  return data ? 'ok' : 'invalid';
}

/** The link in the footer of every newsletter. */
export const GET: APIRoute = async ({ url, redirect }) => {
  const result = await unsubscribe(url.searchParams.get('token') ?? '');
  return redirect(`/unsubscribed?status=${result}`, 302);
};

/**
 * One-click unsubscribe. Gmail and Outlook POST here directly from their own
 * unsubscribe button, without the recipient ever opening the email, so this
 * must succeed silently and return quickly. RFC 8058.
 */
export const POST: APIRoute = async ({ url, request }) => {
  let token = url.searchParams.get('token') ?? '';

  // Some providers send the token in a form body rather than the query string.
  if (!token) {
    try {
      const form = await request.formData();
      token = String(form.get('token') ?? '');
    } catch {
      /* no body — fall through to the invalid path */
    }
  }

  await unsubscribe(token);
  // Always 200: a mail provider is not a browser and should never see an error.
  return new Response(null, { status: 200 });
};
