-- REVIEW ONLY. Target: cytwncsewgetuwmhevdv. Never run from application code.
-- Includes Phase 2 server RPCs. Deploy matching reviewed application paths together.
-- Still unapplied: staging security/concurrency verification is required before production approval.
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
    execute format('revoke insert (%I), update (%I) on public.business_claims from public, anon, authenticated, service_role', col.attname, col.attname);
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

-- Server-owned entry points. No browser role may execute these functions.
create table public.merchant_rate_limits (
  actor_id uuid not null references auth.users(id),
  scope text not null,
  window_start timestamptz not null,
  attempts integer not null,
  primary key (actor_id, scope)
);
alter table public.merchant_rate_limits enable row level security;
revoke all on public.merchant_rate_limits from public, anon, authenticated, service_role;

create function public.phase2_rate_limit(p_actor uuid, p_scope text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer; cap integer;
begin
  cap := case p_scope when 'submit' then 5 when 'admin' then 60 when 'profile' then 60 when 'instagram' then 10 else 0 end;
  if cap = 0 or p_actor is null then return false; end if;
  insert into public.merchant_rate_limits as r values (p_actor, p_scope, now(), 1)
  on conflict (actor_id, scope) do update set
    attempts = case when r.window_start < now() - interval '1 hour' then 1 else least(r.attempts + 1, 1000) end,
    window_start = case when r.window_start < now() - interval '1 hour' then now() else r.window_start end
  returning attempts into n;
  return n <= cap;
end $$;

create function public.phase2_submit_claim(p_actor uuid, p_ref text, p_name text, p_email text, p_phone text, p_evidence text)
returns public.business_claims language plpgsql security definer set search_path = '' as $$
declare c public.business_claims;
begin
  if not exists (select 1 from auth.users where id = p_actor and email_confirmed_at is not null
    and deleted_at is null and not is_anonymous and (banned_until is null or banned_until <= now())) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if length(p_ref) not between 1 and 255 or length(p_name) not between 1 and 300
    or length(btrim(coalesce(p_evidence, ''))) not between 10 and 2000
    or length(coalesce(p_email,'')) > 254 or length(coalesce(p_phone,'')) > 40 then
    raise exception 'Invalid claim' using errcode = '22023';
  end if;
  -- Canonical reference/name are resolved by the server, never accepted from a browser as authority.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ref, 0));
  if exists (select 1 from public.business_claims where business_ref = p_ref and status = 'approved') then
    raise exception 'Business already claimed' using errcode = '23505';
  end if;
  insert into public.business_claims (user_id,business_ref,business_name,status,contact_email,contact_phone,evidence_notes)
  values (p_actor,p_ref,p_name,'pending',p_email,p_phone,p_evidence) returning * into c;
  insert into public.merchant_claim_audit (claim_id,actor_id,action,reason)
  values (c.id,p_actor,'submitted','Manual verification requested');
  return c;
end $$;

create function public.phase2_transition_claim(p_actor uuid, p_claim uuid, p_expected text, p_status text, p_reason text)
returns public.business_claims language plpgsql security definer set search_path = '' as $$
declare c public.business_claims;
begin
  perform 1 from public.platform_admin_entitlements where user_id = p_actor and platform_admin for share;
  if not found then raise exception 'Not authorised' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 10 and 2000 then
    raise exception 'Reason required' using errcode = '22023';
  end if;
  select * into c from public.business_claims where id = p_claim for update;
  if not found then raise exception 'Claim not found' using errcode = 'P0002'; end if;
  if c.status is distinct from p_expected then raise exception 'Claim changed; reload' using errcode = '40001'; end if;
  if not coalesce((c.status = 'pending' and p_status in ('approved','rejected','disputed'))
    or (c.status = 'approved' and p_status in ('revoked','disputed'))
    or (c.status = 'disputed' and p_status in ('approved','rejected','revoked'))
    or (c.status in ('rejected','revoked') and p_status = 'disputed'), false) then
    raise exception 'Invalid transition' using errcode = '22023';
  end if;
  if p_status = 'approved' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c.business_ref, 0));
  end if;
  update public.business_claims set status = p_status, reviewed_at = now() where id = p_claim returning * into c;
  insert into public.merchant_claim_audit (claim_id,actor_id,action,reason)
  values (p_claim,p_actor,p_status,btrim(p_reason));
  if p_status <> 'approved' then
    delete from public.merchant_plan_previews where claim_id = p_claim;
    delete from public.merchant_instagram_states where claim_id = p_claim;
    delete from public.merchant_instagram_tokens where claim_id = p_claim;
  end if;
  return c;
