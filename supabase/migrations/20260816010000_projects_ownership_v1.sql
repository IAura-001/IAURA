create table public.projects (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 200),
  data jsonb not null check (jsonb_typeof(data) = 'object' and data ->> 'id' = id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index projects_user_updated_idx on public.projects (user_id, updated_at desc);
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
create policy projects_select_own on public.projects for select to authenticated using ((select auth.uid()) = user_id);
create policy projects_insert_own on public.projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy projects_update_own on public.projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy projects_delete_own on public.projects for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.projects from anon, authenticated;
grant select, delete on table public.projects to authenticated;
grant insert (user_id, id, data) on table public.projects to authenticated;
grant update (data) on table public.projects to authenticated;

comment on table public.projects is 'Authenticated IAURA projects; logical IDs are unique per owner.';
