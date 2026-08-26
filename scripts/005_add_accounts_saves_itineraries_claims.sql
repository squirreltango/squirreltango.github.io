-- =============================================================================
-- 005: Accounts, saved places, itineraries, business claims, subscription tiers
-- =============================================================================
--
-- ADDITIVE AND NON-DESTRUCTIVE.
--
-- This migration only CREATEs new objects. It contains no DROP TABLE, no
-- ALTER ... DROP, no DELETE and no UPDATE against existing data. The three
-- existing tables (businesses, google_place_details, fsa_hygiene_details) are
-- not modified in any way.
--
-- Safe to re-run: every statement is guarded with IF NOT EXISTS or an
-- equivalent catalogue check, so a partial run can be repeated without error.
--
-- -----------------------------------------------------------------------------
-- IMPORTANT DESIGN NOTE: why user content does NOT have an FK to businesses
-- -----------------------------------------------------------------------------
-- `businesses.id` is a UUID and holds only the small set of curated seed rows.
-- The venues users actually browse come live from Google Places and are keyed
-- by Google Place ID (e.g. 'ChIJ...'), which are NOT rows in `businesses`.
--
-- A foreign key to businesses(id) would therefore reject a save of almost every
-- real venue in the app. So user content stores `business_ref TEXT` with no FK:
--   - a Google Place ID  ('ChIJ...') for live venues, or
--   - a businesses.id UUID (as text) for curated rows.
--
-- This mirrors the existing convention in 004, where `business_id TEXT` is also
-- kept FK-free for the same reason. `business_snapshot` stores enough denormalised
-- detail (name, address, category, image) to render a saved item even if the
-- upstream Place ID is later retired by Google.
-- =============================================================================


-- =============================================================================
-- 1. PROFILES
-- =============================================================================
-- One row per auth user. `account_type` drives whether the UI shows the
-- personal experience or the business portal.

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  account_type  text not null default 'personal'
                  check (account_type in ('personal', 'business')),
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own') then
    create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert_own') then
    create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own') then
    create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_delete_own') then
    create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);
  end if;
end $$;

-- Auto-create a profile whenever a user signs up. Runs as security definer so
-- it bypasses RLS (there is no session yet at signup time). search_path is
-- pinned to '' and every table fully qualified, so a caller cannot shadow a
-- name and execute their own code as the function owner.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, account_type, display_name)
  values (
    new.id,
    -- Account type is chosen on the sign-up form and arrives as user metadata.
    -- Anything unexpected falls back to 'personal' rather than failing the
    -- signup, since a raised exception here would block account creation.
    case
      when new.raw_user_meta_data ->> 'account_type' = 'business' then 'business'
      else 'personal'
    end,
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- 2. SAVED PLACES
-- =============================================================================
-- Persistent, categorised saves. Replaces the previous client-only behaviour.

create table if not exists public.saved_businesses (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  business_ref      text not null,          -- Google Place ID or curated UUID; see header note
  collection        text not null default 'general',
  notes             text,
  business_snapshot jsonb,                  -- denormalised name/address/category/image
  created_at        timestamptz not null default now(),
  -- A user may only save a given venue once, but the same venue can be saved
  -- by many different users.
  unique (user_id, business_ref)
);

create index if not exists saved_businesses_user_idx
  on public.saved_businesses (user_id, created_at desc);
create index if not exists saved_businesses_collection_idx
  on public.saved_businesses (user_id, collection);

alter table public.saved_businesses enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_businesses' and policyname='saved_select_own') then
    create policy "saved_select_own" on public.saved_businesses for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_businesses' and policyname='saved_insert_own') then
    create policy "saved_insert_own" on public.saved_businesses for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_businesses' and policyname='saved_update_own') then
    create policy "saved_update_own" on public.saved_businesses for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_businesses' and policyname='saved_delete_own') then
    create policy "saved_delete_own" on public.saved_businesses for delete using (auth.uid() = user_id);
  end if;
end $$;


-- =============================================================================
-- 3. ITINERARIES ("My Plans")
-- =============================================================================

create table if not exists public.itineraries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null default 'Untitled plan',
  plan_date    date,
  notes        text,
  -- Sharing: a plan is private until is_public is set. The token is the
  -- capability, so it must be high-entropy and is generated server-side.
  share_token  text unique default encode(gen_random_bytes(16), 'hex'),
  is_public    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists itineraries_user_idx
  on public.itineraries (user_id, plan_date desc nulls last);

alter table public.itineraries enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='itineraries' and policyname='itineraries_select_own') then
    create policy "itineraries_select_own" on public.itineraries for select using (auth.uid() = user_id);
  end if;
  -- Anyone holding the link may read a plan that has been explicitly shared.
  -- Scoped to is_public = true only; private plans stay owner-only.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='itineraries' and policyname='itineraries_select_shared') then
    create policy "itineraries_select_shared" on public.itineraries for select using (is_public = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='itineraries' and policyname='itineraries_insert_own') then
    create policy "itineraries_insert_own" on public.itineraries for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='itineraries' and policyname='itineraries_update_own') then
    create policy "itineraries_update_own" on public.itineraries for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='itineraries' and policyname='itineraries_delete_own') then
    create policy "itineraries_delete_own" on public.itineraries for delete using (auth.uid() = user_id);
  end if;
