import type { APIRoute } from 'astro';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export const prerender = false;

/**
 * The link in the confirmation email. A GET, because it is opened from an email
 * client — so it deliberately does the one idempotent thing (mark this token's
 * row confirmed) and then redirects to a human-readable page.
 *
 * Tokens are single-use in effect: confirming clears the row's pending state,
 * and a token that matches nothing simply redirects to the failure state.
 */
export const GET: APIRoute = async ({ url, redirect }) => {
  const token = url.searchParams.get('token') ?? '';

  // Tokens are base64url from 24 random bytes — anything else is not ours.
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token) || !isSupabaseConfigured()) {
    return redirect('/subscribed?status=invalid', 302);
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('confirm_token', token)
    .neq('status', 'unsubscribed')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[confirm] update failed', error);
    return redirect('/subscribed?status=error', 302);
  }

  return redirect(data ? '/subscribed?status=ok' : '/subscribed?status=invalid', 302);
};
