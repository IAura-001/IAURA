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

  set constraints public.intelligence_records_active_priority_slot_unique deferred;

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
