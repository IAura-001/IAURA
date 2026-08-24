begin;
create extension if not exists pgtap with schema extensions;
select plan(24);
insert into auth.users(id,email) values
 ('51000000-0000-0000-0000-000000000001','cost-founder@example.com'),
 ('52000000-0000-0000-0000-000000000002','cost-member@example.com');
insert into public.beta_invites(id,token_hash,expires_at,max_claims,claim_count)
values('50000000-0000-0000-0000-000000000000',repeat('5',64),now()+interval '1 day',2,2);
insert into public.beta_memberships(user_id,invite_id,role,status) values
 ('51000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000000','founder','active'),
 ('52000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000000','member','active');

set local role anon;
select throws_ok('select * from public.ai_usage_events','42501',null,'anon cannot read financial events');
select throws_ok($$select public.founder_ai_cost_operations()$$,'42501',null,'anon cannot read founder cost data');
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','52000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select throws_ok('select * from public.ai_usage_events','42501',null,'member cannot read financial events');
select throws_ok($$select public.reserve_ai_usage_operation('51000000-0000-0000-0000-000000000001','chat','spoof')$$,
  '42883',null,'caller cannot supply or spoof another user id');
select throws_ok($$select public.founder_ai_cost_operations()$$,'42501',null,'member cannot read founder cost data');
reset role; set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select throws_ok($$select public.reserve_ai_usage_operation('chat','service-spoof')$$,
  '42501',null,'service role cannot substitute an end-user identity');
insert into public.ai_usage_policies(user_id,max_operations_24h,max_concurrent)
values('52000000-0000-0000-0000-000000000002',1,1);

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','51000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select lives_ok($$select public.reserve_ai_usage_operation('chat','founder-request-1')$$,
  'founder request reserves against founder');
select set_config('request.jwt.claim.sub','52000000-0000-0000-0000-000000000002',true);
select lives_ok($$select public.reserve_ai_usage_operation('chat','member-request-1')$$,
  'member first request is allowed');
select throws_ok($$select public.reserve_ai_usage_operation('chat','member-request-2')$$,
  'P0001',null,'member second request is blocked by member policy');

reset role; set local role service_role;
select is((select user_id from public.ai_usage_events where request_id='founder-request-1'),
  '51000000-0000-0000-0000-000000000001'::uuid,'founder request belongs to founder');
select is((select user_id from public.ai_usage_events where request_id='member-request-1'),
  '52000000-0000-0000-0000-000000000002'::uuid,'member request belongs to member');
select is((select count(*) from public.ai_usage_events where user_id='52000000-0000-0000-0000-000000000002'),
  1::bigint,'denied member request created no event');
select is((select count(*) from public.ai_usage_events where user_id='51000000-0000-0000-0000-000000000001'),
  1::bigint,'member limit does not affect founder ownership');
update public.ai_usage_events set status='succeeded',provider='openai',model='gpt-5.6-luna',
 input_tokens=10,output_tokens=5,total_tokens=15,cached_input_tokens=2,reasoning_tokens=1,
 provider_usage_available=true,estimated_cost_usd=.000008,cost_pricing_version='test-v1',completed_at=now()
where request_id='member-request-1';
select is((select total_tokens from public.ai_usage_events where request_id='member-request-1'),15::bigint,'tokens persist exactly');
select is((select cached_input_tokens from public.ai_usage_events where request_id='member-request-1'),2::bigint,'cached tokens persist');
select is((select reasoning_tokens from public.ai_usage_events where request_id='member-request-1'),1::bigint,'reasoning tokens persist');

insert into public.ai_usage_events(user_id,operation_type,request_id,status)
select '51000000-0000-0000-0000-000000000001','chat','concurrent-'||g,'reserved'
from generate_series(1,2) g;
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','51000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select throws_ok($$select public.reserve_ai_usage_operation('chat','over-concurrency-limit')$$,
  'P0001',null,'founder concurrency remains isolated from member policy and events');
select lives_ok($$select * from public.founder_ai_cost_operations()$$,'founder can read cost analytics');
select is((select operations from public.founder_ai_cost_operations() where scope='7d'),4::bigint,'7d total aggregates');
select is((select total_tokens from public.founder_ai_cost_operations() where scope='30d'),15::bigint,'30d tokens aggregate');
select is((select operations from public.founder_ai_cost_operations() where scope='user_30d' and user_id='51000000-0000-0000-0000-000000000001'),3::bigint,'User A owns only A usage');
select is((select operations from public.founder_ai_cost_operations() where scope='user_30d' and user_id='52000000-0000-0000-0000-000000000002'),1::bigint,'User B owns only B usage');
select is((select limit_max_operations_24h from public.founder_ai_cost_operations()
  where scope='user_30d' and user_id='52000000-0000-0000-0000-000000000002'),1,
  'member policy is reported independently');
select is((select limit_max_operations_24h from public.founder_ai_cost_operations()
  where scope='user_30d' and user_id='51000000-0000-0000-0000-000000000001'),100,
  'founder retains default policy');
select * from finish(); rollback;
