-- Adds the columns required for idempotent Google Places ingestion.
--
-- Run this in the Supabase SQL editor BEFORE calling
-- /api/admin/ingest-google-places. Every statement is idempotent, so it is
-- safe to run more than once. No existing rows or columns are removed.

-- 1. Google sync columns -----------------------------------------------------

alter table public.businesses
  add column if not exists google_place_id text,
  add column if not exists source          text,
  add column if not exists place_types     text[],
  add column if not exists address         text,
  add column if not exists area            text,
  add column if not exists open_now        boolean,
  add column if not exists last_synced_at  timestamptz;

-- The Google Place ID is the unique external identifier used for upserts.
-- A partial unique index keeps existing curated rows (which have a NULL
-- place id) valid while still preventing duplicate Google records.
create unique index if not exists businesses_google_place_id_key
  on public.businesses (google_place_id)
  where google_place_id is not null;

-- 2. Curated columns preserved across syncs ---------------------------------
-- Ingestion never writes to these, so manual edits survive a re-sync.

alter table public.businesses
  add column if not exists featured          boolean not null default false,
  add column if not exists verified          boolean not null default false,
  add column if not exists curated           boolean not null default false,
  add column if not exists ai_match_reasons  text[],
  add column if not exists instagram_handle  text,
  add column if not exists fsa_match         jsonb;

-- 3. Backfill --------------------------------------------------------------
-- Existing hand-entered rows are marked as curated so the UI and future
-- ingestion runs can tell them apart from synced Google records.

update public.businesses
  set source = coalesce(source, 'curated'),
      curated = true
  where source is null;

-- 4. Helpful lookup indexes -------------------------------------------------

create index if not exists businesses_category_idx on public.businesses (category);
create index if not exists businesses_source_idx   on public.businesses (source);
