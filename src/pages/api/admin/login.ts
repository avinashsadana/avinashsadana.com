import type { APIRoute } from 'astro';
import { fail, json, readJson } from '../../../lib/api';
import {
  cookieOptions,
  createSessionToken,
  isAdminConfigured,
  SESSION_COOKIE,
  verifyPassword,
} from '../../../lib/admin';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminConfigured()) {
    return fail('Admin access is not configured. Set ADMIN_PASSWORD in Vercel.', 503);
  }

  const body = await readJson(request);
  const password = typeof body.password === 'string' ? body.password : '';

  // A deliberate delay on every attempt — correct or not — so this endpoint is
  // useless for high-rate password guessing.
  await new Promise((resolve) => setTimeout(resolve, 600));

  if (!verifyPassword(password)) {
    return fail('Incorrect password.', 401);
  }

  const { token, maxAge } = createSessionToken();
  cookies.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge });

  return json({ ok: true });
};

export const DELETE: APIRoute = ({ cookies }) => {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return json({ ok: true });
};

export const ALL: APIRoute = () => fail('Method not allowed.', 405);
