import { Resend } from 'resend';
import { env } from './env';
import { site } from '../site.config';

/**
 * Email notification for new contact messages.
 *
 * This is deliberately optional. Messages are persisted to Supabase *before*
 * this is called, and can always be read at /admin — so if email is not
 * configured, or Resend is down, nothing is lost. Configure it by setting
 * RESEND_API_KEY (and optionally CONTACT_FROM_EMAIL) in the Vercel project.
 */

export interface ContactNotification {
  name: string;
  email: string;
  subject: string;
  message: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isEmailConfigured(): boolean {
  return Boolean(env('RESEND_API_KEY'));
}

export async function sendContactNotification(payload: ContactNotification): Promise<void> {
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey) {
    console.info('[notify] RESEND_API_KEY not set — message saved, no email sent.');
    return;
  }

  // Resend requires a verified sending domain. `onboarding@resend.dev` works
  // out of the box for delivery to your own address before a domain is verified.
  const from = env('CONTACT_FROM_EMAIL') ?? 'Website <onboarding@resend.dev>';
  const to = env('CONTACT_TO_EMAIL') ?? site.email;

  const subject = payload.subject
    ? `avinashsadana.com — ${payload.subject}`
    : `avinashsadana.com — new message from ${payload.name}`;

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    // Replying in a mail client should go straight back to the sender.
    replyTo: payload.email,
    text: [
      `From: ${payload.name} <${payload.email}>`,
      payload.subject ? `Subject: ${payload.subject}` : null,
      '',
      payload.message,
      '',
      '---',
      `Read every message at ${site.url}/admin`,
    ]
      .filter((line) => line !== null)
      .join('\n'),
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;line-height:1.6;color:#1a1a1a">
        <p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a8a8a">New message</p>
        <p style="margin:0 0 20px;font-size:20px;font-weight:700">${escapeHtml(payload.name)}</p>
        <p style="margin:0 0 4px"><a href="mailto:${escapeHtml(payload.email)}">${escapeHtml(payload.email)}</a></p>
        ${payload.subject ? `<p style="margin:0 0 20px;color:#555">${escapeHtml(payload.subject)}</p>` : ''}
        <div style="margin:20px 0;padding:16px 18px;background:#f6f5f2;border-radius:10px;white-space:pre-wrap">${escapeHtml(payload.message)}</div>
        <p style="margin:24px 0 0;font-size:13px;color:#8a8a8a">
          Every message is also stored at <a href="${site.url}/admin">${site.url}/admin</a>.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend rejected the message: ${error.message}`);
  }
}

/**
 * Double opt-in confirmation for newsletter signups.
 *
 * Unlike the contact notification, a failure here matters: without this email
 * the subscriber can never confirm, so /api/subscribe surfaces the error rather
 * than swallowing it.
 */
export async function sendConfirmationEmail(email: string, token: string): Promise<void> {
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');

  const from = env('CONTACT_FROM_EMAIL') ?? 'Website <onboarding@resend.dev>';
  const confirmUrl = `${site.url}/api/confirm?token=${encodeURIComponent(token)}`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: 'Confirm your subscription — avinashsadana.com',
    text: [
      'Thanks for subscribing to my writing on business models, process and endurance sport.',
      '',
      'Confirm your subscription by opening this link:',
      confirmUrl,
      '',
      "If you didn't sign up, ignore this email — nothing happens without that click.",
    ].join('\n'),
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;line-height:1.6;color:#22252a">
        <p style="margin:0 0 18px">Thanks for subscribing to my writing on business models, process and endurance sport.</p>
        <p style="margin:0 0 26px">
          <a href="${confirmUrl}" style="display:inline-block;background:#22252a;color:#f7f6f3;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">Confirm subscription</a>
        </p>
        <p style="margin:0;font-size:13px;color:#7a7e85">
          If you didn't sign up, just ignore this — nothing happens without that click.
        </p>
      </div>
    `,
  });

  if (error) throw new Error(`Resend rejected the confirmation: ${error.message}`);
}
