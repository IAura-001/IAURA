alter table public.profiles
  add column first_name text,
  add column last_name text,
  add column onboarding_completed boolean not null default false,
  add constraint profiles_first_name_valid check (
    first_name is null or char_length(btrim(first_name)) between 1 and 80
  ),
  add constraint profiles_last_name_valid check (
    last_name is null or char_length(btrim(last_name)) between 1 and 100
  ),
  add constraint profiles_completed_identity_valid check (
    not onboarding_completed or (
      first_name is not null and char_length(btrim(first_name)) between 1 and 80 and
      display_name is not null and char_length(btrim(display_name)) between 1 and 120
    )
  );

grant update (first_name, last_name, display_name, onboarding_completed)
on table public.profiles to authenticated;

comment on column public.profiles.onboarding_completed is
  'True only after the authenticated user explicitly submits personal identity onboarding.';