end $$;

alter table public.merchant_plan_previews drop constraint merchant_plan_previews_pkey;
alter table public.merchant_plan_previews add primary key (claim_id, admin_user_id);
alter table public.merchant_plan_previews add check (expires_at > updated_at and expires_at <= updated_at + interval '24 hours');
create function public.phase2_set_preview(p_actor uuid, p_claim uuid, p_tier text)
returns public.merchant_plan_previews language plpgsql security definer set search_path = '' as $$
declare result public.merchant_plan_previews;
begin
  perform 1 from public.platform_admin_entitlements where user_id = p_actor and platform_admin and subscription_test_mode for share;
  if not found then raise exception 'Not authorised' using errcode = '42501'; end if;
  perform 1 from public.business_claims where id = p_claim and status = 'approved' for share;
  if not found then raise exception 'Approved claim required' using errcode = '42501'; end if;
  if p_tier not in ('bronze','silver','gold_preview') or p_tier is null then
    raise exception 'Invalid tier' using errcode = '22023';
  end if;
  insert into public.merchant_plan_previews (claim_id,admin_user_id,tier,expires_at,updated_at)
  values (p_claim,p_actor,p_tier,now() + interval '1 hour',now())
  on conflict (claim_id,admin_user_id) do update set tier = excluded.tier, expires_at = excluded.expires_at, updated_at = excluded.updated_at
  returning * into result;
  insert into public.merchant_claim_audit (claim_id,actor_id,action,reason)
  values (p_claim,p_actor,'test_plan_changed','Private one-hour preview: ' || p_tier);
  return result;
end $$;

-- Immutable history, including against accidental service-role modification.
create function public.phase2_immutable_audit() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Claim audit is append-only'; end $$;
create trigger phase2_audit_immutable before update or delete or truncate on public.merchant_claim_audit
for each statement execute function public.phase2_immutable_audit();
revoke insert, update, delete, truncate on public.business_claims, public.merchant_claim_audit, public.merchant_plan_previews from service_role;
grant select on public.business_claims, public.merchant_claim_audit, public.merchant_plan_previews to service_role;

-- Lock parent approval for every enrichment write, including DELETE. A revoke
-- either waits for an in-flight edit or wins first and makes that edit fail.
create function public.phase2_require_approved_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare item record;
begin
  if TG_OP = 'DELETE' then item := old; else item := new; end if;
  if TG_OP = 'UPDATE' and (new.claim_id is distinct from old.claim_id or new.user_id is distinct from old.user_id
    or new.business_ref is distinct from old.business_ref) then
    raise exception 'Ownership is immutable' using errcode = '42501';
  end if;
  perform 1 from public.business_claims where id = item.claim_id and user_id = item.user_id
    and business_ref = item.business_ref and status = 'approved' for share;
  if not found then raise exception 'Approved claim required' using errcode = '42501'; end if;
  return item;
end $$;
do $$
declare t text;
begin
  foreach t in array array['business_profiles','business_promotions','business_services','business_websites','business_booking_settings','business_instagram_connections'] loop
    execute format('create trigger phase2_approved_parent before insert or update or delete on public.%I for each row execute function public.phase2_require_approved_parent()', t);
  end loop;
end $$;
alter policy bizprof_delete_own on public.business_profiles using (
  auth.uid() = user_id and exists (select 1 from public.business_claims c where c.id = claim_id and c.user_id = auth.uid() and c.business_ref = business_profiles.business_ref and c.status = 'approved')
);
alter policy biz_ig_delete_own on public.business_instagram_connections using (
  auth.uid() = user_id and exists (select 1 from public.business_claims c where c.id = claim_id and c.user_id = auth.uid() and c.business_ref = business_instagram_connections.business_ref and c.status = 'approved')
);
alter policy biz_ig_update_own_limited on public.business_instagram_connections using (
  auth.uid() = user_id and exists (select 1 from public.business_claims c where c.id = claim_id and c.user_id = auth.uid() and c.business_ref = business_instagram_connections.business_ref and c.status = 'approved')
) with check (
  auth.uid() = user_id and status in ('disconnected','pending','revoked') and exists (select 1 from public.business_claims c where c.id = claim_id and c.user_id = auth.uid() and c.business_ref = business_instagram_connections.business_ref and c.status = 'approved')
);

