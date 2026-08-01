import { createHash } from 'node:crypto';
import { env } from './env';

/** Consistent JSON envelope so the client never has to guess the shape. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function fail(message: string, status = 400, field?: string): Response {
  return json({ ok: false, error: message, ...(field ? { field } : {}) }, status);
}

/**
 * We never store raw IP addresses. The hash is only used to rate-limit and to
 * spot duplicate submissions, and it is salted so it cannot be reversed by
 * hashing the IPv4 space.
 */
export function hashIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  const salt = env('SUPABASE_JWT_SECRET') ?? 'avinashsadana.com';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/** Collapses whitespace and enforces a maximum length. */
export function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Preserves paragraph breaks but strips runaway whitespace. */
export function cleanMultiline(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/**
 * Deliberately permissive. Rejecting unusual-but-valid addresses loses real
 * messages, which is a far worse outcome than letting a typo through.
 */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;
}

export interface SpamCheck {
  /** Hidden field that only a bot would fill in. */
  honeypot: unknown;
  /** Milliseconds since the form was rendered. */
  elapsedMs: number;
}

/**
 * Two cheap, dependency-free signals that stop the overwhelming majority of
 * automated submissions without ever showing a human a CAPTCHA.
 */
export function looksAutomated({ honeypot, elapsedMs }: SpamCheck): boolean {
  if (typeof honeypot === 'string' && honeypot.trim().length > 0) return true;
  // Nobody reads a form and writes a real message in under three seconds.
  if (Number.isFinite(elapsedMs) && elapsedMs > 0 && elapsedMs < 3000) return true;
  return false;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
