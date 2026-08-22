begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select extensions.plan(19);

insert into auth.users(id,email) values
 ('61000000-0000-0000-0000-000000000001','durable-a@example.com'),
 ('62000000-0000-0000-0000-000000000002','durable-b@example.com');
insert into public.projects(user_id,id,data) values
 ('61000000-0000-0000-0000-000000000001','durable-a','{"id":"durable-a","name":"A","goal":"unchanged"}'),
 ('61000000-0000-0000-0000-000000000001','durable-b','{"id":"durable-b","name":"B","goal":"unchanged"}');

set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.create_intelligence_record_idempotent(
 '71000000-0000-4000-8000-000000000001','intelligence_create_goal',
 '{"type":"goal","scopeType":"global","projectId":null,"title":"Durable goal","content":null,"targetDate":null,"goalId":null,"cadence":null,"cadenceDetail":null}'::jsonb)$$,'first idempotent create succeeds');
select lives_ok($$select public.create_intelligence_record_idempotent(
 '71000000-0000-4000-8000-000000000001','intelligence_create_goal',
 '{"type":"goal","scopeType":"global","projectId":null,"title":"Durable goal","content":null,"targetDate":null,"goalId":null,"cadence":null,"cadenceDetail":null}'::jsonb)$$,'same create retry succeeds');
select is((select count(*) from public.intelligence_records where title='Durable goal'),1::bigint,'same key creates exactly one record');
reset role;
select is((select count(distinct record_id) from public.intelligence_action_executions where execution_id='71000000-0000-4000-8000-000000000001'),1::bigint,'retry resolves the original record');
select is(has_table_privilege('authenticated','public.intelligence_action_executions','insert'),false,'authenticated clients cannot forge execution ledger rows');
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
select throws_ok($$select public.create_intelligence_record_idempotent(
 '71000000-0000-4000-8000-000000000001','intelligence_create_goal',
 '{"type":"goal","scopeType":"global","projectId":null,"title":"Different","content":null,"targetDate":null,"goalId":null,"cadence":null,"cadenceDetail":null}'::jsonb)$$,'23514',null,'same key different payload conflicts');
select throws_ok($$select public.create_intelligence_record_idempotent(
 '71000000-0000-4000-8000-000000000001','intelligence_create_priority',
 '{"type":"priority","scopeType":"global","projectId":null,"title":"Different","content":null,"targetDate":null,"goalId":null,"cadence":null,"cadenceDetail":null}'::jsonb)$$,'23514',null,'same key different operation conflicts');
select lives_ok($$select public.create_intelligence_record_idempotent(
 '71000000-0000-4000-8000-000000000002','intelligence_create_recurring_commitment',
 '{"type":"recurring_commitment","scopeType":"project","projectId":"durable-a","title":"Weekly review","content":null,"targetDate":null,"goalId":null,"cadence":"weekly","cadenceDetail":null}'::jsonb)$$,'different key creates another valid record');
select is((select data->>'goal' from public.projects where id='durable-a'),'unchanged','project primary goal remains untouched');

insert into public.intelligence_records(id,user_id,record_type,scope_type,project_id,title,status,position) values
 ('72000000-0000-4000-8000-000000000001','61000000-0000-0000-0000-000000000001','priority','project','durable-a','P1','active',1),
 ('72000000-0000-4000-8000-000000000002','61000000-0000-0000-0000-000000000001','priority','project','durable-a','P2','active',2);
select lives_ok($$select public.reorder_intelligence_priorities_guarded(
 array['72000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000001']::uuid[], 'project','durable-a',
 (select jsonb_agg(jsonb_build_object('recordId',id,'position',position,'updatedAt',updated_at) order by position)
  from public.intelligence_records where record_type='priority' and project_id='durable-a' and status='active'))$$,'matching guarded snapshot reorders');
select is((select string_agg(title,',' order by position) from public.intelligence_records where record_type='priority' and project_id='durable-a' and status='active'),'P2,P1','guarded reorder persists exact order');
select throws_ok($$select public.reorder_intelligence_priorities_guarded(
 array['72000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000002']::uuid[], 'project','durable-a',
 '[{"recordId":"72000000-0000-4000-8000-000000000001","position":1,"updatedAt":"2000-01-01T00:00:00+00:00"},{"recordId":"72000000-0000-4000-8000-000000000002","position":2,"updatedAt":"2000-01-01T00:00:00+00:00"}]'::jsonb)$$,'40001',null,'changed snapshot is stale');
select is((select string_agg(title,',' order by position) from public.intelligence_records where record_type='priority' and project_id='durable-a' and status='active'),'P2,P1','failed guarded reorder is atomic');
select throws_ok($$select public.reorder_intelligence_priorities_guarded(
 array['72000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001']::uuid[], 'project','durable-a','[]'::jsonb)$$,'23514',null,'duplicate reorder IDs rejected');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','62000000-0000-0000-0000-000000000002',true);
select lives_ok($$select public.create_intelligence_record_idempotent(
 '71000000-0000-4000-8000-000000000001','intelligence_create_goal',
 '{"type":"goal","scopeType":"global","projectId":null,"title":"User B goal","content":null,"targetDate":null,"goalId":null,"cadence":null,"cadenceDetail":null}'::jsonb)$$,'same execution UUID is independently user scoped');
select is((select count(*) from public.intelligence_records where title='Durable goal'),0::bigint,'user B cannot see user A result');

reset role;
select is(has_table_privilege('anon','public.intelligence_action_executions','select'),false,'anonymous execution-ledger access blocked');
select is(has_function_privilege('anon','public.create_intelligence_record_idempotent(uuid,text,jsonb)','execute'),false,'anonymous idempotent create blocked');
select is(has_function_privilege('anon','public.reorder_intelligence_priorities_guarded(uuid[],text,text,jsonb)','execute'),false,'anonymous guarded reorder blocked');
select * from finish();
rollback;
