 off -- =============================================================================
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

  -- Consumers must be able to read merchant content on a business page, but
  -- ONLY where the claim behind it is approved. Read-only: the write policies
  -- above still require ownership plus an approved claim.
  --
  -- Safe to expose publicly: every column on this table is business-supplied
  -- marketing copy and public contact/booking info, not personal data.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_profiles' and policyname='bizprof_select_public_approved') then
    create policy "bizprof_select_public_approved" on public.business_profiles
      for select using (
        exists (
          select 1 from public.business_claims c
          where c.id = business_profiles.claim_id
            and c.status = 'approved'
        )
      );
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


-- =============================================================================
-- 3. INSTAGRAM CONNECTIONS (architecture for a future authorised Meta link)
-- =============================================================================
-- There is NO Instagram integration today. This table exists so that when
-- genuine Meta/Instagram OAuth is configured, authorised data has a home that
-- is clearly separated from Google/FSA provider facts and from merchant copy.
--
-- Only fields the Instagram Graph API actually returns for a Business/Creator
-- account are modelled. Nothing here is ever populated with sample content:
-- the Preview demo state is computed in application code and never written.
--
-- Tokens are NOT stored here. Access tokens must live in a server-only store,
-- never in a table that any client can select from.

create table if not exists public.business_instagram_connections (
  id                uuid primary key default gen_random_uuid(),
  claim_id          uuid not null references public.business_claims(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  business_ref      text not null,

  -- Connection lifecycle. 'connected' must only ever be set by the server
  -- after a genuine Meta OAuth exchange.
  status            text not null default 'disconnected'
                      check (status in ('disconnected', 'pending', 'connected', 'error', 'revoked')),

  -- Fields the Graph API genuinely provides for professional accounts.
  ig_user_id        text,
  username          text,
  profile_image_url text,
  followers_count   integer check (followers_count is null or followers_count >= 0),
  media_count       integer check (media_count is null or media_count >= 0),

  -- Cached recent media (id, media_url, permalink, caption, media_type,
  -- thumbnail_url, timestamp). Cache only; Meta remains the source of truth.
  recent_media      jsonb,

  last_synced_at    timestamptz,
  error_message     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (claim_id)
);

create index if not exists business_instagram_ref_idx
  on public.business_instagram_connections (business_ref);

alter table public.business_instagram_connections enable row level security;

do $$
begin
  -- Owner sees their own connection state in the portal.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_instagram_connections' and policyname='biz_ig_select_own') then
    create policy "biz_ig_select_own" on public.business_instagram_connections
      for select using (auth.uid() = user_id);
  end if;

  -- Consumers may read ONLY genuinely connected accounts on an approved claim.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_instagram_connections' and policyname='biz_ig_select_public_connected') then
    create policy "biz_ig_select_public_connected" on public.business_instagram_connections
      for select using (
        status = 'connected'
        and exists (
          select 1 from public.business_claims c
          where c.id = business_instagram_connections.claim_id
            and c.status = 'approved'
        )
      );
  end if;

  -- A business owner may create/remove the connection row (and disconnect),
  -- but only against an approved claim they own.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_instagram_connections' and policyname='biz_ig_insert_approved') then
    create policy "biz_ig_insert_approved" on public.business_instagram_connections
      for insert with check (
        auth.uid() = user_id
        and exists (
          select 1 from public.business_claims c
          where c.id = business_instagram_connections.claim_id
            and c.user_id = auth.uid()
            and c.status = 'approved'
            and c.business_ref = business_instagram_connections.business_ref
        )
        -- Clients may only ever request a connection. Promotion to 'connected'
        -- happens server-side (service role) after a real OAuth exchange, so a
        -- client cannot fake a verified Instagram link.
        and status in ('disconnected', 'pending')
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_instagram_connections' and policyname='biz_ig_update_own_limited') then
    create policy "biz_ig_update_own_limited" on public.business_instagram_connections
      for update
      using (auth.uid() = user_id)
      -- Same rule on the way out: a client may reset to disconnected or ask to
      -- reconnect, never self-declare 'connected'.
      with check (auth.uid() = user_id and status in ('disconnected', 'pending', 'revoked'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_instagram_connections' and policyname='biz_ig_delete_own') then
    create policy "biz_ig_delete_own" on public.business_instagram_connections
      for delete using (auth.uid() = user_id);
  end if;
end $$;

drop trigger if exists business_instagram_touch_updated_at on public.business_instagram_connections;
create trigger business_instagram_touch_updated_at
  before update on public.business_instagram_connections
  for each row execute function public.touch_updated_at();


-- =============================================================================
-- 4. SILVER: BOOKING REQUESTS (LookMeUp native booking)
-- =============================================================================
-- Bronze uses external booking_url. Silver accepts booking requests in-app.

create table if not exists public.booking_requests (
  id             uuid primary key default gen_random_uuid(),
  business_ref   text not null,
  -- The approved claim that owns this business, so the merchant can read it.
  claim_id       uuid references public.business_claims(id) on delete cascade,
  -- Null when an unauthenticated customer submits a request.
  customer_id    uuid references auth.users(id) on delete set null,

  customer_name  text not null,
  customer_email text not null,
  customer_phone text,
  party_size     integer check (party_size is null or party_size > 0),
  requested_at   timestamptz not null,
  notes          text,

  status         text not null default 'pending'
                   check (status in ('pending', 'confirmed', 'declined', 'cancelled')),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists booking_requests_ref_idx
  on public.booking_requests (business_ref, requested_at desc);
create index if not exists booking_requests_customer_idx
  on public.booking_requests (customer_id, requested_at desc);

alter table public.booking_requests enable row level security;

do $$
begin
  -- The merchant that owns the approved claim manages its bookings.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='booking_requests' and policyname='bookings_select_merchant') then
    create policy "bookings_select_merchant" on public.booking_requests
      for select using (
        exists (
          select 1 from public.business_claims c
          where c.id = booking_requests.claim_id
            and c.user_id = auth.uid()
            and c.status = 'approved'
        )
      );
  end if;

  -- A signed-in customer can see the requests they made.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='booking_requests' and policyname='bookings_select_customer') then
    create policy "bookings_select_customer" on public.booking_requests
      for select using (customer_id is not null and customer_id = auth.uid());
  end if;

  -- Requests must start pending, and a signed-in customer cannot attribute a
  -- request to someone else.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='booking_requests' and policyname='bookings_insert') then
    create policy "bookings_insert" on public.booking_requests
      for insert to authenticated
      with check (
        status = 'pending'
        and (customer_id is null or customer_id = auth.uid())
      );
  end if;

  -- Only the owning merchant changes a booking's status.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='booking_requests' and policyname='bookings_update_merchant') then
    create policy "bookings_update_merchant" on public.booking_requests
      for update using (
        exists (
          select 1 from public.business_claims c
          where c.id = booking_requests.claim_id
            and c.user_id = auth.uid()
            and c.status = 'approved'
        )
      );
  end if;
end $$;

drop trigger if exists booking_requests_touch_updated_at on public.booking_requests;
create trigger booking_requests_touch_updated_at
  before update on public.booking_requests
  for each row execute function public.touch_updated_at();


-- =============================================================================
-- 5. SILVER: PROFILE ANALYTICS EVENTS
-- =============================================================================
-- Append-only counters for genuine interactions. No sample rows are ever
-- inserted: Preview sample analytics are generated in application code and
-- clearly labelled, so real merchants only ever see real numbers.

create table if not exists public.business_profile_events (
  id           bigserial primary key,
  business_ref text not null,
  event_type   text not null
                 check (event_type in ('profile_view', 'save', 'website_click',
                                       'directions_click', 'booking_click',
                                       'instagram_click', 'phone_click')),
  created_at   timestamptz not null default now()
);

create index if not exists business_profile_events_ref_idx
  on public.business_profile_events (business_ref, event_type, created_at desc);

alter table public.business_profile_events enable row level security;

do $$
begin
  -- Anyone may record an interaction (that is how view counts happen), but
  -- nobody may read raw rows: aggregates come from the function below.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_profile_events' and policyname='events_insert_any') then
    create policy "events_insert_any" on public.business_profile_events
      for insert to anon, authenticated with check (true);
  end if;
end $$;

-- Aggregated counts for the owning merchant only. SECURITY DEFINER so the
-- merchant gets totals without read access to individual event rows.
create or replace function public.get_business_analytics(
  p_business_ref text,
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  -- Caller must own an approved claim for this business.
  if not exists (
    select 1 from public.business_claims c
    where c.business_ref = p_business_ref
      and c.user_id = auth.uid()
      and c.status = 'approved'
  ) then
    raise exception 'Not authorised for this business';
  end if;

  select coalesce(jsonb_object_agg(event_type, cnt), '{}'::jsonb)
    into v_result
  from (
    select event_type, count(*)::int as cnt
    from public.business_profile_events
    where business_ref = p_business_ref
      and created_at >= now() - (greatest(p_days, 1) || ' days')::interval
    group by event_type
  ) t;

  return v_result;
end;
$$;

grant execute on function public.get_business_analytics(text, integer) to authenticated;
