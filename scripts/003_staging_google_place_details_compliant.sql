-- STAGING replacement for 003_add_google_place_details_cache.sql.
-- Run this INSTEAD of the original 003 on staging project fmscnxlciphrvsdkjaei only.
-- The original file is kept unchanged for historical reference and production parity.
--
-- Why this differs from the original:
--   1. Google Maps Platform terms (Places API, non-EEA) allow storing the place_id
--      indefinitely and latitude/longitude for at most 30 days. Editorial summaries,
--      amenity flags and address fields may not be pre-fetched, cached or stored,
--      and there is no 7-day allowance. This table therefore keeps the same columns
--      for application compatibility, but `details` must stay empty, so no Places
--      content can be stored. Enrichment writes containing Places content are rejected.
--   2. Supabase grants INSERT/UPDATE/DELETE/TRUNCATE to browser roles by default.
--      RLS blocks INSERT/UPDATE/DELETE, but TRUNCATE bypasses RLS, so every write
--      privilege is revoked from anon and authenticated. Only server-side code using
--      the service role can write.
--
-- No data is inserted. Nothing outside public.google_place_details is touched.

create table if not exists public.google_place_details (
  place_id text primary key,
  details jsonb not null default '{}'::jsonb,
  details_last_synced_at timestamptz not null default now(),
  constraint google_place_details_no_places_content check (details = '{}'::jsonb)
);

alter table public.google_place_details enable row level security;

revoke insert, update, delete, truncate, references, trigger
  on public.google_place_details from public, anon, authenticated;
grant select on public.google_place_details to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'google_place_details'
      and policyname = 'Allow public read access'
  ) then
    create policy "Allow public read access" on public.google_place_details
      for select using (true);
  end if;
end
$$;

create index if not exists idx_google_place_details_synced_at
  on public.google_place_details (details_last_synced_at);
