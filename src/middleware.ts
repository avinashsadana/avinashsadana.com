import { defineMiddleware } from 'astro:middleware';

/**
 * Cross-origin write protection, with one deliberate exception.
 *
 * Astro ships this check built in, but it is all-or-nothing and it blocks
 * one-click unsubscribe: Gmail and Outlook POST to the unsubscribe endpoint
 * from their own servers with `application/x-www-form-urlencoded` and no
 * matching Origin, which Astro answers with 403. Advertising a
 * `List-Unsubscribe` header that always fails is worse than not advertising one
 * at all, so Astro's global check is off and this replaces it.
 *
 * The rule is the same as Astro's: block unsafe methods from another origin
 * when the body is form-encoded (or has no content type at all). JSON bodies
 * are exempt because a browser cannot send cross-origin JSON without a CORS
 * preflight, which this site never grants — that is what protects the contact,
 * guestbook, subscribe and admin endpoints.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const FORM_CONTENT_TYPES = [
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
];

/**
 * Endpoints that must accept cross-origin POSTs by design. Keep this list as
 * short as it possibly can be — everything on it is a route that anyone on the
 * internet can trigger, so each one has to be safe standalone.
 *
 * /api/unsubscribe qualifies: it is idempotent, it only ever removes consent,
 * and it needs a 144-bit unguessable token to do anything at all.
 */
const CROSS_ORIGIN_ALLOWED = new Set(['/api/unsubscribe']);

function isFormLike(contentType: string | null): boolean {
  if (!contentType) return false;
  const value = contentType.toLowerCase();
  return FORM_CONTENT_TYPES.some((type) => value.includes(type));
}

export const onRequest = defineMiddleware((context, next) => {
  const { request, url } = context;

  if (SAFE_METHODS.has(request.method)) return next();
  if (CROSS_ORIGIN_ALLOWED.has(url.pathname)) return next();

  const sameOrigin = request.headers.get('origin') === url.origin;
  if (sameOrigin) return next();

  const contentType = request.headers.get('content-type');
  const blocked = contentType ? isFormLike(contentType) : true;

  if (blocked) {
    return new Response(`Cross-site ${request.method} submissions are forbidden`, { status: 403 });
  }

  return next();
});
