-- 002_staging_businesses_baseline.sql
-- STAGING ONLY. Run this INSTEAD OF scripts/002_seed_businesses.sql.
--
-- Why this exists
-- * 002_seed_businesses.sql (kept unchanged for historical reference) inserts
--   demonstration venues with unverified Google, Instagram, FSA and
--   Booking.com figures and Unsplash images attributed to providers. It must
--   not be run in staging or production.
-- * The production audit shows public.businesses was NOT built by 001: it has
--   flat provider columns (lat, lng, google_rating, ...), two public-read
--   policies and no category/rating indexes. This file reproduces that shape
--   so the staging drift check compares like with like.
--
-- What it does
-- * Inserts NO rows. Discovery data comes only from live Google Places and
--   genuine provider caches at runtime.
-- * Works whether or not 001 has already been run in staging:
--   - not run: creates the production-shaped table;
--   - run: aligns the empty 001 table to the production shape.
-- * Safe to re-run: every step is conditional.
--
-- Safety guards (the whole script aborts and changes nothing if either fails)
-- * public.businesses must be empty.
-- * auth.users must contain 10 or fewer accounts (production tripwire).
--
-- Note: rating DEFAULT 4.5 mirrors production for drift parity. That default
-- is itself an invented value; removing it is a separate, reviewed follow-up.

begin;

do $$
declare
  v_users bigint;
  v_rows  bigint;
begin
  select count(*) into v_users from auth.users;
  if v_users > 10 then
    raise exception 'ABORT: % auth users found. This does not look like the staging project.', v_users;
  end if;

  if to_regclass('public.businesses') is not null then
    execute 'select count(*) from public.businesses' into v_rows;
    if v_rows > 0 then
      raise exception 'ABORT: public.businesses already has % rows. Stop and report this.', v_rows;
    end if;
  end if;
end $$;

create table if not exists public.businesses (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  category            text not null,
  rating              numeric default 4.5,
  review_count        integer default 0,
  location            text,
  description         text,
  image               text,
  image_urls          text[],
  lat                 numeric,
  lng                 numeric,
  price_level         text default '££',
  tags                text[],
  instagram_followers integer,
  instagram_trending  boolean default false,
  google_rating       numeric,
  google_reviews      integer,
  food_hygiene        integer,
  booking_com_rating  numeric,
  created_at          timestamptz default now()
);

-- Align a table created by 001 (no-ops on a freshly created table).
alter table public.businesses
  alter column rating type numeric,
  alter column rating drop not null,
  alter column rating set default 4.5,
  alter column review_count drop not null,
  alter column review_count set default 0,
  alter column location drop not null,
  alter column image drop not null,
  alter column price_level drop not null,
  alter column price_level set default '££',
  alter column tags drop default,
  add column if not exists image_urls          text[],
  add column if not exists lat                 numeric,
  add column if not exists lng                 numeric,
  add column if not exists instagram_followers integer,
  add column if not exists instagram_trending  boolean default false,
  add column if not exists google_rating       numeric,
  add column if not exists google_reviews      integer,
  add column if not exists food_hygiene        integer,
  add column if not exists booking_com_rating  numeric,
  drop column if exists images,
  drop column if exists gallery,
  drop column if exists coordinates,
  drop column if exists ratings,
  drop column if exists updated_at;

drop index if exists public.idx_businesses_category;
drop index if exists public.idx_businesses_rating;

alter table public.businesses enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'businesses' and policyname = 'Allow public read') then
    create policy "Allow public read" on public.businesses for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'businesses' and policyname = 'Allow public read access') then
    create policy "Allow public read access" on public.businesses for select using (true);
  end if;
end $$;

commit;

-- Verification (read-only): expect 20 columns, 0 rows, 2 SELECT policies.
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'businesses') as column_count,
  (select count(*) from public.businesses) as row_count,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'businesses') as policy_count;
