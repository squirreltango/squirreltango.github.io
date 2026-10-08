-- REVIEW ONLY. Target: cytwncsewgetuwmhevdv. Never run from application code.
-- Database foundation only: deploy reviewed server mutation paths before use.
-- Existing claim INSERT/UPDATE/DELETE clients will need those server paths.
-- Abort on duplicate approved claims or a missing/unconfirmed admin; never repair data automatically.
begin;

lock table public.business_claims in share row exclusive mode;
do $$
begin
  if exists (
    select 1 from public.business_claims
    where status = 'approved' group by business_ref having count(*) > 1
  ) then
    raise exception 'Duplicate approved claims require manual review';
  end if;
  if (select count(*) from auth.users
      where lower(email) = 'rajekasingam@gmail.com'
        and email_confirmed_at is not null
        and deleted_at is null and not is_anonymous
        and (banned_until is null or banned_until <= now())) <> 1 then
    raise exception 'Exactly one confirmed, active intended admin must exist';
  end if;
end $$;

create table public.platform_admin_entitlements (
  user_id uuid primary key references auth.users(id),
  platform_admin boolean not null default false,
  subscription_test_mode boolean not null default false,
  granted_at timestamptz not null default now(),
  check (not subscription_test_mode or platform_admin)
);
alter table public.platform_admin_entitlements enable row level security;
revoke all on public.platform_admin_entitlements from public, anon, authenticated;
grant select, insert, update, delete on public.platform_admin_entitlements to service_role;

insert into public.platform_admin_entitlements
  (user_id, platform_admin, subscription_test_mode)
select id, true, true from auth.users
where lower(email) = 'rajekasingam@gmail.com'
  and email_confirmed_at is not null and deleted_at is null
  and not is_anonymous and (banned_until is null or banned_until <= now());

alter table public.business_claims drop constraint business_claims_status_check;
alter table public.business_claims add constraint business_claims_status_check
  check (status in ('pending', 'approved', 'rejected', 'revoked', 'disputed'));
create unique index business_claims_one_approved_business
  on public.business_claims (business_ref) where status = 'approved';

-- Preserve owner SELECT RLS. All future mutations require a server-authorised,
-- transactional path; claimants cannot delete their history or change references.
revoke insert, update, delete on public.business_claims from public, anon, authenticated;
do $$
declare col record;
begin
  for col in select attname from pg_catalog.pg_attribute
    where attrelid = 'public.business_claims'::regclass
      and attnum > 0 and not attisdropped
  loop
    execute format('revoke insert (%I), update (%I) on public.business_claims from public, anon, authenticated', col.attname, col.attname);
  end loop;
end $$;

create table public.merchant_claim_audit (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.business_claims(id),
  actor_id uuid references auth.users(id),
  action text not null check (action in ('submitted','approved','rejected','revoked','disputed','evidence_added','test_plan_changed')),
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.merchant_claim_audit enable row level security;
revoke all on public.merchant_claim_audit from public, anon, authenticated;
grant select, insert on public.merchant_claim_audit to service_role;
revoke update, delete, truncate on public.merchant_claim_audit from service_role;

create table public.merchant_plan_previews (
  claim_id uuid primary key references public.business_claims(id),
  admin_user_id uuid not null references public.platform_admin_entitlements(user_id),
  tier text not null check (tier in ('bronze', 'silver', 'gold_preview')),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.merchant_plan_previews enable row level security;
revoke all on public.merchant_plan_previews from public, anon, authenticated;
grant select, insert, update, delete on public.merchant_plan_previews to service_role;

-- Remove table-level UPDATE before granting the audited editable columns.
-- account_type is NOT used for platform-admin or test authorisation.
revoke update on public.profiles from public, anon, authenticated;
revoke update (id, account_type, display_name, avatar_url, created_at, updated_at)
  on public.profiles from public, anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

commit;

-- No changes to booking_requests, businesses/provider rows, subscriptions,
-- Instagram credentials, existing claim statuses, or existing profile values.
-- This draft does NOT implement transactional mutation RPCs or OAuth. Do not
-- enable Phase 2 writes until authenticated server checks, atomic auditing,
-- canonical business-reference validation, and abuse controls are implemented.
