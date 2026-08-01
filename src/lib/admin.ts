import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { env } from './env';

/**
 * Minimal single-user admin session.
 *
 * There is exactly one person who ever signs in here, so a full auth provider
 * would be more moving parts than the problem deserves. What this does provide:
 *
 *   - the password is compared in constant time, so response timing leaks nothing
 *   - the session cookie is an HMAC of (expiry) signed with a server-only secret,
 *     so it cannot be forged or extended by the client
 *   - the cookie is httpOnly + sameSite=strict + secure, so it is invisible to
 *     scripts and never rides along on a cross-site request
 */

export const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function signingKey(): string {
  // SUPABASE_JWT_SECRET is a high-entropy value that already exists in the
  // environment and never leaves the server.
  const secret = env('SUPABASE_JWT_SECRET') ?? env('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) throw new Error('No secret available to sign admin sessions.');
  return secret;
}

function sign(value: string): string {
  return createHmac('sha256', signingKey()).update(value).digest('hex');
}

/** Constant-time string comparison that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    // Still run a comparison so the timing doesn't reveal the length mismatch.
    timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

export function isAdminConfigured(): boolean {
  return Boolean(env('ADMIN_PASSWORD'));
}

export function verifyPassword(candidate: string): boolean {
  const expected = env('ADMIN_PASSWORD');
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

export function createSessionToken(): { token: string; maxAge: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  return {
    token: `${expiresAt}.${sign(String(expiresAt))}`,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export function isValidSession(token: string | undefined): boolean {
  if (!token) return false;

  const [expiresRaw, signature] = token.split('.');
  if (!expiresRaw || !signature) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  try {
    return safeEqual(signature, sign(expiresRaw));
  } catch {
    return false;
  }
}

export function isSignedIn(cookies: AstroCookies): boolean {
  return isValidSession(cookies.get(SESSION_COOKIE)?.value);
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: import.meta.env.PROD,
  path: '/',
} as const;
