-- =============================================================================
-- 007: Curated-row flagging + Silver self-service (bookings, promotions, site)
-- =============================================================================
--
-- ADDITIVE AND NON-DESTRUCTIVE.
--
-- Builds on 005 (business_claims, touch_updated_at) and 006 (business_profiles,
-- booking_requests, business_profile_events). Creates new objects and adds
-- columns with IF NOT EXISTS guards; the only data mutation is stamping the
-- three legacy seed rows in `businesses` with a source flag so consumer
-- discovery can exclude them WITHOUT deleting anything (existing saves,
-- itinerary references and claims keep resolving).
--
-- Safe to re-run. Run AFTER 005 and 006.
-- =============================================================================


-- =============================================================================
-- 1. CURATED / SEED ROW FLAG ON `businesses`  (fixes fake-listing leak)
-- =============================================================================
-- The live venues users browse arrive from Google Places at runtime; the
-- `businesses` table only ever held a handful of hand-authored seed rows
-- (fabricated ratings, review counts and hygiene numbers). Those must not sit
-- beside genuine Google results in discovery. We add a `source` column and
-- stamp EVERY currently-existing row as 'curated' (they are all seed rows),
-- while future inserts default to 'ingested' so real provider rows stay
-- visible. Discovery filters out `source = 'curated'`.

alter table public.businesses add column if not exists source text;

-- Stamp existing legacy rows. Runs once meaningfully: rows added later get the
-- 'ingested' default below and are therefore never caught by this UPDATE.
update public.businesses set source = 'curated' where source is null;

alter table public.businesses alter column source set default 'ingested';


-- =============================================================================
-- 2. SILVER: BOOKING CONFIGURATION
-- =============================================================================
-- A single flexible settings row per venue chooses the booking MODEL (table /
-- service / class), and `business_services` holds the configurable units
-- (tables, services or classes) with their own duration/capacity/price/staff.
-- This deliberately does not force every business into one model.

create table if not exists public.business_booking_settings (
  id                    uuid primary key default gen_random_uuid(),
  claim_id              uuid not null references public.business_claims(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  business_ref          text not null,

  -- The booking model this venue uses.
  booking_type          text not null default 'table'
                          check (booking_type in ('table', 'service', 'class')),

  accepts_bookings      boolean not null default false,
  -- Minutes between bookable start times, and the default booking length.
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes > 0),
  default_duration_minutes integer not null default 90 check (default_duration_minutes > 0),
  -- Overall simultaneous capacity (covers / seats / attendees).
  capacity              integer check (capacity is null or capacity > 0),
  -- Weekly opening hours as [{day:0-6, open:"HH:MM", close:"HH:MM"}].
  opening_hours         jsonb not null default '[]'::jsonb,
  -- Dates the venue is closed to bookings.
  blackout_dates        date[] not null default '{}',
  -- 'manual' = owner confirms each request; 'auto' = auto-confirm.
  confirmation_mode     text not null default 'manual'
                          check (confirmation_mode in ('manual', 'auto')),
  cancellation_policy   text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (claim_id)
);

create index if not exists booking_settings_ref_idx
  on public.business_booking_settings (business_ref);


