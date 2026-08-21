begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select extensions.plan(36);

insert into auth.users(id,email) values
  ('41000000-0000-0000-0000-000000000001','intelligence-a@example.com'),
  ('42000000-0000-0000-0000-000000000002','intelligence-b@example.com');
insert into public.projects(user_id,id,data) values
  ('41000000-0000-0000-0000-000000000001','project-a','{"id":"project-a","name":"A","goal":"Primary A"}'),
  ('41000000-0000-0000-0000-000000000001','project-b','{"id":"project-b","name":"B","goal":"Primary B"}'),
  ('42000000-0000-0000-0000-000000000002','project-other','{"id":"project-other","name":"Other","goal":"Primary Other"}');
insert into public.memory_state(user_id,data) values
  ('41000000-0000-0000-0000-000000000001','{"goals":["Legacy goal"],"habits":["Legacy habit"]}');

set local role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000001',true);
select throws_ok($$insert into public.intelligence_records(user_id,record_type,scope_type,project_id,content,status) values('41000000-0000-0000-0000-000000000001','direction','global','project-a','bad','active')$$,'23514',null,'global cannot carry project id');
select throws_ok($$insert into public.intelligence_records(user_id,record_type,scope_type,content,status) values('41000000-0000-0000-0000-000000000001','direction','project','bad','active')$$,'23514',null,'project scope requires project id');
select throws_ok($$insert into public.intelligence_records(user_id,record_type,scope_type,project_id,title,status,target_date) values('41000000-0000-0000-0000-000000000001','goal','project','project-other','not owned','active',null)$$,'23503',null,'project scope requires an owned project');
select lives_ok($$insert into public.intelligence_records(id,user_id,record_type,scope_type,title,status,target_date) values('51000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','goal','global','Global','active',null)$$,'A creates global intelligence');
select lives_ok($$insert into public.intelligence_records(id,user_id,record_type,scope_type,project_id,title,status,target_date) values('51000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000001','goal','project','project-a','A goal','active',null),('51000000-0000-0000-0000-000000000003','41000000-0000-0000-0000-000000000001','goal','project','project-b','B goal','active',null)$$,'A creates separately scoped goals');
select lives_ok($$insert into public.intelligence_records(user_id,record_type,scope_type,title,status,target_date) values('41000000-0000-0000-0000-000000000001','goal','global','Archived','archived',null)$$,'archived record persists');
select is((select count(*) from public.intelligence_records where status <> 'archived' and (scope_type='global' or project_id='project-a')),2::bigint,'Project A projection has global plus exact A');
select is((select count(*) from public.intelligence_records where status <> 'archived' and (scope_type='global' or project_id='project-b')),2::bigint,'Project B projection has global plus exact B');
select is((select count(*) from public.intelligence_records where status='archived'),1::bigint,'archived record is excluded by active filter');
select lives_ok($$insert into public.intelligence_records(id,user_id,record_type,scope_type,title,status,position) values('52000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','priority','global','P1','active',1),('52000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000001','priority','global','P2','active',2),('52000000-0000-0000-0000-000000000003','41000000-0000-0000-0000-000000000001','priority','global','P3','active',3)$$,'three active priorities allowed');
select throws_ok($$insert into public.intelligence_records(user_id,record_type,scope_type,title,status,position) values('41000000-0000-0000-0000-000000000001','priority','global','P4','active',3)$$,'23505',null,'fourth active priority cannot occupy a scope slot');
select lives_ok($$select public.reorder_intelligence_priorities(array['52000000-0000-0000-0000-000000000003','52000000-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000002']::uuid[],'global',null)$$,'priority reorder RPC succeeds transactionally');
select is((select string_agg(title,',' order by position) from public.intelligence_records where record_type='priority' and scope_type='global' and status='active'),'P3,P1,P2','priority reorder persists the exact requested order');
select lives_ok($$insert into public.intelligence_records(id,user_id,record_type,scope_type,content,status) values('53000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','direction','global','Global direction','active')$$,'one active global direction is allowed');
select throws_ok($$insert into public.intelligence_records(user_id,record_type,scope_type,content,status) values('41000000-0000-0000-0000-000000000001','direction','global','Duplicate global direction','active')$$,'23505',null,'second active global direction is rejected');
select lives_ok($$insert into public.intelligence_records(id,user_id,record_type,scope_type,project_id,content,status) values('53000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000001','direction','project','project-a','Project A direction','active')$$,'one active project direction is allowed');
select throws_ok($$insert into public.intelligence_records(user_id,record_type,scope_type,project_id,content,status) values('41000000-0000-0000-0000-000000000001','direction','project','project-a','Duplicate A direction','active')$$,'23505',null,'second active direction in the same project is rejected');
reset role;
set local session_replication_role = replica;
update public.intelligence_records set created_at = clock_timestamp() - interval '1 second', updated_at = clock_timestamp() - interval '1 second' where id='53000000-0000-0000-0000-000000000002';
set local session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000001',true);
select lives_ok($$update public.intelligence_records set content='Updated project direction' where id='53000000-0000-0000-0000-000000000002'$$,'direction can be updated');
select ok((select updated_at > created_at from public.intelligence_records where id='53000000-0000-0000-0000-000000000002'),'updated_at advances on update');
select throws_ok($$insert into public.intelligence_records(user_id,record_type,scope_type,project_id,goal_id,status,position) values('41000000-0000-0000-0000-000000000001','priority','project','project-b','51000000-0000-0000-0000-000000000002','active',1)$$,'23514',null,'goal references cannot cross project scopes');
select lives_ok($$insert into public.intelligence_records(user_id,record_type,scope_type,project_id,goal_id,status,position) values('41000000-0000-0000-0000-000000000001','priority','project','project-a','51000000-0000-0000-0000-000000000002','active',1)$$,'owned goal reference in the same scope is allowed');
select is((select data->>'goal' from public.projects where id='project-a'),'Primary A','project primary goal remains independent');
select is((select count(*) from public.intelligence_records where title in ('Legacy goal','Legacy habit')),0::bigint,'legacy memory is not imported');
select is((select data::text from public.memory_state where user_id='41000000-0000-0000-0000-000000000001'),'{"goals": ["Legacy goal"], "habits": ["Legacy habit"]}'::jsonb::text,'canonical Intelligence writes do not mutate Memory');
select throws_ok($$update public.intelligence_records set id='51000000-0000-0000-0000-000000000099' where id='51000000-0000-0000-0000-000000000001'$$,'42501',null,'stable IDs cannot be mutated');
reset role;
select is((select relrowsecurity from pg_class where oid='public.intelligence_records'::regclass),true,'RLS is enabled');
select is((select count(*) from pg_policies where schemaname='public' and tablename='intelligence_records'),3::bigint,'exactly three authenticated RLS policies exist');
select is(has_table_privilege('anon','public.intelligence_records','select'),false,'anon has no table read grant');
select is(has_table_privilege('authenticated','public.intelligence_records','delete'),false,'authenticated role has no hard-delete grant');

