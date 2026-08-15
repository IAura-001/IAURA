begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.beta_invites (token_hash, email, expires_at, max_claims, claim_count, revoked_at)
values
  (encode(extensions.digest(repeat('r', 32)::bytea, 'sha256'), 'hex'), 'bound@example.com', now() + interval '1 day', 1, 0, null),
  (encode(extensions.digest(repeat('x', 32)::bytea, 'sha256'), 'hex'), 'hidden@example.com', now() - interval '1 day', 1, 0, null),
  (encode(extensions.digest(repeat('v', 32)::bytea, 'sha256'), 'hex'), null, now() + interval '1 day', 1, 0, now()),
  (encode(extensions.digest(repeat('e', 32)::bytea, 'sha256'), 'hex'), null, now() + interval '1 day', 1, 1, null);

set local role anon;
select ok(public.recognize_beta_invite(repeat('r', 32)), 'anon recognizes an available email-bound invite');
select isnt(public.recognize_beta_invite(repeat('z', 32)), true, 'invalid invite is unavailable');
select isnt(public.recognize_beta_invite(repeat('x', 32)), true, 'expired invite is unavailable');
select isnt(public.recognize_beta_invite(repeat('v', 32)), true, 'revoked invite is unavailable');
select isnt(public.recognize_beta_invite(repeat('e', 32)), true, 'exhausted invite is unavailable');
select isnt(public.recognize_beta_invite('short'), true, 'short input is unavailable');
select throws_ok('select * from public.beta_invites', '42501', null, 'recognition grant does not expose invite rows');

reset role;
select is((select claim_count from public.beta_invites where token_hash = encode(extensions.digest(repeat('r', 32)::bytea, 'sha256'), 'hex')), 0, 'recognition does not consume capacity');
select is((select count(*) from public.beta_memberships), 0::bigint, 'recognition does not create membership');

select * from finish();
rollback;
