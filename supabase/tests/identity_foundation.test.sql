begin;

create extension if not exists pgtap with schema extensions;
select plan(41);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'a@example.com', '{"display_name":"User A"}'),
  ('20000000-0000-0000-0000-000000000002', 'b@example.com', '{"display_name":"User B"}');

insert into public.beta_invites (
  id, token_hash, email, expires_at, max_claims, claim_count, revoked_at
)
values
  ('a0000000-0000-0000-0000-000000000001', encode(extensions.digest(convert_to(repeat('a', 32), 'UTF8'), 'sha256'), 'hex'), 'a@example.com', now() + interval '1 day', 1, 0, null),
  ('a0000000-0000-0000-0000-000000000002', encode(extensions.digest(convert_to(repeat('b', 32), 'UTF8'), 'sha256'), 'hex'), null, now() - interval '1 day', 1, 0, null),
  ('a0000000-0000-0000-0000-000000000003', encode(extensions.digest(convert_to(repeat('c', 32), 'UTF8'), 'sha256'), 'hex'), null, now() + interval '1 day', 1, 0, now()),
  ('a0000000-0000-0000-0000-000000000004', encode(extensions.digest(convert_to(repeat('d', 32), 'UTF8'), 'sha256'), 'hex'), null, now() + interval '1 day', 1, 1, null),
  ('a0000000-0000-0000-0000-000000000005', encode(extensions.digest(convert_to(repeat('e', 32), 'UTF8'), 'sha256'), 'hex'), 'nobody@example.com', now() + interval '1 day', 1, 0, null),
  ('a0000000-0000-0000-0000-000000000006', encode(extensions.digest(convert_to(repeat('f', 32), 'UTF8'), 'sha256'), 'hex'), null, now() + interval '1 day', 1, 0, null);

set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot enumerate profiles');
select throws_ok('select * from public.beta_invites', '42501', null, 'anon cannot enumerate invites');
select throws_ok('select * from public.beta_memberships', '42501', null, 'anon cannot enumerate memberships');
select throws_ok($$select public.claim_beta_invite(repeat('a', 32))$$, '42501', null, 'anon cannot execute invite claims');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.profiles), 1::bigint, 'User A sees only own profile');
select is((select display_name from public.profiles), 'User A', 'User A reads own profile');
select throws_ok('select * from public.beta_invites', '42501', null, 'User A cannot enumerate invites');
select throws_ok($$insert into public.beta_invites (token_hash, expires_at) values (repeat('0', 64), now() + interval '1 day')$$, '42501', null, 'User A cannot create invites');
select throws_ok($$update public.beta_invites set revoked_at = now()$$, '42501', null, 'User A cannot revoke invites');
select throws_ok($$delete from public.beta_invites$$, '42501', null, 'User A cannot delete invites');
select throws_ok($$insert into public.profiles (id) values ('30000000-0000-0000-0000-000000000003')$$, '42501', null, 'User A cannot choose a profile identity');
select throws_ok($$insert into public.beta_memberships (user_id, invite_id, role, status) values ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'founder', 'active')$$, '42501', null, 'User A cannot directly create founder membership');

select lives_ok($$update public.profiles set display_name = 'A updated' where id = '10000000-0000-0000-0000-000000000001'$$, 'User A can update own display name');
select is((select count(*) from public.profiles where id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'User A cannot read User B profile');
select throws_ok($$update public.profiles set id = '20000000-0000-0000-0000-000000000002' where id = '10000000-0000-0000-0000-000000000001'$$, '42501', null, 'User A cannot select another profile identity');
select throws_ok($$update public.profiles set created_at = now() where id = '10000000-0000-0000-0000-000000000001'$$, '42501', null, 'User A cannot directly change created_at');
select throws_ok($$update public.profiles set updated_at = now() where id = '10000000-0000-0000-0000-000000000001'$$, '42501', null, 'User A cannot directly change updated_at');
select throws_ok($$update public.profiles set display_name = '   ' where id = '10000000-0000-0000-0000-000000000001'$$, '23514', null, 'blank display names are rejected');

select throws_ok($$select public.claim_beta_invite(repeat('z', 32))$$, 'P0001', null, 'invalid invite is rejected');
select throws_ok($$select public.claim_beta_invite(repeat('b', 32))$$, 'P0001', null, 'expired invite is rejected');
select throws_ok($$select public.claim_beta_invite(repeat('c', 32))$$, 'P0001', null, 'revoked invite is rejected');
select throws_ok($$select public.claim_beta_invite(repeat('d', 32))$$, 'P0001', null, 'exhausted invite is rejected');
select throws_ok($$select public.claim_beta_invite(repeat('e', 32))$$, 'P0001', null, 'email mismatch is rejected');
select lives_ok($$select public.claim_beta_invite(repeat('a', 32))$$, 'matching invite can be claimed');
reset role;
select is((select claim_count from public.beta_invites where id = 'a0000000-0000-0000-0000-000000000001'), 1, 'valid claim increments claim_count exactly once');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.beta_memberships), 1::bigint, 'User A sees own membership');
select is((select role::text from public.beta_memberships), 'member', 'claim provisions member role');
select is((select status::text from public.beta_memberships), 'active', 'claim provisions active status');
select throws_ok($$select public.claim_beta_invite(repeat('f', 32))$$, '23505', null, 'existing member cannot claim another invite');
reset role;
select is((select claim_count from public.beta_invites where id = 'a0000000-0000-0000-0000-000000000006'), 0, 'failed existing-member claim does not consume invite capacity');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select throws_ok($$update public.beta_memberships set role = 'founder' where user_id = '10000000-0000-0000-0000-000000000001'$$, '42501', null, 'User A cannot self-promote');
select throws_ok($$update public.beta_memberships set status = 'revoked', revoked_at = now() where user_id = '10000000-0000-0000-0000-000000000001'$$, '42501', null, 'User A cannot revoke membership');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.profiles), 1::bigint, 'User B sees only own profile');
select is((select count(*) from public.beta_memberships), 0::bigint, 'User B cannot read User A membership');
select lives_ok($$update public.profiles set display_name = 'spoofed' where id = '10000000-0000-0000-0000-000000000001'$$, 'RLS safely turns User B mutation of User A into a no-op');
select throws_ok($$select public.claim_beta_invite(repeat('a', 32))$$, 'P0001', null, 'single-use invite cannot be claimed twice');
select lives_ok($$select public.claim_beta_invite(repeat('f', 32))$$, 'User B has the same valid claim path');

reset role;
select is(
  (select display_name from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  'A updated',
  'User B mutation did not change User A profile'
);
select is((select count(*) from public.profiles), 2::bigint, 'Auth trigger created exactly one profile per user');
select is((select count(*) from public.profiles p join auth.users u on u.id = p.id), 2::bigint, 'Every profile ID matches its Auth user');
select is((select role::text from public.beta_memberships where user_id = '20000000-0000-0000-0000-000000000002'), 'member', 'User B claim also provisions member role');

select * from finish();
rollback;