end $$;


-- Timeline entries. Either a real venue (business_ref) or a free-text custom
-- activity ("picnic in the park"), so at least one of the two must be present.
create table if not exists public.itinerary_items (
  id                uuid primary key default gen_random_uuid(),
  itinerary_id      uuid not null references public.itineraries(id) on delete cascade,
  business_ref      text,
  custom_title      text,
  start_time        time,
  duration_minutes  integer check (duration_minutes is null or duration_minutes > 0),
  position          integer not null default 0,
  notes             text,
  business_snapshot jsonb,
  created_at        timestamptz not null default now(),
  constraint itinerary_items_has_subject
    check (business_ref is not null or nullif(trim(custom_title), '') is not null)
);

create index if not exists itinerary_items_itinerary_idx
  on public.itinerary_items (itinerary_id, position);

alter table public.itinerary_items enable row level security;

-- Child-table policies enforce BOTH ownership of the parent AND the parent
-- relationship, so an item cannot be attached to someone else's plan.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='itinerary_items' and policyname='itinerary_items_select') then
    create policy "itinerary_items_select" on public.itinerary_items for select
      using (exists (
        select 1 from public.itineraries i
        where i.id = itinerary_items.itinerary_id
          and (i.user_id = auth.uid() or i.is_public = true)
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='itinerary_items' and policyname='itinerary_items_insert') then
    create policy "itinerary_items_insert" on public.itinerary_items for insert
      with check (exists (
        select 1 from public.itineraries i
        where i.id = itinerary_items.itinerary_id and i.user_id = auth.uid()
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='itinerary_items' and policyname='itinerary_items_update') then
    create policy "itinerary_items_update" on public.itinerary_items for update
      using (exists (
        select 1 from public.itineraries i
        where i.id = itinerary_items.itinerary_id and i.user_id = auth.uid()
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='itinerary_items' and policyname='itinerary_items_delete') then
    create policy "itinerary_items_delete" on public.itinerary_items for delete
      using (exists (
        select 1 from public.itineraries i
        where i.id = itinerary_items.itinerary_id and i.user_id = auth.uid()
      ));
  end if;
end $$;


-- Who is coming along. Free-text so a plan can include people without accounts.
create table if not exists public.itinerary_participants (
  id           uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  name         text not null,
  email        text,
  created_at   timestamptz not null default now()
);

create index if not exists itinerary_participants_itinerary_idx
  on public.itinerary_participants (itinerary_id);

alter table public.itinerary_participants enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='itinerary_participants' and policyname='itinerary_participants_select') then
    create policy "itinerary_participants_select" on public.itinerary_participants for select
      using (exists (
        select 1 from public.itineraries i
        where i.id = itinerary_participants.itinerary_id
          and (i.user_id = auth.uid() or i.is_public = true)
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='itinerary_participants' and policyname='itinerary_participants_write') then
    create policy "itinerary_participants_write" on public.itinerary_participants for insert
      with check (exists (
        select 1 from public.itineraries i
        where i.id = itinerary_participants.itinerary_id and i.user_id = auth.uid()
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='itinerary_participants' and policyname='itinerary_participants_delete') then
    create policy "itinerary_participants_delete" on public.itinerary_participants for delete
      using (exists (
        select 1 from public.itineraries i
        where i.id = itinerary_participants.itinerary_id and i.user_id = auth.uid()
      ));
  end if;
end $$;


-- =============================================================================
-- 4. BUSINESS CLAIMS
-- =============================================================================
-- A business owner asserting control of a venue. Deliberately NOT
-- self-approving: status starts 'pending' and only a reviewer moves it to
-- 'approved'. The update policy below lets an owner edit their own submission
-- but a CHECK keeps status out of their hands.

create table if not exists public.business_claims (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  business_ref   text not null,
  business_name  text not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected')),
  contact_email  text,
  contact_phone  text,
  evidence_notes text,
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz,
  -- One claim per user per venue; a venue could still be contested by two
  -- different users, which a reviewer resolves.
  unique (user_id, business_ref)
);

create index if not exists business_claims_user_idx
  on public.business_claims (user_id, created_at desc);
create index if not exists business_claims_ref_idx
  on public.business_claims (business_ref, status);

alter table public.business_claims enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_claims' and policyname='claims_select_own') then
    create policy "claims_select_own" on public.business_claims for select using (auth.uid() = user_id);
  end if;
  -- New claims must be pending. A user cannot submit a pre-approved claim.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_claims' and policyname='claims_insert_own') then
    create policy "claims_insert_own" on public.business_claims for insert
      with check (auth.uid() = user_id and status = 'pending');
  end if;
  -- Owners may correct their submission details but cannot self-approve:
  -- the row must still be pending both before and after the update.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_claims' and policyname='claims_update_own_pending') then
    create policy "claims_update_own_pending" on public.business_claims for update
      using (auth.uid() = user_id and status = 'pending')
      with check (auth.uid() = user_id and status = 'pending');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_claims' and policyname='claims_delete_own') then
    create policy "claims_delete_own" on public.business_claims for delete using (auth.uid() = user_id);
  end if;
end $$;


-- =============================================================================
-- 5. SUBSCRIPTIONS (Bronze / Silver / Gold)
-- =============================================================================
-- Records which tier a claimed business is on. Read-only from the client:
-- there is deliberately NO insert/update policy for end users, so a user
-- cannot grant themselves a paid tier from the browser. Tier changes must go
-- through the service role after a verified payment event.

create table if not exists public.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  claim_id     uuid references public.business_claims(id) on delete cascade,
  tier         text not null default 'bronze'
                 check (tier in ('bronze', 'silver', 'gold')),
  status       text not null default 'active'
                 check (status in ('active', 'cancelled', 'past_due')),
  started_at   timestamptz not null default now(),
  renews_at    timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
create index if not exists subscriptions_claim_idx on public.subscriptions (claim_id);

alter table public.subscriptions enable row level security;

do $$ begin
  -- SELECT only. Writes intentionally require the service role.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='subscriptions' and policyname='subscriptions_select_own') then
    create policy "subscriptions_select_own" on public.subscriptions for select using (auth.uid() = user_id);
  end if;
end $$;


-- =============================================================================
-- 6. GOLD WAITLIST
-- =============================================================================
-- Gold is not yet purchasable, so interest is captured here instead.

create table if not exists public.gold_waitlist (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  business_ref  text,
  business_name text,
  contact_email text,
  created_at    timestamptz not null default now(),
  unique (user_id, business_ref)
);

alter table public.gold_waitlist enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gold_waitlist' and policyname='waitlist_select_own') then
    create policy "waitlist_select_own" on public.gold_waitlist for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gold_waitlist' and policyname='waitlist_insert_own') then
    create policy "waitlist_insert_own" on public.gold_waitlist for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gold_waitlist' and policyname='waitlist_delete_own') then
    create policy "waitlist_delete_own" on public.gold_waitlist for delete using (auth.uid() = user_id);
  end if;
end $$;


-- =============================================================================
-- 7. updated_at maintenance
-- =============================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists itineraries_touch_updated_at on public.itineraries;
create trigger itineraries_touch_updated_at
  before update on public.itineraries
  for each row execute function public.touch_updated_at();


-- =============================================================================
-- 8. Backfill profiles for any users that already exist
-- =============================================================================
-- Additive only: inserts missing profile rows, never modifies existing ones.

insert into public.profiles (id, account_type)
select u.id, 'personal'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
