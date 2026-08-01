-- avinashsadana.com — initial schema
--
-- Security model: Row Level Security is ENABLED on every table and NO policies
-- are created. That means the anon and authenticated roles can do nothing at
-- all. Only the service-role key — which lives in a Vercel environment variable
-- and is used exclusively by the API routes in src/pages/api/ — can read or
-- write. There is no path from the browser to these tables.
--
-- Apply this in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- ---------------------------------------------------------------------------
-- Contact messages
-- ---------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null check (char_length(name) between 2 and 120),
  email       text        not null check (char_length(email) between 3 and 254),
  subject     text        check (subject is null or char_length(subject) <= 180),
  message     text        not null check (char_length(message) between 10 and 5000),
  status      text        not null default 'new' check (status in ('new', 'read', 'archived')),
  -- Salted SHA-256 of the sender's IP. Used for rate limiting only; the raw
  -- address is never stored.
  ip_hash     text,
  created_at  timestamptz not null default now()
);

-- Supports the rate-limit lookup (ip_hash + recent window) and the admin list.
create index if not exists contact_messages_ip_hash_created_at_idx
  on public.contact_messages (ip_hash, created_at desc);
create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

-- ---------------------------------------------------------------------------
-- Guestbook
-- ---------------------------------------------------------------------------
create table if not exists public.guestbook_entries (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null check (char_length(name) between 2 and 80),
  role        text        check (role is null or char_length(role) <= 120),
  message     text        not null check (char_length(message) between 5 and 600),
  -- Nothing is public until this is flipped to true from /admin.
  approved    boolean     not null default false,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index if not exists guestbook_entries_approved_created_at_idx
  on public.guestbook_entries (approved, created_at desc);
create index if not exists guestbook_entries_ip_hash_created_at_idx
  on public.guestbook_entries (ip_hash, created_at desc);

alter table public.guestbook_entries enable row level security;

-- ---------------------------------------------------------------------------
-- Page views
-- ---------------------------------------------------------------------------
create table if not exists public.page_views (
  path        text        primary key,
  count       bigint      not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.page_views enable row level security;

-- Atomic increment. Doing this in the database rather than read-then-write
-- means two concurrent requests can never both write the same count + 1.
create or replace function public.increment_page_view(page_path text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  insert into public.page_views as pv (path, count, updated_at)
  values (page_path, 1, now())
  on conflict (path) do update
    set count = pv.count + 1,
        updated_at = now()
  returning pv.count into new_count;

  return new_count;
end;
$$;

-- The function is only ever called through the service-role client, so nothing
-- else needs execute rights on it.
revoke execute on function public.increment_page_view(text) from public, anon, authenticated;
