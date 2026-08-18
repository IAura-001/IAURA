create table public.conversation_state (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  data jsonb not null
    check (jsonb_typeof(data) = 'object'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger conversation_state_set_updated_at
before update on public.conversation_state
for each row
execute function public.set_updated_at();

alter table public.conversation_state
enable row level security;

create policy conversation_state_select_own
on public.conversation_state
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy conversation_state_insert_own
on public.conversation_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy conversation_state_update_own
on public.conversation_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy conversation_state_delete_own
on public.conversation_state
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.conversation_state
from anon, public;

grant select, insert, update, delete
on table public.conversation_state
to authenticated;

comment on table public.conversation_state is
  'Authenticated IAURA conversation source of truth; one canonical conversation snapshot per user.';