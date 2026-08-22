create table public.intelligence_action_executions (
  user_id uuid not null references auth.users(id) on delete cascade,
  execution_id uuid not null,
  operation text not null check (operation in (
    'intelligence_set_direction', 'intelligence_create_goal',
    'intelligence_create_priority', 'intelligence_create_recurring_commitment'
  )),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  record_id uuid null,
  created_at timestamptz not null default now(),
  primary key (user_id, execution_id),
  foreign key (user_id, record_id)
    references public.intelligence_records(user_id, id) on delete cascade
);

alter table public.intelligence_action_executions enable row level security;
create policy intelligence_action_executions_select_own
on public.intelligence_action_executions for select to authenticated
using ((select auth.uid()) = user_id);
create policy intelligence_action_executions_insert_own
on public.intelligence_action_executions for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy intelligence_action_executions_update_own
on public.intelligence_action_executions for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on table public.intelligence_action_executions from anon, public, authenticated;

create function public.create_intelligence_record_idempotent(
  requested_execution_id uuid,
  requested_operation text,
  requested_payload jsonb
)
returns setof public.intelligence_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  execution_row public.intelligence_action_executions%rowtype;
  created_record public.intelligence_records%rowtype;
  requested_type text := requested_payload->>'type';
  requested_scope text := requested_payload->>'scopeType';
  requested_project text := requested_payload->>'projectId';
  requested_goal uuid;
  next_position smallint;
begin
  if owner_id is null or requested_execution_id is null or requested_payload is null
    or requested_operation not in ('intelligence_set_direction','intelligence_create_goal','intelligence_create_priority','intelligence_create_recurring_commitment')
    or (requested_operation = 'intelligence_set_direction' and requested_type <> 'direction')
    or (requested_operation = 'intelligence_create_goal' and requested_type <> 'goal')
    or (requested_operation = 'intelligence_create_priority' and requested_type <> 'priority')
    or (requested_operation = 'intelligence_create_recurring_commitment' and requested_type <> 'recurring_commitment')
    or requested_scope not in ('global','project')
    or (requested_scope = 'global' and requested_payload->'projectId' <> 'null'::jsonb)
    or (requested_scope = 'project' and nullif(requested_project,'') is null) then
    raise exception 'IAURA_INTELLIGENCE_INVALID_INPUT' using errcode = '23514';
  end if;

  insert into public.intelligence_action_executions(user_id, execution_id, operation, payload)
  values(owner_id, requested_execution_id, requested_operation, requested_payload)
  on conflict (user_id, execution_id) do nothing;

  select * into execution_row from public.intelligence_action_executions
  where user_id = owner_id and execution_id = requested_execution_id for update;
  if execution_row.operation <> requested_operation or execution_row.payload <> requested_payload then
    raise exception 'IAURA_INTELLIGENCE_IDEMPOTENCY_CONFLICT' using errcode = '23514';
  end if;
  if execution_row.record_id is not null then
    return query select r.* from public.intelligence_records r
      where r.user_id = owner_id and r.id = execution_row.record_id;
    return;
  end if;

  if requested_type = 'priority' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text || ':' || requested_scope || ':' || coalesce(requested_project,'__global__'), 0));
    select min(slot)::smallint into next_position from generate_series(1,3) slot
    where not exists (select 1 from public.intelligence_records r where r.user_id=owner_id
      and r.record_type='priority' and r.status='active' and r.scope_type=requested_scope
      and r.project_id is not distinct from requested_project and r.position=slot);
    if next_position is null then raise exception 'IAURA_INTELLIGENCE_PRIORITY_LIMIT' using errcode='23514'; end if;
    requested_goal := nullif(requested_payload->>'goalId','')::uuid;
  end if;

  insert into public.intelligence_records(
    user_id, record_type, scope_type, project_id, title, content, status,
    target_date, goal_id, position, cadence, cadence_detail
  ) values (
    owner_id, requested_type, requested_scope, requested_project,
    nullif(requested_payload->>'title',''), nullif(requested_payload->>'content',''), 'active',
    nullif(requested_payload->>'targetDate','')::date, requested_goal, next_position,
    nullif(requested_payload->>'cadence',''), nullif(requested_payload->>'cadenceDetail','')
  ) returning * into created_record;

  update public.intelligence_action_executions set record_id=created_record.id
  where user_id=owner_id and execution_id=requested_execution_id;
  return next created_record;
end;
$$;

create function public.reorder_intelligence_priorities_guarded(
  ordered_ids uuid[], requested_scope_type text, requested_project_id text,
  expected_priorities jsonb
)
returns setof public.intelligence_records
language plpgsql
security definer
set search_path = ''
as $$
declare canonical_snapshot jsonb;
begin
  if (select auth.uid()) is null or requested_scope_type not in ('global','project')
    or (requested_scope_type='global' and requested_project_id is not null)
    or (requested_scope_type='project' and requested_project_id is null)
    or cardinality(ordered_ids) not between 1 and 3
    or cardinality(ordered_ids) <> (select count(distinct x) from unnest(ordered_ids) x)
    or jsonb_typeof(expected_priorities) <> 'array' then
    raise exception 'IAURA_INTELLIGENCE_INVALID_PRIORITY_ORDER' using errcode='23514';
  end if;

  perform 1 from public.intelligence_records r where r.user_id=(select auth.uid())
    and r.record_type='priority' and r.status='active' and r.scope_type=requested_scope_type
    and r.project_id is not distinct from requested_project_id for update;
  select coalesce(jsonb_agg(jsonb_build_object('recordId',r.id,'position',r.position,'updatedAt',r.updated_at) order by r.position),'[]'::jsonb)
    into canonical_snapshot from public.intelligence_records r where r.user_id=(select auth.uid())
    and r.record_type='priority' and r.status='active' and r.scope_type=requested_scope_type
    and r.project_id is not distinct from requested_project_id;
  if canonical_snapshot <> expected_priorities or jsonb_array_length(expected_priorities) <> cardinality(ordered_ids)
    or exists(select 1 from unnest(ordered_ids) x where not canonical_snapshot @> jsonb_build_array(jsonb_build_object('recordId',x::text))) then
    raise exception 'IAURA_INTELLIGENCE_STALE' using errcode='40001';
  end if;

  set constraints public.intelligence_records_active_priority_slot_unique deferred;
  update public.intelligence_records r set position=o.position
  from unnest(ordered_ids) with ordinality o(id,position)
  where r.user_id=(select auth.uid()) and r.id=o.id;
  return query select r.* from public.intelligence_records r where r.user_id=(select auth.uid()) and r.id=any(ordered_ids) order by r.position;
end;
$$;

revoke all on function public.create_intelligence_record_idempotent(uuid,text,jsonb) from public, anon;
revoke all on function public.reorder_intelligence_priorities_guarded(uuid[],text,text,jsonb) from public, anon;
grant execute on function public.create_intelligence_record_idempotent(uuid,text,jsonb) to authenticated;
grant execute on function public.reorder_intelligence_priorities_guarded(uuid[],text,text,jsonb) to authenticated;
