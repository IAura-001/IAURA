begin;
create extension if not exists pgtap with schema extensions;
select plan(17);
insert into auth.users (id, email) values
 ('31000000-0000-0000-0000-000000000001','project-a@example.com'),
 ('32000000-0000-0000-0000-000000000002','project-b@example.com');

set local role anon;
select throws_ok('select * from public.projects','42501',null,'anon cannot read projects');
select throws_ok($$insert into public.projects(user_id,id,data) values('31000000-0000-0000-0000-000000000001','shared','{"id":"shared","name":"A"}')$$,'42501',null,'anon cannot create projects');
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
select lives_ok($$insert into public.projects(user_id,id,data) values('31000000-0000-0000-0000-000000000001','shared','{"id":"shared","name":"A"}')$$,'A creates own project');
select is((select count(*) from public.projects),1::bigint,'A reads own project');
select lives_ok($$update public.projects set data='{"id":"shared","name":"A2"}' where id='shared'$$,'A updates own project');
select throws_ok($$insert into public.projects(user_id,id,data) values('32000000-0000-0000-0000-000000000002','spoof','{"id":"spoof","name":"bad"}')$$,'42501',null,'A cannot create for B');
select throws_ok($$update public.projects set user_id='32000000-0000-0000-0000-000000000002' where id='shared'$$,'42501',null,'A cannot transfer ownership');
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','32000000-0000-0000-0000-000000000002',true);
select is((select count(*) from public.projects),0::bigint,'B cannot read A project');
select lives_ok($$update public.projects set data='{"id":"shared","name":"hijack"}' where id='shared'$$,'B update of A is isolated no-op');
select lives_ok($$delete from public.projects where id='shared'$$,'B delete of A is isolated no-op');
select lives_ok($$insert into public.projects(user_id,id,data) values('32000000-0000-0000-0000-000000000002','shared','{"id":"shared","name":"B"}')$$,'B can reuse same logical ID');
select is((select count(*) from public.projects),1::bigint,'B sees only own colliding ID');
select lives_ok($$update public.projects set data='{"id":"shared","name":"B2"}' where id='shared'$$,'B updates own project');
select lives_ok($$delete from public.projects where id='shared'$$,'B deletes own project');
select is((select count(*) from public.projects),0::bigint,'B project was deleted');
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
select is((select data->>'name' from public.projects where id='shared'),'A2','A project survived B mutations');
select lives_ok($$delete from public.projects where id='shared'$$,'A deletes own project');
select * from finish(); rollback;
