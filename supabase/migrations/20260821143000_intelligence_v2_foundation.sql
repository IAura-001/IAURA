create table public.intelligence_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null check (record_type in ('direction','goal','priority','recurring_commitment')),
  scope_type text not null check (scope_type in ('global','project')),
  project_id text null,
  title text null check (title is null or char_length(title) between 1 and 500),
  content text null check (content is null or char_length(content) between 1 and 2000),
  status text not null,
  target_date date null,
  goal_id uuid null,
  position smallint null check (position between 1 and 3),
  cadence text null check (cadence is null or cadence in ('daily','weekly','custom')),
  cadence_detail text null check (cadence_detail is null or char_length(cadence_detail) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scope_key text generated always as (coalesce(project_id, '__global__')) stored,
  active_priority_position smallint generated always as (
    case when record_type = 'priority' and status = 'active' then position else null end
  ) stored,

  constraint intelligence_records_owner_id_unique unique (user_id, id),
  constraint intelligence_records_project_owner_fk
    foreign key (user_id, project_id) references public.projects(user_id, id) on delete cascade,
  constraint intelligence_records_goal_owner_fk
    foreign key (user_id, goal_id) references public.intelligence_records(user_id, id),
  constraint intelligence_records_scope_check check (
    (scope_type = 'global' and project_id is null) or
    (scope_type = 'project' and project_id is not null)
  ),
  constraint intelligence_records_shape_check check (
    (record_type = 'direction' and content is not null and title is null and status in ('active','archived') and target_date is null and goal_id is null and position is null and cadence is null and cadence_detail is null) or
    (record_type = 'goal' and title is not null and content is null and status in ('active','completed','archived') and goal_id is null and position is null and cadence is null and cadence_detail is null) or
    (record_type = 'priority' and ((title is not null)::integer + (goal_id is not null)::integer = 1) and content is null and status in ('active','archived') and target_date is null and position is not null and cadence is null and cadence_detail is null) or
    (record_type = 'recurring_commitment' and title is not null and content is null and status in ('active','paused','archived') and target_date is null and goal_id is null and position is null and cadence is not null and (cadence <> 'custom' or cadence_detail is not null))
  ),
  constraint intelligence_records_active_priority_slot_unique
    unique (user_id, scope_key, active_priority_position)
    deferrable initially immediate
);

create unique index intelligence_one_active_global_direction_idx
on public.intelligence_records(user_id)
where record_type = 'direction' and scope_type = 'global' and status = 'active';

create unique index intelligence_one_active_project_direction_idx
on public.intelligence_records(user_id, project_id)
where record_type = 'direction' and scope_type = 'project' and status = 'active';

create index intelligence_user_scope_active_idx
on public.intelligence_records(user_id, scope_type, project_id, record_type, status);

create or replace function public.validate_intelligence_goal_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  referenced public.intelligence_records;
begin
  if new.record_type <> 'priority' or new.goal_id is null then
    return new;
  end if;

  select * into referenced
  from public.intelligence_records
  where user_id = new.user_id and id = new.goal_id;

  if referenced.id is null or referenced.record_type <> 'goal' or referenced.status = 'archived'
    or referenced.scope_type <> new.scope_type
    or referenced.project_id is distinct from new.project_id then
    raise exception 'IAURA_INTELLIGENCE_INVALID_GOAL_REFERENCE' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger intelligence_validate_goal_reference
before insert or update of goal_id, scope_type, project_id
on public.intelligence_records
for each row execute function public.validate_intelligence_goal_reference();

create trigger intelligence_records_set_updated_at
before update on public.intelligence_records
for each row execute function public.set_updated_at();

alter table public.intelligence_records enable row level security;

create policy intelligence_records_select_own
on public.intelligence_records for select to authenticated
using ((select auth.uid()) = user_id);

create policy intelligence_records_insert_own
on public.intelligence_records for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy intelligence_records_update_own
on public.intelligence_records for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.reorder_intelligence_priorities(
  ordered_ids uuid[],
  requested_scope_type text,
  requested_project_id text default null
)
returns setof public.intelligence_records
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_count integer;
begin
  if requested_scope_type not in ('global','project')
    or (requested_scope_type = 'global' and requested_project_id is not null)
    or (requested_scope_type = 'project' and requested_project_id is null)
    or cardinality(ordered_ids) > 3
    or cardinality(ordered_ids) <> (select count(distinct item) from unnest(ordered_ids) item) then
    raise exception 'IAURA_INTELLIGENCE_INVALID_PRIORITY_ORDER' using errcode = '23514';
  end if;

  select count(*) into expected_count
  from public.intelligence_records
  where user_id = (select auth.uid())
    and record_type = 'priority'
    and status = 'active'
    and scope_type = requested_scope_type
    and project_id is not distinct from requested_project_id;

  if expected_count <> cardinality(ordered_ids) or exists (
    select 1 from unnest(ordered_ids) item
    where not exists (
      select 1 from public.intelligence_records record
      where record.id = item and record.user_id = (select auth.uid())
        and record.record_type = 'priority' and record.status = 'active'
        and record.scope_type = requested_scope_type
        and record.project_id is not distinct from requested_project_id
    )
  ) then
    raise exception 'IAURA_INTELLIGENCE_INVALID_PRIORITY_ORDER' using errcode = '23514';
  end if;

  set constraints intelligence_records_active_priority_slot_unique deferred;

  update public.intelligence_records record
  set position = ordering.position
  from unnest(ordered_ids) with ordinality ordering(id, position)
  where record.user_id = (select auth.uid()) and record.id = ordering.id;

  return query
  select record.* from public.intelligence_records record
  where record.user_id = (select auth.uid())
    and record.id = any(ordered_ids)
  order by record.position;
end;
$$;

revoke all on table public.intelligence_records from anon, public, authenticated;
grant select on table public.intelligence_records to authenticated;
grant insert (
  id, user_id, record_type, scope_type, project_id, title, content,
  status, target_date, goal_id, position, cadence, cadence_detail
) on table public.intelligence_records to authenticated;
grant update (
  title, content, status, target_date, goal_id, position, cadence, cadence_detail
) on table public.intelligence_records to authenticated;

revoke all on function public.reorder_intelligence_priorities(uuid[], text, text) from public, anon;
grant execute on function public.reorder_intelligence_priorities(uuid[], text, text) to authenticated;

comment on table public.intelligence_records is
  'Canonical authenticated VAEORA Intelligence v2 records. Legacy Memory goals and habits are not imported.';
