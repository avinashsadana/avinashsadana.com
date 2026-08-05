import { Resend } from 'resend';
import { env } from './env';
import { getPosts, type Post } from './content';
import { site } from '../site.config';

/**
 * Newsletter sending, run from this site rather than a third-party editor.
 *
 * The article is already written and version-controlled in src/content/writing,
 * so the newsletter is generated from it — there is no second copy to keep in
 * step and no formatting to re-apply.
 *
 * Resend's batch endpoint takes up to 100 messages per call. Each subscriber
 * gets their own message because each needs their own unsubscribe link, which
 * rules out one message with everyone in BCC (and BCC to a large list is a
 * reliable way to land in spam anyway).
 */

const BATCH_SIZE = 100;

export interface Subscriber {
  email: string;
  unsubscribe_token: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * First couple of paragraphs, with the markdown taken off. Enough that the
 * email is worth opening on its own, not so much that there is no reason to
 * follow the link.
 */
export function excerpt(post: Post, paragraphs = 2): string {
  const body = (post.body ?? '')
    // Drop frontmatter leftovers, headings, images and horizontal rules.
    .replace(/^---[\s\S]*?---/, '')
    .replace(/^#{1,6}\s.*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/^\s*---\s*$/gm, '');

  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 40 && !block.startsWith('*'))
    .slice(0, paragraphs)
    .map((block) =>
      block
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\s*\n\s*/g, ' '),
    )
    .join('\n\n');
}

export function subjectFor(post: Post): string {
  return post.data.title;
}

interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildEmail(post: Post, unsubscribeToken: string): BuiltEmail {
  const url = `${site.url}/writing/${post.id}`;
  const unsubscribeUrl = `${site.url}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const body = excerpt(post);

  const text = [
    post.data.title,
    '',
    post.data.description,
    '',
    body,
    '',
    `Continue reading: ${url}`,
    '',
    '—',
    `You are receiving this because you subscribed at ${site.url}.`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  const paragraphs = body
    .split('\n\n')
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`)
    .join('');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:8px 0;line-height:1.65;color:#22252a">
      <p style="margin:0 0 28px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7a7e85">
        Avinash Sadana
      </p>

      <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:700;color:#22252a">
        ${escapeHtml(post.data.title)}
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#5f636a">${escapeHtml(post.data.description)}</p>

      <div style="font-size:15px;color:#22252a">${paragraphs}</div>

      <p style="margin:28px 0 0">
        <a href="${url}" style="display:inline-block;background:#22252a;color:#f7f6f3;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px">
          Continue reading
        </a>
      </p>

      <hr style="margin:36px 0 16px;border:0;border-top:1px solid #e4e1da" />
      <p style="margin:0;font-size:12px;color:#7a7e85">
        You are receiving this because you subscribed at
        <a href="${site.url}" style="color:#7a7e85">avinashsadana.com</a>.
        <a href="${unsubscribeUrl}" style="color:#7a7e85">Unsubscribe</a>.
      </p>
    </div>
  `;

  return { subject: subjectFor(post), html, text };
}

export interface SendResult {
  sent: number;
  failed: number;
  error?: string;
}

/**
 * Sends one newsletter to a list of subscribers.
 *
 * `List-Unsubscribe` headers are set so Gmail and Outlook show their own
 * one-click unsubscribe control. Providers increasingly treat their absence as
 * a spam signal, and honouring it keeps the list clean without anyone having
 * to find a link in the footer.
 */
export async function sendNewsletter(
  post: Post,
  subscribers: Subscriber[],
): Promise<SendResult> {
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey) return { sent: 0, failed: subscribers.length, error: 'RESEND_API_KEY is not set.' };

  const from = env('CONTACT_FROM_EMAIL') ?? 'Website <onboarding@resend.dev>';
  const resend = new Resend(apiKey);

  let sent = 0;
  let failed = 0;
  let firstError: string | undefined;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);

    const messages = batch.map((subscriber) => {
      const { subject, html, text } = buildEmail(post, subscriber.unsubscribe_token);
      const unsubscribeUrl = `${site.url}/api/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribe_token)}`;
      return {
        from,
        to: subscriber.email,
        subject,
        html,
        text,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      };
    });

    try {
      const { error } = await resend.batch.send(messages);
      if (error) {
        failed += batch.length;
        firstError ??= error.message;
      } else {
        sent += batch.length;
      }
    } catch (batchError) {
      failed += batch.length;
      firstError ??= batchError instanceof Error ? batchError.message : String(batchError);
    }
  }

  return { sent, failed, error: firstError };
}

/** Published posts that have never been mailed, newest first. */
export async function unsentPosts(sentSlugs: string[]): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter((post) => !sentSlugs.includes(post.id));
}
