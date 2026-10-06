-- Read-only schema metadata for project cytwncsewgetuwmhevdv.
-- Not a migration. Does not select customer records, credentials, or auth tokens.
-- Run manually and export the single JSON result for migration preparation.
with relevant_tables as (
  select c.oid, n.nspname as schema_name, c.relname as table_name,
         c.relrowsecurity, c.relforcerowsecurity
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p') and (
    (n.nspname = 'public' and c.relname in (
      'businesses', 'google_place_details', 'business_claims', 'profiles',
      'business_profiles', 'subscriptions', 'business_instagram_connections',
      'business_services', 'business_promotions', 'business_booking_settings',
      'business_websites', 'business_profile_events', 'booking_requests'
    )) or (n.nspname = 'auth' and c.relname = 'users')
  )
)
select jsonb_build_object(
  'tables', (select jsonb_agg(to_jsonb(t) - 'oid') from relevant_tables t),
  'columns', (
    select jsonb_agg(to_jsonb(x)) from (
      select c.table_schema, c.table_name, c.column_name, c.data_type,
             c.udt_schema, c.udt_name, c.is_nullable, c.column_default, c.is_identity
      from information_schema.columns c
      join relevant_tables t on t.schema_name = c.table_schema and t.table_name = c.table_name
      order by c.table_schema, c.table_name, c.ordinal_position
    ) x
  ),
  'constraints', (
    select jsonb_agg(jsonb_build_object(
      'schema', t.schema_name, 'table', t.table_name,
      'name', c.conname, 'definition', pg_catalog.pg_get_constraintdef(c.oid)
    )) from pg_catalog.pg_constraint c join relevant_tables t on t.oid = c.conrelid
  ),
  'indexes', (
    select jsonb_agg(to_jsonb(i)) from pg_catalog.pg_indexes i
    join relevant_tables t on t.schema_name = i.schemaname and t.table_name = i.tablename
  ),
  'policies', (
    select jsonb_agg(to_jsonb(p)) from pg_catalog.pg_policies p
    join relevant_tables t on t.schema_name = p.schemaname and t.table_name = p.tablename
  ),
  'table_grants', (
    select jsonb_agg(to_jsonb(g)) from information_schema.table_privileges g
    join relevant_tables t on t.schema_name = g.table_schema and t.table_name = g.table_name
    where g.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ),
  'column_grants', (
    select jsonb_agg(to_jsonb(g)) from information_schema.column_privileges g
    join relevant_tables t on t.schema_name = g.table_schema and t.table_name = g.table_name
    where g.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ),
  'triggers', (
    select jsonb_agg(jsonb_build_object(
      'schema', t.schema_name, 'table', t.table_name,
      'name', tr.tgname, 'definition', pg_catalog.pg_get_triggerdef(tr.oid),
      'function', tr.tgfoid::regprocedure::text
    )) from pg_catalog.pg_trigger tr join relevant_tables t on t.oid = tr.tgrelid
    where not tr.tgisinternal
  ),
  'function_security', (
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', p.proname,
      'arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef, 'settings', p.proconfig,
      'grants', p.proacl::text
    )) from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  )
) as phase2_schema_audit;