set local role authenticated;
select set_config('request.jwt.claim.sub','42000000-0000-0000-0000-000000000002',true);
select lives_ok($$insert into public.intelligence_records(id,user_id,record_type,scope_type,title,status,target_date) values('51000000-0000-0000-0000-000000000004','42000000-0000-0000-0000-000000000002','goal','global','Other user goal','active',null)$$,'B creates an owned goal for ownership validation');
select is((select count(*) from public.intelligence_records where id in ('51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000003')),0::bigint,'B cannot read A intelligence');
select lives_ok($$update public.intelligence_records set title='hijacked' where id='51000000-0000-0000-0000-000000000001'$$,'B update is isolated no-op');
select throws_ok($$delete from public.intelligence_records where id='51000000-0000-0000-0000-000000000001'$$,'42501',null,'hard delete is not granted');
select throws_ok($$insert into public.intelligence_records(user_id,record_type,scope_type,title,status,target_date) values('41000000-0000-0000-0000-000000000001','goal','global','spoof','active',null)$$,'42501',null,'B cannot write for A');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000001',true);
select is((select title from public.intelligence_records where id='51000000-0000-0000-0000-000000000001'),'Global','A record survived B mutations');
select throws_ok($$insert into public.intelligence_records(user_id,record_type,scope_type,goal_id,status,position) values('41000000-0000-0000-0000-000000000001','priority','global','51000000-0000-0000-0000-000000000004','active',1)$$,'23514',null,'goal references enforce ownership');
select * from finish();
rollback;
