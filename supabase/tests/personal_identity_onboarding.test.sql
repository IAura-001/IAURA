begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('41000000-0000-0000-0000-000000000001', 'identity-a@example.com'),
  ('42000000-0000-0000-0000-000000000002', 'identity-b@example.com');

set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok($$update public.profiles set display_name = 'anon'$$, '42501', null, 'anon cannot update profiles');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select is((select onboarding_completed from public.profiles), false, 'new profile starts incomplete');
select lives_ok($$update public.profiles set first_name = 'Ana', last_name = null, display_name = 'An', onboarding_completed = true where id = '41000000-0000-0000-0000-000000000001'$$, 'user completes own identity');
select is((select display_name from public.profiles), 'An', 'user reads own display name');
select lives_ok($$update public.profiles set display_name = 'spoofed' where id = '42000000-0000-0000-0000-000000000002'$$, 'cross-user update is an isolated no-op');
select throws_ok($$update public.profiles set id = '42000000-0000-0000-0000-000000000002' where id = '41000000-0000-0000-0000-000000000001'$$, '42501', null, 'ownership column cannot be updated');
select throws_ok($$update public.profiles set first_name = null where id = '41000000-0000-0000-0000-000000000001'$$, '23514', null, 'completed identity cannot lose required first name');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.profiles), 1::bigint, 'User B sees only own profile');

reset role;
select is((select display_name from public.profiles where id = '41000000-0000-0000-0000-000000000001'), 'An', 'User B did not change User A identity');
select * from finish(); rollback;
