import type { APIRoute } from 'astro';
import { fail, json, readJson } from '../../../lib/api';
import { isSignedIn } from '../../../lib/admin';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';
import { getPosts } from '../../../lib/content';
import { buildEmail, sendNewsletter, subjectFor, type Subscriber } from '../../../lib/newsletter';

export const prerender = false;

/**
 * Sending a newsletter, in two deliberate steps.
 *
 * `preview` returns exactly what will go out and to how many people. `send`
 * does it. Nothing is ever mailed on a single click, because the one mistake
 * that cannot be undone here is sending.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSignedIn(cookies)) return fail('Not signed in.', 401);
  if (!isSupabaseConfigured()) return fail('Database is not configured.', 503);

  const body = await readJson(request);
  const action = typeof body.action === 'string' ? body.action : '';
  const slug = typeof body.slug === 'string' ? body.slug : '';

  const posts = await getPosts();
  const post = posts.find((p) => p.id === slug);
  if (!post) return fail('No published article with that name.', 404);

  const supabase = getSupabase();

  if (action === 'preview') {
    const [{ count }, { data: existing }] = await Promise.all([
      supabase
        .from('newsletter_subscribers')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed'),
      supabase
        .from('newsletter_sends')
        .select('status, sent_at, sent_count')
        .eq('post_slug', slug)
        .in('status', ['draft', 'sending', 'sent'])
        .maybeSingle(),
    ]);

    const { subject, html } = buildEmail(post, 'preview-token-not-a-real-unsubscribe');

    return json({
      ok: true,
      subject,
      html,
      recipients: count ?? 0,
      alreadySent: existing?.status === 'sent',
      sentAt: existing?.sent_at ?? null,
    });
  }

  if (action !== 'send') return fail('Unknown action.', 422);

  // Claim the send before doing any work. The unique index means a second
  // request for the same article loses here rather than mailing everyone twice.
  const { data: claim, error: claimError } = await supabase
    .from('newsletter_sends')
    .insert({ post_slug: slug, subject: subjectFor(post), status: 'sending' })
    .select('id')
    .maybeSingle();

  if (claimError || !claim) {
    return fail('That article has already been sent, or a send is in progress.', 409);
  }

  const { data: subscribers, error: readError } = await supabase
    .from('newsletter_subscribers')
    .select('email, unsubscribe_token')
    .eq('status', 'confirmed');

  if (readError) {
    await supabase
      .from('newsletter_sends')
      .update({ status: 'failed', error: 'Could not read the subscriber list.' })
      .eq('id', claim.id);
    return fail('Could not read the subscriber list.', 500);
  }

  const list = (subscribers ?? []) as Subscriber[];

  if (list.length === 0) {
    await supabase
      .from('newsletter_sends')
      .update({ status: 'failed', error: 'No confirmed subscribers.' })
      .eq('id', claim.id);
    return fail('There are no confirmed subscribers to send to.', 422);
  }

  const result = await sendNewsletter(post, list);

  await supabase
    .from('newsletter_sends')
    .update({
      status: result.sent > 0 && result.failed === 0 ? 'sent' : result.sent > 0 ? 'sent' : 'failed',
      recipient_count: list.length,
      sent_count: result.sent,
      error: result.error ?? null,
      sent_at: new Date().toISOString(),
    })
    .eq('id', claim.id);

  if (result.sent === 0) {
    return fail(result.error ?? 'Nothing could be sent.', 502);
  }

  return json({
    ok: true,
    sent: result.sent,
    failed: result.failed,
    message:
      result.failed > 0
        ? `Sent to ${result.sent}. ${result.failed} failed — check the logs.`
        : `Sent to ${result.sent} subscriber${result.sent === 1 ? '' : 's'}.`,
  });
};

export const ALL: APIRoute = () => fail('Method not allowed.', 405);
