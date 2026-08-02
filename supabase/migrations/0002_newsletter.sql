-- Newsletter subscribers.
--
-- Same security model as everything else: RLS on, no policies, so the anon key
-- can neither read the list nor add to it. Only the service-role client behind
-- /api/subscribe can write, and only /admin can read.
--
-- Double opt-in: a row starts unconfirmed with a single-use token. It only
-- counts as a real subscriber once the token is used. That keeps someone from
-- signing up an address they don't own, and keeps the list deliverable.

create table if not exists public.newsletter_subscribers (
  id            uuid primary key default gen_random_uuid(),
  email         text        not null unique check (char_length(email) between 3 and 254),
  status        text        not null default 'pending'
                  check (status in ('pending', 'confirmed', 'unsubscribed')),
  -- Single-use tokens for confirming and for one-click unsubscribe.
  confirm_token text        not null,
  ip_hash       text,
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);

create index if not exists newsletter_status_created_idx
  on public.newsletter_subscribers (status, created_at desc);
create index if not exists newsletter_confirm_token_idx
  on public.newsletter_subscribers (confirm_token);
create index if not exists newsletter_ip_hash_created_idx
  on public.newsletter_subscribers (ip_hash, created_at desc);

alter table public.newsletter_subscribers enable row level security;
