begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

select is(has_table_privilege('authenticated','public.projects','insert'),false,
  'authenticated clients cannot insert projects directly');
select is(has_function_privilege('authenticated','public.create_project_with_entitlement(text,jsonb)','execute'),true,
  'authenticated clients can execute authoritative project creation');
select is((select prosecdef from pg_proc where oid='public.create_project_with_entitlement(text,jsonb)'::regprocedure),true,
  'project creation is security definer');
select is((select proconfig from pg_proc where oid='public.create_project_with_entitlement(text,jsonb)'::regprocedure),
  array['search_path=""']::text[],'project creation has a controlled empty search path');
select is((select count(*) from pg_trigger where tgrelid='public.projects'::regclass
  and tgname='projects_reactivation_entitlement' and not tgisinternal),1::bigint,
  'project reactivation entitlement trigger exists');

select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects'
  and policyname='creative_assets_insert_own'),0::bigint,'authenticated creative asset insert policy is absent');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects'
  and policyname='creative_assets_select_own'),1::bigint,'private owner-scoped asset reads remain enabled');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects'
  and policyname='creative_assets_delete_own'),1::bigint,'private owner-scoped asset deletion remains enabled');
select is((select rolbypassrls from pg_roles where rolname='service_role'),true,
  'server service role bypasses Storage RLS for authoritative uploads');
select is(has_table_privilege('authenticated','public.creative_asset_objects','insert'),false,
  'authenticated clients cannot forge asset inventory');
select is(has_table_privilege('authenticated','public.ai_usage_events','insert'),false,
  'authenticated clients cannot forge AI usage');
select is(has_table_privilege('authenticated','public.user_entitlement_assignments','select'),false,
  'authenticated clients cannot read entitlement assignments directly');
select is(has_table_privilege('authenticated','public.beta_cohorts','select'),false,
  'authenticated clients cannot read founder cohort tables directly');
select is(has_function_privilege('authenticated','public.submit_beta_feedback(text,text,text,text,text,jsonb)','execute'),true,
  'authenticated participants can reach the guarded feedback RPC');
select is(has_function_privilege('authenticated','public.founder_triage_beta_feedback(uuid,text,boolean)','execute'),true,
  'founder triage is reachable only through its guarded RPC');

insert into auth.users(id,email) values
 ('81000000-0000-0000-0000-000000000001','asset-a@example.com'),
 ('82000000-0000-0000-0000-000000000002','asset-b@example.com');
insert into public.projects(user_id,id,data) values
 ('81000000-0000-0000-0000-000000000001','asset-project','{"id":"asset-project","name":"Asset project","status":"planning"}'),
 ('82000000-0000-0000-0000-000000000002','other-project','{"id":"other-project","name":"Other","status":"planning"}');

set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
create temporary table reserved_asset(id uuid) on commit drop;
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id,metadata)
  values('creative-assets','81000000-0000-0000-0000-000000000001/asset-project/direct/original',
  '81000000-0000-0000-0000-000000000001','{}')$$,'42501',null,
  'authenticated clients cannot upload directly to creative asset Storage');
select lives_ok($$insert into reserved_asset select public.reserve_asset_storage('asset-project','asset-a',4)$$,
  'owned asset quota reservation succeeds');
reset role;
select is((select reserved_bytes from public.asset_storage_reservations where asset_id='asset-a'),4::bigint,
  'reservation accounts exact incoming bytes');
set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select lives_ok($$select public.finalize_asset_storage(
  (select id from reserved_asset),
  '81000000-0000-0000-0000-000000000001/asset-project/asset-a/original',null,
  'image/png',4,0,'{}')$$,'reserved inventory finalization succeeds');
select is((select count(*) from public.creative_asset_objects where asset_id='asset-a'),1::bigint,
  'finalization creates exactly one inventory record');
select is((public.resolve_current_entitlements()#>>'{usage,storageBytes}')::bigint,4::bigint,
  'effective entitlement usage includes finalized storage bytes');
select is((public.resolve_current_entitlements()#>>'{usage,assetCount}')::bigint,1::bigint,
  'effective entitlement usage includes finalized asset count');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','82000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select throws_ok($$select public.reserve_asset_storage('asset-project','cross-user',4)$$,
  '22023',null,'cross-user project storage reservation is denied');
select is((select count(*) from public.creative_asset_objects),0::bigint,
  'another user cannot read asset inventory');
select throws_ok($$select public.submit_beta_feedback('beta_2',null,'support','other',null,'{}')$$,
  '42501',null,'non-participants cannot submit Beta 2 feedback');

reset role; set local role service_role;
select lives_ok($$insert into storage.objects(bucket_id,name,owner_id,metadata)
  values('creative-assets','81000000-0000-0000-0000-000000000001/asset-project/server/original',
  '81000000-0000-0000-0000-000000000001','{}')$$,
  'server authority can create the approved Storage object');

select * from finish();
rollback;
