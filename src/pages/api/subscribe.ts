import { randomBytes } from 'node:crypto';
import type { APIRoute } from 'astro';
import { clean, fail, hashIp, isEmail, json, looksAutomated, readJson } from '../../lib/api';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { sendConfirmationEmail } from '../../lib/notify';

export const prerender = false;

const RATE_LIMIT = 3;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * Newsletter signup, double opt-in.
 *
 * Nobody is added to the list by someone else typing their address: a signup
 * creates a `pending` row and sends a confirmation link. Only clicking that
 * link promotes it to `confirmed`. Beyond being the decent thing to do, it is
 * what keeps the list deliverable — mailbox providers punish senders whose
 * lists collect addresses that never asked.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return fail('The newsletter isn’t set up yet. Try again soon.', 503);
  }

  const body = await readJson(request);

  if (looksAutomated({ honeypot: body.fax, elapsedMs: Number(body.elapsedMs) })) {
    return json({ ok: true, message: 'Almost there — check your inbox to confirm.' });
  }

  const email = clean(body.email, 254).toLowerCase();
  if (!isEmail(email)) return fail('That email address doesn’t look right.', 422, 'email');

  const supabase = getSupabase();
  const ipHash = hashIp(request);

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error: countError } = await supabase
    .from('newsletter_subscribers')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);

  if (countError) {
    console.error('[subscribe] rate limit check failed', countError);
    return fail('Something went wrong on my end. Please try again shortly.', 500);
  }
  if ((count ?? 0) >= RATE_LIMIT) {
    return fail('That’s a few signups from here already. Try again in an hour.', 429);
  }

  const { data: existing, error: lookupError } = await supabase
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('email', email)
    .maybeSingle();

  if (lookupError) {
    console.error('[subscribe] lookup failed', lookupError);
    return fail('Something went wrong on my end. Please try again shortly.', 500);
  }

  // Already confirmed: say so plainly rather than sending another email.
  if (existing?.status === 'confirmed') {
    return json({ ok: true, message: 'You’re already on the list — thank you.' });
  }

  const token = randomBytes(24).toString('base64url');

  // Re-subscribing after unsubscribing, or re-requesting a lost confirmation,
  // both just refresh the token rather than creating a duplicate row.
  const { error } = existing
    ? await supabase
        .from('newsletter_subscribers')
        .update({ status: 'pending', confirm_token: token, ip_hash: ipHash })
        .eq('id', existing.id)
    : await supabase
        .from('newsletter_subscribers')
        .insert({ email, confirm_token: token, ip_hash: ipHash });

  if (error) {
    console.error('[subscribe] write failed', error);
    return fail('Something went wrong on my end. Please try again shortly.', 500);
  }

  try {
    await sendConfirmationEmail(email, token);
  } catch (sendError) {
    // The row exists but the visitor will never get the link, so this one does
    // need reporting — unlike the contact form, where storage is the point.
    console.error('[subscribe] confirmation email failed', sendError);
    return fail('Couldn’t send the confirmation email. Please try again shortly.', 502);
  }

  return json({ ok: true, message: 'Almost there — check your inbox to confirm.' });
};

export const ALL: APIRoute = () => fail('Method not allowed.', 405);
