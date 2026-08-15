create extension if not exists pgcrypto with schema extensions;

create type public.beta_membership_role as enum ('founder', 'member');
create type public.beta_membership_status as enum ('active', 'revoked');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (
    display_name is null or char_length(btrim(display_name)) between 1 and 120
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  email text check (
    email is null or (
      email = lower(btrim(email)) and
      char_length(email) between 3 and 320
    )
  ),
  expires_at timestamptz not null,
  max_claims integer not null default 1 check (max_claims > 0),
  claim_count integer not null default 0 check (
    claim_count >= 0 and claim_count <= max_claims
  ),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  label text check (label is null or char_length(label) <= 120),
  note text check (note is null or char_length(note) <= 1000),
  check (revoked_at is null or revoked_at >= created_at)
);

create table public.beta_memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  invite_id uuid not null references public.beta_invites (id) on delete restrict,
  role public.beta_membership_role not null default 'member',
  status public.beta_membership_status not null default 'active',
  claimed_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'active' and revoked_at is null) or
    (status = 'revoked' and revoked_at is not null)
  ),
  check (revoked_at is null or revoked_at >= claimed_at)
);

create index beta_memberships_invite_id_idx
  on public.beta_memberships (invite_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_display_name text;
begin
  requested_display_name := nullif(
    btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')),
    ''
  );

  insert into public.profiles (id, display_name)
  values (
    new.id,
    case
      when char_length(requested_display_name) <= 120 then requested_display_name
      else null
    end
  );

  return new;
end;
$$;

create trigger create_profile_after_auth_user
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.beta_invites enable row level security;
alter table public.beta_memberships enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy beta_memberships_select_own
on public.beta_memberships
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.beta_invites from anon, authenticated;
revoke all on table public.beta_memberships from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant select on table public.beta_memberships to authenticated;

create function public.claim_beta_invite(invite_token text)
returns public.beta_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
  authenticated_email text;
  supplied_hash text;
  locked_invite public.beta_invites%rowtype;
  claimed_membership public.beta_memberships%rowtype;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if invite_token is null or char_length(invite_token) < 32 then
    raise exception 'Invalid invite' using errcode = '22023';
  end if;

  supplied_hash := encode(
    extensions.digest(convert_to(invite_token, 'UTF8'), 'sha256'),
    'hex'
  );

  select lower(btrim(email))
  into authenticated_email
  from auth.users
  where id = authenticated_user_id;

  select *
  into locked_invite
  from public.beta_invites
  where token_hash = supplied_hash
  for update;

  if not found then
    raise exception 'Invite is not claimable' using errcode = 'P0001';
  end if;

  if locked_invite.revoked_at is not null
    or locked_invite.expires_at <= now()
    or locked_invite.claim_count >= locked_invite.max_claims then
    raise exception 'Invite is not claimable' using errcode = 'P0001';
  end if;

  if locked_invite.email is not null
    and locked_invite.email <> authenticated_email then
    raise exception 'Invite is not claimable' using errcode = 'P0001';
  end if;

  perform 1
  from public.beta_memberships
  where user_id = authenticated_user_id
  for update;

  if found then
    raise exception 'User already has a beta membership' using errcode = '23505';
  end if;

  update public.beta_invites
  set claim_count = claim_count + 1
  where id = locked_invite.id;

  insert into public.beta_memberships (
    user_id,
    invite_id,
    role,
    status
  ) values (
    authenticated_user_id,
    locked_invite.id,
    'member',
    'active'
  )
  returning * into claimed_membership;

  return claimed_membership;
end;
$$;

revoke all on function public.claim_beta_invite(text) from public, anon;
grant execute on function public.claim_beta_invite(text) to authenticated;

comment on function public.claim_beta_invite(text) is
  'Atomically claims a hashed beta invite for auth.uid(); raw tokens are never persisted.';
