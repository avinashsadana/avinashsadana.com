-- Newsletter sending.
--
-- Same security model as everything else: RLS on, no policies, so only the
-- service-role client behind the API routes can touch any of this.

-- A permanent per-subscriber token for one-click unsubscribe. URL-safe by
-- construction so it can sit in a link without encoding.
alter table public.newsletter_subscribers
  add column if not exists unsubscribe_token text;

update public.newsletter_subscribers
   set unsubscribe_token = replace(replace(encode(gen_random_bytes(18), 'base64'), '+', '-'), '/', '_')
 where unsubscribe_token is null;

alter table public.newsletter_subscribers
  alter column unsubscribe_token set default
    replace(replace(encode(gen_random_bytes(18), 'base64'), '+', '-'), '/', '_');

alter table public.newsletter_subscribers
  alter column unsubscribe_token set not null;

create unique index if not exists newsletter_unsubscribe_token_idx
  on public.newsletter_subscribers (unsubscribe_token);

-- One row per newsletter. Records what was sent, to how many, and when.
create table if not exists public.newsletter_sends (
  id              uuid primary key default gen_random_uuid(),
  post_slug       text        not null,
  subject         text        not null,
  status          text        not null default 'draft'
                    check (status in ('draft', 'sending', 'sent', 'failed')),
  recipient_count integer     not null default 0,
  sent_count      integer     not null default 0,
  error           text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

-- The safeguard that matters: an article can only have one live send record, so
-- the same piece can never be mailed to the list twice. A failed attempt is
-- excluded, which leaves retrying possible.
create unique index if not exists newsletter_sends_one_per_post_idx
  on public.newsletter_sends (post_slug)
  where status in ('draft', 'sending', 'sent');

create index if not exists newsletter_sends_created_idx
  on public.newsletter_sends (created_at desc);

alter table public.newsletter_sends enable row level security;
