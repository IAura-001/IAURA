begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id,email,created_at) values
 ('41000000-0000-0000-0000-000000000001','founder@example.com',now()-interval '30 days'),
 ('42000000-0000-0000-0000-000000000002','member@example.com',now()-interval '20 days'),
 ('43000000-0000-0000-0000-000000000003','unused@example.com',now()-interval '10 days');
insert into public.beta_invites(id,token_hash,expires_at,max_claims,claim_count)
values ('40000000-0000-0000-0000-000000000000',repeat('4',64),now()+interval '1 day',3,3);
insert into public.beta_memberships(user_id,invite_id,role,status) values
 ('41000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000000','founder','active'),
 ('42000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000000','member','active'),
 ('43000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000000','member','active');
insert into public.projects(user_id,id,data) values
 ('42000000-0000-0000-0000-000000000002','member-project','{"id":"member-project","name":"Private title"}');
insert into public.conversation_state(user_id,data) values
 ('42000000-0000-0000-0000-000000000002','{"conversations":[{"conversationId":"private","messages":[{"role":"user","content":"private secret"},{"role":"assistant","content":"private response"}]}]}');

set local role anon;
select throws_ok('select * from public.founder_beta_usage()','42501',null,'unauthenticated user is denied');
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','42000000-0000-0000-0000-000000000002',true);
select throws_ok('select * from public.founder_beta_usage()','42501',null,'normal member is denied');
select set_config('request.jwt.claim.sub','43000000-0000-0000-0000-000000000003',true);
select throws_ok('select * from public.founder_beta_usage()','42501',null,'browser identity cannot self-authorize');
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000001',true);
select lives_ok('select * from public.founder_beta_usage()','founder can retrieve operations');
select is((select count(*) from public.founder_beta_usage()),3::bigint,'all beta members are represented');
select is((select project_count from public.founder_beta_usage() where user_id='42000000-0000-0000-0000-000000000002'),1::bigint,'project count is owner isolated');
select is((select conversation_count from public.founder_beta_usage() where user_id='42000000-0000-0000-0000-000000000002'),1::bigint,'conversation count is owner isolated');
select is((select message_count from public.founder_beta_usage() where user_id='42000000-0000-0000-0000-000000000002'),1::bigint,'user message count is owner isolated');
select is((select meaningful_interaction_count from public.founder_beta_usage() where user_id='43000000-0000-0000-0000-000000000003'),0::bigint,'registered-only member has no meaningful activity');
select is((select project_count from public.founder_beta_usage() where user_id='43000000-0000-0000-0000-000000000003'),0::bigint,'another member does not inherit projects');
select is((select conversation_count from public.founder_beta_usage() where user_id='43000000-0000-0000-0000-000000000003'),0::bigint,'another member does not inherit conversations');
select is((select message_count from public.founder_beta_usage() where user_id='43000000-0000-0000-0000-000000000003'),0::bigint,'another member does not inherit messages');
select ok(position('private secret' in row_to_json(r)::text)=0,'message content is absent') from public.founder_beta_usage() r limit 1;
select ok(position('Private title' in row_to_json(r)::text)=0,'project content is absent') from public.founder_beta_usage() r limit 1;
select * from finish(); rollback;
