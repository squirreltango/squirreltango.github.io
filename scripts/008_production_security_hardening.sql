-- Production security hardening for existing Supabase project
-- Project reference: cytwncsewgetuwmhevdv
--
-- REVIEW ONLY: this migration is intentionally NOT applied by the app or by v0.
-- Apply manually in the existing project's SQL Editor only after reviewing the
-- live constraints, indexes, function privileges, and application write paths.
--
-- This migration does not create a Supabase project, change providers, delete
-- data, or alter the existing database connection.

begin;

-- 1. Preserve all existing businesses SELECT policies.
-- The supplied audit cannot safely identify which similarly named policy is
-- canonical in production, so this migration intentionally changes none.

-- 2. Prevent unrestricted analytics payloads.
-- The application should still add server/API rate limiting before launch.
drop policy if exists events_insert_any on public.business_profile_events;
create policy events_insert_validated
  on public.business_profile_events
  for insert
  to anon, authenticated
  with check (
    business_ref is not null
    and length(btrim(business_ref)) between 1 and 200
    and event_type in (
      'profile_view',
      'save',
      'itinerary_add',
      'booking_click',
      'website_click'
    )
  );

-- 3. Keep account_type out of ordinary self-service profile updates.
-- RLS policies protect rows, not individual columns. Revoke browser UPDATE
-- privilege for the entitlement-bearing column, while leaving ordinary profile
-- fields governed by the existing owner policy.
revoke update (account_type) on public.profiles from anon, authenticated;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

commit;

-- Manual follow-up required before applying:
-- * Verify account_type is not accepted from any browser profile update path.
-- * Verify the exact event_type values used by the deployed app.
-- * Existing businesses SELECT policies are intentionally unchanged.
-- * Confirm exec_sql is not executable by anon/authenticated.
-- * Add server-side booking validation/rate limiting before enabling public booking writes.
--
-- Recommended read-only verification:
-- select policyname, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('businesses','profiles','business_profile_events')
-- order by tablename, policyname;
--
-- select routine_name, grantee, privilege_type
-- from information_schema.routine_privileges
-- where routine_schema = 'public' and routine_name = 'exec_sql';

-- NOTE: PostgreSQL RLS policies cannot restrict individual columns. The
-- profiles policy above preserves row ownership, but a separate trusted
-- account/admin update path is required to make account_type immutable to the
-- browser. Do not treat this migration alone as entitlement hardening.

-- Optional safer replacement for profiles_update_own, after the app has moved
-- profile edits to a server-side allowlist/RPC:
-- revoke update (account_type) on public.profiles from authenticated;
-- revoke update (account_type) on public.profiles from anon;
-- grant update (display_name, first_name, last_name) on public.profiles to authenticated;

-- The optional statements are intentionally commented out because the live
-- profile column set must be confirmed first.

-- End of review-only migration.