revoke all on function public.phase2_rate_limit(uuid,text), public.phase2_submit_claim(uuid,text,text,text,text,text),
  public.phase2_transition_claim(uuid,uuid,text,text,text), public.phase2_set_preview(uuid,uuid,text),
  public.phase2_immutable_audit(), public.phase2_require_approved_parent() from public, anon, authenticated;
grant execute on function public.phase2_rate_limit(uuid,text), public.phase2_submit_claim(uuid,text,text,text,text,text),
  public.phase2_transition_claim(uuid,uuid,text,text,text), public.phase2_set_preview(uuid,uuid,text) to service_role;

create table public.merchant_instagram_states (
  state_hash text primary key,
  actor_id uuid not null references auth.users(id),
  claim_id uuid not null references public.business_claims(id),
  browser_hash text not null,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  unique (actor_id, claim_id)
);
create table public.merchant_instagram_tokens (
  claim_id uuid primary key references public.business_claims(id),
  actor_id uuid not null references auth.users(id),
  account_id text not null,
  username text not null,
  encrypted_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.merchant_instagram_states enable row level security;
alter table public.merchant_instagram_tokens enable row level security;
revoke all on public.merchant_instagram_states, public.merchant_instagram_tokens from public, anon, authenticated;
grant select, insert, update, delete on public.merchant_instagram_states, public.merchant_instagram_tokens to service_role;
create function public.phase2_store_instagram(p_actor uuid,p_claim uuid,p_account text,p_username text,p_token text,p_expires timestamptz,p_state text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.business_claims where id = p_claim and user_id = p_actor and status = 'approved' for update;
  if not found then raise exception 'Approved claim required' using errcode = '42501'; end if;
  delete from public.merchant_instagram_states where state_hash = p_state and actor_id = p_actor and claim_id = p_claim and consumed_at is not null and expires_at > now();
  if not found then raise exception 'OAuth state invalidated' using errcode = '42501'; end if;
  if p_expires <= now() or length(p_token) < 20 then raise exception 'Invalid token' using errcode = '22023'; end if;
  insert into public.merchant_instagram_tokens (claim_id,actor_id,account_id,username,encrypted_token,expires_at)
  values (p_claim,p_actor,p_account,p_username,p_token,p_expires)
  on conflict (claim_id) do update set actor_id = excluded.actor_id, account_id = excluded.account_id,
    username = excluded.username, encrypted_token = excluded.encrypted_token, expires_at = excluded.expires_at, updated_at = now();
end $$;
revoke all on function public.phase2_store_instagram(uuid,uuid,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.phase2_store_instagram(uuid,uuid,text,text,text,timestamptz,text) to service_role;

create function public.phase2_consume_instagram_state(p_actor uuid,p_state text,p_browser text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  update public.merchant_instagram_states set consumed_at = now()
  where state_hash = p_state and actor_id = p_actor and browser_hash = p_browser and consumed_at is null and expires_at > now()
  returning claim_id into result;
  return result;
end $$;
create function public.phase2_disconnect_instagram(p_actor uuid,p_claim uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.business_claims where id = p_claim and user_id = p_actor and status = 'approved' for update;
  if not found then raise exception 'Approved claim required' using errcode = '42501'; end if;
  delete from public.merchant_instagram_states where claim_id = p_claim and actor_id = p_actor;
  delete from public.merchant_instagram_tokens where claim_id = p_claim and actor_id = p_actor;
end $$;
revoke insert, update on public.merchant_instagram_tokens from service_role;
revoke all on function public.phase2_consume_instagram_state(uuid,text,text), public.phase2_disconnect_instagram(uuid,uuid) from public, anon, authenticated;
grant execute on function public.phase2_consume_instagram_state(uuid,text,text), public.phase2_disconnect_instagram(uuid,uuid) to service_role;

commit;
-- REVIEW ONLY: no booking, payment, provider-business or subscription writes.
-- Stage and run security/concurrency tests before any separately approved production execution.
