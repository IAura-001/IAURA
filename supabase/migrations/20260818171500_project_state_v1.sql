create table public.project_state (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  active_project_id text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger project_state_set_updated_at
before update on public.project_state
for each row
execute function public.set_updated_at();

alter table public.project_state
enable row level security;

create policy project_state_select_own
on public.project_state
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy project_state_insert_own
on public.project_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy project_state_update_own
on public.project_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy project_state_delete_own
on public.project_state
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.project_state
from anon, public;

grant select, insert, update, delete
on table public.project_state
to authenticated;

comment on table public.project_state is
  'Authenticated IAURA active project source of truth; one row per user.';
