-- STAGING ONLY: fmscnxlciphrvsdkjaei. Never run against cytwncsewgetuwmhevdv.
-- Run once, AFTER 009, in the staging SQL Editor.
-- Paste the two user IDs from Authentication -> Users. Permissions are assigned by
-- ID; the email comparison only catches a pasted-in-the-wrong-slot mistake.
begin;

do $$
declare
  placeholder constant uuid := '00000000-0000-0000-0000-000000000000';
  admin_id constant uuid := '00000000-0000-0000-0000-000000000000';    -- spotmeoutt@gmail.com
  merchant_id constant uuid := '00000000-0000-0000-0000-000000000000'; -- rajekasingam@gmail.com
begin
  if (select count(*) from auth.users) > 5 then
    raise exception 'FAIL setup: more than 5 users, this does not look like staging';
  end if;
  if admin_id = placeholder or merchant_id = placeholder or admin_id = merchant_id then
    raise exception 'FAIL setup: paste two different user IDs';
  end if;
  if not exists (select 1 from auth.users where id = admin_id
      and lower(email) = 'spotmeoutt@gmail.com' and email_confirmed_at is not null
      and deleted_at is null and not is_anonymous) then
    raise exception 'FAIL setup: admin ID is not the confirmed spotmeoutt@gmail.com account';
  end if;
  if not exists (select 1 from auth.users where id = merchant_id
      and lower(email) = 'rajekasingam@gmail.com' and email_confirmed_at is not null
      and deleted_at is null and not is_anonymous) then
    raise exception 'FAIL setup: merchant ID is not the confirmed rajekasingam@gmail.com account';
  end if;

  insert into public.platform_admin_entitlements (user_id, platform_admin, subscription_test_mode)
  values (admin_id, true, true)
  on conflict (user_id) do update set platform_admin = true, subscription_test_mode = true;

  -- Rows are disabled, not deleted, because audit records reference them.
  update public.platform_admin_entitlements
  set platform_admin = false, subscription_test_mode = false
  where user_id <> admin_id and (platform_admin or subscription_test_mode);

  if (select count(*) from public.platform_admin_entitlements where platform_admin) <> 1
     or exists (select 1 from public.platform_admin_entitlements where user_id = merchant_id and platform_admin) then
    raise exception 'FAIL: admin entitlement is not limited to the admin ID';
  end if;
  raise notice 'PASS spotmeoutt@gmail.com is the only platform admin; rajekasingam@gmail.com has none';
end $$;

commit;
