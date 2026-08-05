-- Articles move out of code files and into the database, so writing happens in
-- one place — /admin — with no filenames, no frontmatter and no commits.
--
-- Same security model as everything else: RLS on, no policies. Only the
-- service-role client behind the API routes can read or write, and the public
-- pages render through it server-side.

create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text        not null unique
                check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title       text        not null check (char_length(title) between 3 and 200),
  description text        not null default '' check (char_length(description) <= 400),
  body        text        not null default '',
  tags        text[]      not null default '{}',
  status      text        not null default 'draft'
                check (status in ('draft', 'published')),
  pub_date    timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists posts_status_pubdate_idx
  on public.posts (status, pub_date desc);

alter table public.posts enable row level security;

-- Keeps updated_at honest without the application having to remember.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function public.touch_updated_at();
