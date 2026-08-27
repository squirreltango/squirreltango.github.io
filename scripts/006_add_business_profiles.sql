-- =============================================================================
-- 006: Business-managed venue profiles (booking links, socials, description)
-- =============================================================================
--
-- ADDITIVE AND NON-DESTRUCTIVE.
--
-- Only CREATEs new objects. No DROP TABLE, no ALTER ... DROP, no DELETE and no
-- UPDATE against existing data. The pre-existing tables (businesses,
-- google_place_details, fsa_hygiene_details) are not touched.
--
-- Safe to re-run: every statement is guarded by IF NOT EXISTS or an equivalent
-- catalogue check. Run this AFTER 005 (it references business_claims).
--
-- WHY A SEPARATE TABLE, NOT COLUMNS ON `businesses`:
-- `businesses` holds curated seed rows keyed by UUID, while the venues users
-- browse arrive live from Google Places keyed by Place ID. Owner-supplied
-- content therefore hangs off `business_ref TEXT` (no FK), the same convention
-- used by 004 and 005. This also keeps merchant-edited data cleanly separated
-- from ingested Google/FSA data, so an ingestion run can never overwrite it.
-- =============================================================================


-- =============================================================================
-- 1. BUSINESS PROFILES
-- =============================================================================
-- Owner-managed presentation layer for a claimed venue. Editable only by the
-- user whose claim for that venue has been APPROVED.

create table if not exists public.business_profiles (
  id              uuid primary key default gen_random_uuid(),
  -- The owning claim. Deleting the claim removes the merchant content with it.
  claim_id        uuid not null references public.business_claims(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- Denormalised venue key so the public venue page can look up owner content
  -- with a single query, without joining through claims.
  business_ref    text not null,

  tagline         text,
  description     text,

  -- Booking / ordering destinations. Stored individually rather than as JSON so
  -- each can be validated and indexed independently.
  booking_url     text,
  menu_url        text,
  order_url       text,
  website_url     text,
  contact_phone   text,
  contact_email   text,

  -- Social presence.
  instagram_url   text,
  facebook_url    text,
  x_url           text,
  tiktok_url      text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One merchant profile per claimed venue.
  unique (claim_id)
);

create index if not exists business_profiles_ref_idx
  on public.business_profiles (business_ref);
create index if not exists business_profiles_user_idx
  on public.business_profiles (user_id);

alter table public.business_profiles enable row level security;

do $$
begin
  -- Owner can always read their own merchant content, approved or not, so the
  -- portal can show what they have drafted.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_profiles' and policyname='bizprof_select_own') then
    create policy "bizprof_select_own" on public.business_profiles
      for select using (auth.uid() = user_id);
  end if;

  -- Writes require BOTH ownership AND an APPROVED claim for that exact venue.
  -- This is the parent-authorization rule: single-owner RLS alone would let a
  -- user publish merchant content for a venue they merely submitted a claim for.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_profiles' and policyname='bizprof_insert_approved') then
    create policy "bizprof_insert_approved" on public.business_profiles
      for insert with check (
        auth.uid() = user_id
        and exists (
          select 1 from public.business_claims c
          where c.id = business_profiles.claim_id
            and c.user_id = auth.uid()
            and c.status = 'approved'
            and c.business_ref = business_profiles.business_ref
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_profiles' and policyname='bizprof_update_approved') then
    create policy "bizprof_update_approved" on public.business_profiles
      for update
      using (
        auth.uid() = user_id
        and exists (
          select 1 from public.business_claims c
          where c.id = business_profiles.claim_id
            and c.user_id = auth.uid()
            and c.status = 'approved'
        )
      )
      with check (
        auth.uid() = user_id
        and exists (
          select 1 from public.business_claims c
          where c.id = business_profiles.claim_id
            and c.user_id = auth.uid()
            and c.status = 'approved'
            and c.business_ref = business_profiles.business_ref
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_profiles' and policyname='bizprof_delete_own') then
    create policy "bizprof_delete_own" on public.business_profiles
      for delete using (auth.uid() = user_id);
  end if;
end $$;


-- =============================================================================
-- 2. updated_at trigger
-- =============================================================================
-- Reuses public.touch_updated_at() created in 005.

drop trigger if exists business_profiles_touch_updated_at on public.business_profiles;
create trigger business_profiles_touch_updated_at
  before update on public.business_profiles
  for each row execute function public.touch_updated_at();
