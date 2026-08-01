import type { APIRoute } from 'astro';
import {
  clean,
  cleanMultiline,
  fail,
  hashIp,
  isEmail,
  json,
  looksAutomated,
  readJson,
} from '../../lib/api';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { sendContactNotification } from '../../lib/notify';

export const prerender = false;

/** Submissions allowed from one IP hash within the window. */
const RATE_LIMIT = 3;
const WINDOW_MS = 60 * 60 * 1000;

export const POST: APIRoute = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return fail('The contact form is not configured yet. Please email me directly.', 503);
  }

  const body = await readJson(request);

  // Silently accept anything that looks automated. Telling a bot it failed just
  // teaches whoever wrote it how to get past the check.
  if (looksAutomated({ honeypot: body.company, elapsedMs: Number(body.elapsedMs) })) {
    return json({ ok: true, message: 'Thanks — your message is on its way.' });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 254);
  const subject = clean(body.subject, 180);
  const message = cleanMultiline(body.message, 5000);

  if (name.length < 2) return fail('Please tell me your name.', 422, 'name');
  if (!isEmail(email)) return fail('That email address doesn’t look right.', 422, 'email');
  if (message.length < 10) return fail('Please write a slightly longer message.', 422, 'message');

  const supabase = getSupabase();
  const ipHash = hashIp(request);

  // Rate limit before writing, so a flood never reaches the table.
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error: countError } = await supabase
    .from('contact_messages')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);

  if (countError) {
    console.error('[contact] rate limit check failed', countError);
    return fail('Something went wrong on my end. Please try again shortly.', 500);
  }

  if ((count ?? 0) >= RATE_LIMIT) {
    return fail(
      'You’ve sent a few messages already — I’ve got them. Try again in an hour.',
      429,
    );
  }

  const { error } = await supabase.from('contact_messages').insert({
    name,
    email,
    subject: subject || null,
    message,
    ip_hash: ipHash,
  });

  if (error) {
    console.error('[contact] insert failed', error);
    return fail('Something went wrong on my end. Please try again shortly.', 500);
  }

  // The message is already safely stored. Notification is a convenience on top
  // of that, so a failure here must never turn a delivered message into an error.
  await sendContactNotification({ name, email, subject, message }).catch((notifyError) => {
    console.error('[contact] notification failed (message was still saved)', notifyError);
  });

  return json({ ok: true, message: 'Thanks — your message is on its way.' });
};

/** Anything other than POST gets a clear answer rather than a stack trace. */
export const ALL: APIRoute = () => fail('Method not allowed.', 405);