create table if not exists public.business_services (
  id              uuid primary key default gen_random_uuid(),
  claim_id        uuid not null references public.business_claims(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  business_ref    text not null,

  -- 'table' (restaurant), 'service' (salon/spa appointment), 'class' (fitness).
  kind            text not null default 'service'
                    check (kind in ('table', 'service', 'class')),
  name            text not null,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  -- Seats for a table, attendees for a class, usually 1 for an appointment.
  capacity        integer check (capacity is null or capacity > 0),
  price_pennies   integer check (price_pennies is null or price_pennies >= 0),
  staff_name      text,
  notes           text,
  active          boolean not null default true,
  sort_order      integer not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists business_services_ref_idx
  on public.business_services (business_ref, sort_order);


-- Link a native booking request to the specific service/table chosen.
alter table public.booking_requests
  add column if not exists service_id uuid references public.business_services(id) on delete set null;


-- ---- RLS for booking configuration ----------------------------------------
alter table public.business_booking_settings enable row level security;
alter table public.business_services enable row level security;

do $$
begin
  -- Settings: owner full control on an approved claim; consumers may read the
  -- settings for a venue that is accepting bookings (so the booking form can
  -- render slot rules). No personal data on this table.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_booking_settings' and policyname='bset_select_own') then
    create policy "bset_select_own" on public.business_booking_settings
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_booking_settings' and policyname='bset_select_public') then
    create policy "bset_select_public" on public.business_booking_settings
      for select using (
        accepts_bookings = true
        and exists (select 1 from public.business_claims c
                    where c.id = business_booking_settings.claim_id and c.status = 'approved')
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_booking_settings' and policyname='bset_write_approved') then
    create policy "bset_write_approved" on public.business_booking_settings
      for all
      using (
        auth.uid() = user_id
        and exists (select 1 from public.business_claims c
                    where c.id = business_booking_settings.claim_id
                      and c.user_id = auth.uid() and c.status = 'approved')
      )
      with check (
        auth.uid() = user_id
        and exists (select 1 from public.business_claims c
                    where c.id = business_booking_settings.claim_id
                      and c.user_id = auth.uid() and c.status = 'approved'
                      and c.business_ref = business_booking_settings.business_ref)
      );
  end if;

  -- Services: same pattern. Consumers read active services on an approved claim.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_services' and policyname='bsvc_select_own') then
    create policy "bsvc_select_own" on public.business_services
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_services' and policyname='bsvc_select_public') then
    create policy "bsvc_select_public" on public.business_services
      for select using (
        active = true
        and exists (select 1 from public.business_claims c
                    where c.id = business_services.claim_id and c.status = 'approved')
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_services' and policyname='bsvc_write_approved') then
    create policy "bsvc_write_approved" on public.business_services
      for all
      using (
        auth.uid() = user_id
        and exists (select 1 from public.business_claims c
                    where c.id = business_services.claim_id
                      and c.user_id = auth.uid() and c.status = 'approved')
      )
      with check (
        auth.uid() = user_id
        and exists (select 1 from public.business_claims c
                    where c.id = business_services.claim_id
                      and c.user_id = auth.uid() and c.status = 'approved'
                      and c.business_ref = business_services.business_ref)
      );
  end if;
end $$;

drop trigger if exists booking_settings_touch_updated_at on public.business_booking_settings;
create trigger booking_settings_touch_updated_at
  before update on public.business_booking_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists business_services_touch_updated_at on public.business_services;
create trigger business_services_touch_updated_at
  before update on public.business_services
  for each row execute function public.touch_updated_at();


-- =============================================================================
-- 3. SILVER: PROMOTIONS / PUSH OFFERS  (also Bronze paid-boost drafts)
-- =============================================================================
-- Stores merchant-authored campaign drafts. NO push notifications are sent by
-- this migration; `status` is a lifecycle flag only. `is_paid_boost` marks a
-- Bronze paid add-on request (payment processing is not built yet).

create table if not exists public.business_promotions (
  id            uuid primary key default gen_random_uuid(),
  claim_id      uuid not null references public.business_claims(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  business_ref  text not null,

  title         text not null,
  description   text,
  cta_label     text,
  cta_url       text,
  starts_on     date,
  ends_on       date,
  -- Aggregate targeting only; never resolves to individual user identities.
  audience      text not null default 'all'
                  check (audience in ('all', 'saved', 'itinerary', 'nearby', 'category')),
  status        text not null default 'draft'
                  check (status in ('draft', 'scheduled', 'active', 'ended')),
  -- True when this is a Bronze paid "boost" request rather than a Silver promo.
  is_paid_boost boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists business_promotions_ref_idx
  on public.business_promotions (business_ref, status);

alter table public.business_promotions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_promotions' and policyname='promo_select_own') then
    create policy "promo_select_own" on public.business_promotions
      for select using (auth.uid() = user_id);
  end if;
  -- Consumers may read only ACTIVE promotions on an approved claim.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_promotions' and policyname='promo_select_public_active') then
    create policy "promo_select_public_active" on public.business_promotions
      for select using (
        status = 'active'
        and exists (select 1 from public.business_claims c
                    where c.id = business_promotions.claim_id and c.status = 'approved')
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_promotions' and policyname='promo_write_approved') then
    create policy "promo_write_approved" on public.business_promotions
      for all
      using (
        auth.uid() = user_id
        and exists (select 1 from public.business_claims c
                    where c.id = business_promotions.claim_id
                      and c.user_id = auth.uid() and c.status = 'approved')
      )
      with check (
        auth.uid() = user_id
        and exists (select 1 from public.business_claims c
                    where c.id = business_promotions.claim_id
                      and c.user_id = auth.uid() and c.status = 'approved'
                      and c.business_ref = business_promotions.business_ref)
      );
  end if;
end $$;

drop trigger if exists business_promotions_touch_updated_at on public.business_promotions;
create trigger business_promotions_touch_updated_at
  before update on public.business_promotions
  for each row execute function public.touch_updated_at();


-- =============================================================================
-- 4. SILVER: TEMPLATE WEBSITE BUILDER
-- =============================================================================
-- A simple branded microsite built from existing LookMeUp profile data.
-- `custom_domain` is architecture only; no domain is purchased or verified.

create table if not exists public.business_websites (
  id             uuid primary key default gen_random_uuid(),
  claim_id       uuid not null references public.business_claims(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  business_ref   text not null,

  template       text not null default 'classic'
                   check (template in ('classic', 'bold', 'minimal')),
  hero_image_url text,
  headline       text,
  about          text,
  cta_label      text,
  cta_url        text,
  -- Ordered section keys, e.g. ["hero","about","services","gallery","contact"].
  section_order  text[] not null default '{}',
  -- Chosen photo URLs from the venue's existing gallery.
  selected_photos text[] not null default '{}',
  -- Architecture for future custom-domain support; not registered/verified.
  custom_domain  text,
  published      boolean not null default false,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (claim_id)
);

create index if not exists business_websites_ref_idx
  on public.business_websites (business_ref);

alter table public.business_websites enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_websites' and policyname='site_select_own') then
    create policy "site_select_own" on public.business_websites
      for select using (auth.uid() = user_id);
  end if;
  -- Published sites on an approved claim are publicly readable.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_websites' and policyname='site_select_public_published') then
    create policy "site_select_public_published" on public.business_websites
      for select using (
        published = true
        and exists (select 1 from public.business_claims c
                    where c.id = business_websites.claim_id and c.status = 'approved')
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_websites' and policyname='site_write_approved') then
    create policy "site_write_approved" on public.business_websites
      for all
      using (
        auth.uid() = user_id
        and exists (select 1 from public.business_claims c
                    where c.id = business_websites.claim_id
                      and c.user_id = auth.uid() and c.status = 'approved')
      )
      with check (
        auth.uid() = user_id
        and exists (select 1 from public.business_claims c
                    where c.id = business_websites.claim_id
                      and c.user_id = auth.uid() and c.status = 'approved'
                      and c.business_ref = business_websites.business_ref)
      );
  end if;
end $$;

drop trigger if exists business_websites_touch_updated_at on public.business_websites;
create trigger business_websites_touch_updated_at
  before update on public.business_websites
  for each row execute function public.touch_updated_at();


-- =============================================================================
-- 5. EXTEND ANALYTICS EVENT TYPES  (real events only, still aggregated)
-- =============================================================================
-- Add the interaction types the Silver analytics view summarises. Non-
-- destructive: drops and re-adds the CHECK with a superset of the old values.

alter table public.business_profile_events
  drop constraint if exists business_profile_events_event_type_check;

alter table public.business_profile_events
  add constraint business_profile_events_event_type_check
  check (event_type in (
    'profile_view', 'save', 'website_click', 'directions_click',
    'booking_click', 'instagram_click', 'phone_click',
    -- Added in 007:
    'card_click', 'itinerary_add', 'booking_completed'
  ));
