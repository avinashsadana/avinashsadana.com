import type { APIRoute } from 'astro';
import { fail, json } from '../../../lib/api';
import { isSignedIn } from '../../../lib/admin';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';
import { env } from '../../../lib/env';

export const prerender = false;

const BUCKET = 'post-images';
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * The browser resizes and re-encodes to WebP before uploading, so anything
 * else arriving here did not come from the writing box.
 */
const ALLOWED = new Set(['image/webp', 'image/jpeg', 'image/png']);

const EXTENSION: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** WebP, JPEG and PNG magic bytes — the declared type alone is not evidence. */
function looksLikeImage(bytes: Uint8Array): boolean {
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);

  const isPng = startsWith(0x89, 0x50, 0x4e, 0x47);
  const isJpeg = startsWith(0xff, 0xd8, 0xff);
  const isWebp =
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  return isPng || isJpeg || isWebp;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSignedIn(cookies)) return fail('Not signed in.', 401);
  if (!isSupabaseConfigured()) return fail('Storage is not configured.', 503);

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get('file');
    if (value instanceof File) file = value;
  } catch {
    return fail('Could not read the upload.', 400);
  }

  if (!file) return fail('No file was sent.', 422);
  if (file.size === 0) return fail('That file is empty.', 422);
  if (file.size > MAX_BYTES) return fail('That image is too large — 4 MB is the limit.', 413);
  if (!ALLOWED.has(file.type)) return fail('Images only — JPEG, PNG or WebP.', 415);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeImage(bytes)) {
    // A file can claim any content type. This checks what it actually is.
    return fail('That does not look like an image.', 415);
  }

  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXTENSION[file.type]}`;

  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(name, bytes, { contentType: file.type, cacheControl: '31536000', upsert: false });

  if (error) {
    console.error('[upload] failed', error);
    return fail('Could not save that image.', 500);
  }

  const base = env('SUPABASE_URL');
  return json({ ok: true, url: `${base}/storage/v1/object/public/${BUCKET}/${name}` });
};

export const ALL: APIRoute = () => fail('Method not allowed.', 405);
