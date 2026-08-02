# avinashsadana.com

Personal site for Avinash Sadana — MBA candidate in International Business,
founder of The WeDesi Festival and Cycle N' Chai, ultra-distance cyclist.

**To edit content, read [CONTENT-GUIDE.md](./CONTENT-GUIDE.md).** This file is
about how the thing is built.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Astro 7 — static by default, on-demand only where needed |
| Styling | Tailwind CSS 4, design tokens in `src/styles/global.css` |
| Database | Supabase (Postgres), provisioned via the Vercel Marketplace |
| Email | Resend, optional — see *Email notifications* below |
| Hosting | Vercel |
| Fonts | Fraunces + Inter + JetBrains Mono, self-hosted (no external requests) |

---

## Architecture

Every content page is **prerendered to static HTML**. Only three endpoints and
two pages run on the server, and they are the only things that touch the
database.

```
Browser ──► static HTML (12 prerendered pages)
       └──► /api/contact   ─┐
       └──► /api/guestbook  ├─► service-role client ──► Supabase
       └──► /api/views     ─┘
       └──► /guestbook, /admin (server-rendered)
```

### Security model

Row Level Security is enabled on all three tables **with no policies at all**.
The anon role can therefore read nothing and write nothing — verified, not
assumed:

```
service role sees contact_messages rows: 1
anon READ contact_messages -> rows=0
anon WRITE guestbook_entries -> BLOCKED (42501)
anon RPC increment_page_view -> BLOCKED (42501)
```

The only way in or out is the service-role key, which lives in a Vercel
environment variable and is used exclusively by server code in `src/pages/api/`
and `src/lib/supabase.ts`. It never reaches the browser.

Spam is handled without a CAPTCHA: an off-screen honeypot field, a minimum
submit time, and a per-IP-hash rate limit. IP addresses are salted and hashed —
never stored raw.

Security headers live in `vercel.json`: a Content-Security-Policy,
`X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`
(Vercel adds HSTS itself). `font-src` has to allow `data:` — Vite inlines small
woff2 subsets as data URIs, and a preview deploy without it blocked every font
on the page. Always test a header change on a preview deploy before production;
`vercel.json` also rejects unknown keys, so notes like this belong here.

---

## Local development

```bash
npm install
vercel env pull      # writes .env.local with Supabase credentials
npm run dev          # http://localhost:4321
```

| Script | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run check` | TypeScript + Astro diagnostics |
| `npm run test:e2e` | Playwright suite (44 tests, Chrome + mobile Safari) |
| `npm run verify:build` | Asserts the build output — sitemap, prerendering, no leaked drafts or secrets |
| `npm run verify` | All of the above, in order |
| `npm run assets` | Regenerates `og.png` and favicons from the logo mark |

`npm run assets` is deliberately manual: SVG text rasterises using the fonts of
whichever machine runs it, so the images are generated locally, reviewed, and
committed — rather than produced by a build container with different fonts.

---

## Environment variables

Supplied automatically by the Vercel Marketplace integration:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`

Set manually:

- `ADMIN_PASSWORD` — sign-in for `/admin` (required for that page to work)
- `RESEND_API_KEY` — optional, see below
- `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` — optional overrides

### Email notifications

Contact messages are written to Supabase **before** any email is attempted, and
are always readable at `/admin`. Email is a convenience layer on top:

- **No `RESEND_API_KEY`** — messages are stored and read at `/admin`. Nothing is lost.
- **With a key** — a notification is also emailed. If Resend fails, the message
  is still saved and the sender still sees success.

Currently configured: `avinashsadana.com` is a verified Resend sending domain
(ap-northeast-1), mail goes from `notifications@avinashsadana.com` to
`avinashsadana12@gmail.com`, and the API key is scoped to **sending access on
that domain only** — it cannot read, list or manage anything.

Resend's free tier (3,000 emails/month) is available directly at
[resend.com](https://resend.com); the Vercel Marketplace listing starts at
$20/month, which this site does not need.

---

## Design

The visual system comes from the logo in `private/avinash-logo-presentation.html`:
ink `#22252A`, signature gold `#C08A2E`, paper `#F7F6F3`.

Gold is used exactly as that system intends — as a mark, a rule, a terminal dot.
It is **never** a text or button fill: gold on paper is 2.81:1, and white on gold
is 3.04:1, both below the readable threshold. Accent *text* uses a darkened gold
(5.11:1 on paper), and primary buttons are ink on paper (14.2:1).

---

## Testing

The suite covers what would actually break in production, not implementation
details:

- every route returns 200 with no console errors
- the contact form stores a message, verified by querying the database
- a honeypot submission is accepted-looking but **not** stored
- a guestbook entry is stored unapproved and does not appear publicly
- the moderation endpoint rejects unauthenticated callers
- share links carry the correctly encoded URL
- theme survives client-side navigation
- content is readable with JavaScript disabled
- no horizontal overflow on mobile, tap targets ≥ 40px

Tests assert against Supabase directly rather than through a test-only endpoint —
nothing in `src/` exists purely to support tests.
