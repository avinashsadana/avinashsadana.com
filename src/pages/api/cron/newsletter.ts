import { Resend } from 'resend';
import type { APIRoute } from 'astro';
import { fail, json } from '../../../lib/api';
import { env } from '../../../lib/env';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';
import { getPosts } from '../../../lib/content';
import { site } from '../../../site.config';

export const prerender = false;

/**
 * Runs on a schedule and prepares — but never sends — a newsletter.
 *
 * When a published article has no send record, this creates one as a draft and
 * emails Avinash to say it is ready. He reads it in /admin and sends it there.
 *
 * The deliberate choice is that nothing reaches the list without a human
 * looking at it first. An automation that mails everyone the instant a typo fix
 * is pushed is a bad afternoon, and the tedious part was never the clicking —
 * it was noticing and preparing. That part is what this removes.
 */
export const GET: APIRoute = async ({ request }) => {
  // Vercel signs scheduled invocations with this header. Without the check the
  // endpoint would be an open trigger for anyone who guessed the URL.
  const secret = env('CRON_SECRET');
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) return fail('Unauthorized.', 401);
  }

  if (!isSupabaseConfigured()) return fail('Database is not configured.', 503);

  const supabase = getSupabase();
  const posts = await getPosts();
  if (posts.length === 0) return json({ ok: true, prepared: 0, reason: 'no published posts' });

  const { data: sends, error } = await supabase
    .from('newsletter_sends')
    .select('post_slug')
    .in('status', ['draft', 'sending', 'sent']);

  if (error) {
    console.error('[cron/newsletter] could not read send history', error);
    return fail('Could not read send history.', 500);
  }

  const already = new Set((sends ?? []).map((s) => s.post_slug as string));
  const pending = posts.filter((post) => !already.has(post.id));

  if (pending.length === 0) {
    return json({ ok: true, prepared: 0, reason: 'every published article has been handled' });
  }

  // Only the newest, so a first run after adding several articles does not
  // queue up a backlog of notifications.
  const post = pending[0]!;

  const { error: insertError } = await supabase
    .from('newsletter_sends')
    .insert({ post_slug: post.id, subject: post.data.title, status: 'draft' });

  if (insertError) {
    // Most likely the unique index caught a concurrent run. Not an error worth
    // reporting as a failure.
    return json({ ok: true, prepared: 0, reason: 'already prepared' });
  }

  const { count } = await supabase
    .from('newsletter_subscribers')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'confirmed');

  const apiKey = env('RESEND_API_KEY');
  if (apiKey) {
    const from = env('CONTACT_FROM_EMAIL') ?? 'Website <onboarding@resend.dev>';
    const to = env('CONTACT_TO_EMAIL') ?? site.email;

    await new Resend(apiKey).emails
      .send({
        from,
        to,
        subject: `Ready to send: ${post.data.title}`,
        text: [
          `"${post.data.title}" is published and has not been mailed yet.`,
          '',
          `Subscribers: ${count ?? 0}`,
          '',
          `Review and send it here: ${site.url}/admin`,
          '',
          'Nothing has gone out. It waits until you press send.',
        ].join('\n'),
      })
      .catch((sendError) => {
        // The draft exists either way; the notification is a convenience.
        console.error('[cron/newsletter] notification failed', sendError);
      });
  }

  return json({ ok: true, prepared: 1, slug: post.id, subscribers: count ?? 0 });
};
