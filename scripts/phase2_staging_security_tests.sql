-- STAGING ONLY. Run in the staging project's SQL Editor AFTER 008 and 009.
-- Never run against cytwncsewgetuwmhevdv. Everything ends in ROLLBACK, so no
-- test claim, audit row, rate-limit row or profile persists.
-- Prerequisites in staging: rajekasingam@gmail.com and ONE other confirmed test
-- account (the merchant). Every check prints PASS or aborts with FAIL.
begin;

do $$
declare
  admin_id uuid; merchant_id uuid; claim public.business_claims; own_claim public.business_claims;
  t record; denied boolean; n integer;
  ref text := 'phase2-staging-test-' || gen_random_uuid();
begin
  select id into admin_id from auth.users where lower(email) = 'rajekasingam@gmail.com' and email_confirmed_at is not null;
  select id into merchant_id from auth.users
    where lower(email) <> 'rajekasingam@gmail.com' and email_confirmed_at is not null and not is_anonymous
    order by created_at limit 1;
  if admin_id is null or merchant_id is null then raise exception 'FAIL setup: need confirmed admin and merchant accounts'; end if;
  if not exists (select 1 from public.platform_admin_entitlements where user_id = admin_id and platform_admin and subscription_test_mode)
    then raise exception 'FAIL setup: admin entitlement missing (was 009 applied?)'; end if;

  -- 1. Browser (authenticated) privilege escalation must be denied.
  for t in select * from (values
    ('grant self admin', format('insert into public.platform_admin_entitlements (user_id, platform_admin, subscription_test_mode) values (%L, true, true)', merchant_id)),
    ('read admin table', 'select 1 from public.platform_admin_entitlements'),
    ('edit account_type', format('update public.profiles set account_type = %L where id = %L', 'business', merchant_id)),
    ('insert claim directly', format('insert into public.business_claims (user_id, business_ref, business_name, status) values (%L, %L, %L, %L)', merchant_id, ref, 'x', 'approved')),
    ('approve via update', format('update public.business_claims set status = %L where user_id = %L', 'approved', merchant_id)),
    ('change subscription tier', format('insert into public.subscriptions (user_id, tier, status) values (%L, %L, %L)', merchant_id, 'gold', 'active')),
    ('call transition RPC', format('select public.phase2_transition_claim(%L, gen_random_uuid(), %L, %L, %L)', merchant_id, 'pending', 'approved', 'self escalation attempt')),
    ('call preview RPC', format('select public.phase2_set_preview(%L, gen_random_uuid(), %L)', merchant_id, 'gold_preview')),
    ('read audit log', 'select 1 from public.merchant_claim_audit'),
    ('read instagram tokens', 'select 1 from public.merchant_instagram_tokens')
  ) v(label, stmt) loop
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', merchant_id, 'role', 'authenticated')::text, true);
    denied := false;
    begin execute t.stmt; exception when insufficient_privilege then denied := true; end;
    execute 'reset role';
    if not denied then raise exception 'FAIL browser: % was permitted', t.label; end if;
    raise notice 'PASS browser denied: %', t.label;
  end loop;

  -- 2. Server path (service_role) transitions, as used by the API routes.
  execute 'set local role service_role';
  claim := public.phase2_submit_claim(merchant_id, ref, 'Staging Test Business', null, null, 'Staging verification evidence');

  denied := false;
  begin perform public.phase2_transition_claim(merchant_id, claim.id, 'pending', 'approved', 'Merchant tries to approve own claim');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL non-admin approval permitted'; end if;
  raise notice 'PASS non-admin cannot approve';

  own_claim := public.phase2_submit_claim(admin_id, ref || '-own', 'Admin Own Business', null, null, 'Admin self-approval check');
  denied := false;
  begin perform public.phase2_transition_claim(admin_id, own_claim.id, 'pending', 'approved', 'Admin tries to approve own claim');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL admin self-approval permitted'; end if;
  raise notice 'PASS admin cannot self-approve';

  claim := public.phase2_transition_claim(admin_id, claim.id, 'pending', 'approved', 'Verified in staging test run');
  if claim.status <> 'approved' then raise exception 'FAIL approval'; end if;

  denied := false;
  begin perform public.phase2_transition_claim(admin_id, claim.id, 'pending', 'approved', 'Stale duplicate approval attempt');
  exception when serialization_failure then denied := true; end;
  if not denied then raise exception 'FAIL stale approval accepted'; end if;
  raise notice 'PASS stale/duplicate decision rejected';

  denied := false;
  begin perform public.phase2_submit_claim(admin_id, ref, 'Staging Test Business', null, null, 'Second claimant for same business');
  exception when unique_violation then denied := true; end;
  if not denied then raise exception 'FAIL claim accepted for already-approved business'; end if;
  raise notice 'PASS second claim on approved business rejected';

  perform public.phase2_set_preview(admin_id, claim.id, 'gold_preview');
  execute 'reset role';

  -- 3. Approved merchant may edit only through RLS + approved-parent trigger.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', merchant_id, 'role', 'authenticated')::text, true);
  insert into public.business_profiles (claim_id, user_id, business_ref, tagline) values (claim.id, merchant_id, ref, 'Before revoke');
  denied := false;
  begin insert into public.business_profiles (claim_id, user_id, business_ref, tagline) values (claim.id, merchant_id, ref || '-other', 'Cross-business');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL profile written for a different business_ref'; end if;
  raise notice 'PASS cannot manage another business via own claim';
  execute 'reset role';

  -- 4. Revocation removes management immediately.
  execute 'set local role service_role';
  perform public.phase2_transition_claim(admin_id, claim.id, 'approved', 'revoked', 'Staging revocation test');
  select count(*) into n from public.merchant_plan_previews where claim_id = claim.id;
  if n <> 0 then raise exception 'FAIL preview survived revocation'; end if;
  denied := false;
  begin perform public.phase2_set_preview(admin_id, claim.id, 'silver');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL preview set on revoked claim'; end if;
  denied := false;
  begin perform public.phase2_disconnect_instagram(merchant_id, claim.id);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL Instagram operation on revoked claim'; end if;
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', merchant_id, 'role', 'authenticated')::text, true);
  update public.business_profiles set tagline = 'After revoke' where claim_id = claim.id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL revoked merchant edited profile'; end if;
  denied := false;
  begin delete from public.business_profiles where claim_id = claim.id; get diagnostics n = row_count; denied := n = 0;
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FAIL revoked merchant deleted profile'; end if;
  execute 'reset role';
  raise notice 'PASS revoked merchant lost profile, preview and Instagram management';

  -- 5. Audit is complete and append-only.
  select count(*) into n from public.merchant_claim_audit where claim_id = claim.id;
  if n < 4 then raise exception 'FAIL expected submitted/approved/test_plan_changed/revoked audit rows, found %', n; end if;
  denied := false;
  begin update public.merchant_claim_audit set reason = 'tampered' where claim_id = claim.id;
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL audit row modified'; end if;
  raise notice 'PASS audit trail complete (% rows) and immutable', n;

  raise notice 'ALL PHASE 2 STAGING SECURITY CHECKS PASSED';
end $$;

rollback;
