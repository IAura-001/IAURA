alter table public.beta_usage_events
  drop constraint beta_usage_events_event_type_check;

alter table public.beta_usage_events
  add constraint beta_usage_events_event_type_check check (event_type in (
    'beta_signed_in', 'project_opened', 'project_created', 'message_sent',
    'beta_step_completed', 'meaningful_session', 'first_intent_submitted',
    'project_scoped_result', 'durable_output', 'activated',
    'launch_foundation_progress', 'launch_foundation_completed'
  )),
  add column schema_version smallint not null default 1 check (schema_version between 1 and 32),
  add column session_id uuid,
  add column source text check (source is null or source in (
    'presence', 'project', 'project_form', 'conversation', 'project_persistence'
  ));

create index beta_usage_events_type_created_idx
  on public.beta_usage_events (event_type, created_at desc);
create index beta_usage_events_project_created_idx
  on public.beta_usage_events (project_id, created_at desc) where project_id is not null;
create index beta_usage_events_session_idx
  on public.beta_usage_events (user_id, session_id, created_at) where session_id is not null;

create or replace function public.record_product_funnel_event(
  p_event_type text,
  p_project_id text default null,
  p_event_key text default null,
  p_session_id uuid default null,
  p_source text default null,
  p_schema_version smallint default 1,
  p_metadata jsonb default '{}'::jsonb
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  inserted_count integer := 0;
  milestone text;
  completed_project_id text;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_event_type not in (
    'beta_signed_in', 'project_opened', 'project_created', 'message_sent',
    'beta_step_completed', 'meaningful_session', 'first_intent_submitted',
    'project_scoped_result', 'durable_output'
  ) then raise exception 'Invalid product event' using errcode = '22023'; end if;
  if p_project_id is not null and not exists (
    select 1 from public.projects p where p.id = p_project_id and p.user_id = actor
  ) then raise exception 'Project scope not found' using errcode = '22023'; end if;
  if jsonb_typeof(p_metadata) <> 'object' or octet_length(p_metadata::text) > 2048
  then raise exception 'Invalid event metadata' using errcode = '22023'; end if;

  if p_session_id is not null and p_event_type in (
    'project_opened', 'project_created', 'first_intent_submitted',
    'project_scoped_result', 'durable_output', 'beta_step_completed'
  ) then
    insert into public.beta_usage_events
      (user_id, event_type, event_key, session_id, source, schema_version, metadata)
    values
      (actor, 'meaningful_session', 'meaningful_session:' || p_session_id::text,
       p_session_id, p_source, p_schema_version, '{}'::jsonb)
    on conflict (user_id, event_key) do nothing;
  end if;

  insert into public.beta_usage_events
    (user_id, event_type, project_id, event_key, session_id, source, schema_version, metadata)
  values
    (actor, p_event_type, p_project_id, p_event_key, p_session_id,
     p_source, p_schema_version, p_metadata)
  on conflict (user_id, event_key) do nothing;
  get diagnostics inserted_count = row_count;

  if p_event_type = 'project_scoped_result' then milestone := 'scoped_project'; end if;
  if p_event_type = 'durable_output' and p_metadata ->> 'durable_kind' in (
    'audience_offer_direction', 'brand_system', 'approved_visual_asset',
    'website_messaging', 'confirmed_next_action', 'launch_brief'
  ) then milestone := p_metadata ->> 'durable_kind'; end if;
  if milestone is not null then
    insert into public.beta_usage_events
      (user_id, event_type, project_id, event_key, session_id, source, schema_version, metadata)
    values
      (actor, 'launch_foundation_progress', p_project_id,
       'launch_progress:' || p_project_id || ':' || milestone, p_session_id,
       p_source, p_schema_version, jsonb_build_object('milestone', milestone))
    on conflict (user_id, event_key) do nothing;
  end if;

  if p_session_id is not null and exists (
    select 1 from public.beta_usage_events r
    join public.beta_usage_events d on d.user_id = r.user_id
      and d.project_id = r.project_id and d.session_id = r.session_id
      and d.event_type = 'durable_output'
    join public.projects p on p.user_id = r.user_id and p.id = r.project_id
    where r.user_id = actor and r.event_type = 'project_scoped_result'
      and r.session_id = p_session_id
  ) then
    insert into public.beta_usage_events
      (user_id, event_type, event_key, session_id, source, schema_version, metadata)
    values (actor, 'activated', 'activated:first', p_session_id,
      'conversation', p_schema_version, '{}'::jsonb)
    on conflict (user_id, event_key) do nothing;
  end if;

  if exists (select 1 from public.beta_usage_events a where a.user_id = actor and a.event_type = 'activated')
     and exists (
       select 1 from public.beta_usage_events s
       join public.beta_usage_events a on a.user_id = s.user_id and a.event_type = 'activated'
       where s.user_id = actor and s.event_type = 'meaningful_session'
         and s.created_at::date > a.created_at::date
     ) then
    insert into public.beta_usage_events
      (user_id, event_type, event_key, session_id, source, schema_version, metadata)
    values (actor, 'launch_foundation_progress', 'launch_progress:return_session',
      p_session_id, p_source, p_schema_version, '{"milestone":"return_session"}'::jsonb)
    on conflict (user_id, event_key) do nothing;
  end if;

  select e.project_id into completed_project_id
  from public.beta_usage_events e
  where e.user_id = actor and e.event_type = 'launch_foundation_progress'
    and e.project_id is not null
    and e.metadata ->> 'milestone' in (
      'scoped_project', 'audience_offer_direction', 'brand_system',
      'approved_visual_asset', 'website_messaging', 'confirmed_next_action'
    )
  group by e.project_id
  having count(distinct e.metadata ->> 'milestone') = 6
  limit 1;
  if completed_project_id is not null and exists (
    select 1 from public.beta_usage_events e where e.user_id = actor
      and e.event_type = 'launch_foundation_progress'
      and e.metadata ->> 'milestone' = 'return_session'
  ) then
    insert into public.beta_usage_events
      (user_id, event_type, project_id, event_key, session_id, source, schema_version, metadata)
    values (actor, 'launch_foundation_completed', completed_project_id,
      'launch_foundation_completed:first', p_session_id, p_source,
      p_schema_version, '{}'::jsonb)
    on conflict (user_id, event_key) do nothing;
  end if;
  return true;
end;
$$;

revoke all on function public.record_product_funnel_event(text,text,text,uuid,text,smallint,jsonb)
  from public, anon;
grant execute on function public.record_product_funnel_event(text,text,text,uuid,text,smallint,jsonb)
  to authenticated;

comment on function public.record_product_funnel_event(text,text,text,uuid,text,smallint,jsonb) is
  'Records privacy-safe, idempotent product events and derives activation. No product content is accepted.';

drop function if exists public.founder_beta_usage();
create function public.founder_beta_usage()
returns table (
  user_id uuid, email text, display_name text, registered_at timestamptz,
  beta_joined_at timestamptz, last_sign_in_at timestamptz, last_active_at timestamptz,
  project_count bigint, conversation_count bigint, message_count bigint,
  meaningful_interaction_count bigint, latest_milestone text,
  evidence_source text, data_quality_issues text[], activated_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.beta_memberships bm
    where bm.user_id = auth.uid() and bm.role = 'founder' and bm.status = 'active'
  ) then raise exception 'Founder access required' using errcode = '42501'; end if;
  return query
  with project_activity as (
    select p.user_id, count(*)::bigint project_count, max(p.updated_at) last_project_at
    from public.projects p group by p.user_id
  ), conversation_activity as (
    select cs.user_id, cs.updated_at last_conversation_at,
      count(distinct c.item ->> 'conversationId')::bigint conversation_count,
      count(m.item) filter (where m.item ->> 'role' = 'user')::bigint message_count
    from public.conversation_state cs
    left join lateral jsonb_array_elements(case when jsonb_typeof(cs.data -> 'conversations') = 'array'
      then cs.data -> 'conversations' else '[]'::jsonb end) c(item) on true
    left join lateral jsonb_array_elements(case when jsonb_typeof(c.item -> 'messages') = 'array'
      then c.item -> 'messages' else '[]'::jsonb end) m(item) on true
    group by cs.user_id, cs.updated_at
  ), event_activity as (
    select e.user_id, count(*) filter (where e.event_type = 'meaningful_session')::bigint meaningful_count,
      max(e.created_at) last_event_at,
      min(e.created_at) filter (where e.event_type = 'activated') activated_at,
      (array_agg(coalesce(e.metadata ->> 'milestone', e.event_type) order by e.created_at desc))[1] latest_event
    from public.beta_usage_events e group by e.user_id
  )
  select bm.user_id, au.email::text, p.display_name, au.created_at, bm.claimed_at,
    au.last_sign_in_at,
    greatest(au.last_sign_in_at, pa.last_project_at, ca.last_conversation_at, ea.last_event_at),
    coalesce(pa.project_count, 0), coalesce(ca.conversation_count, 0),
    coalesce(ca.message_count, 0), coalesce(ea.meaningful_count, 0), ea.latest_event,
    case when ea.last_event_at is not null then 'explicit'
      when au.last_sign_in_at is not null or coalesce(pa.project_count, 0) > 0 then 'inferred'
      else 'none' end,
    array_remove(array[case when p.id is null then 'MISSING_PROFILE' end], null)::text[],
    ea.activated_at
  from public.beta_memberships bm
  join auth.users au on au.id = bm.user_id
  left join public.profiles p on p.id = bm.user_id
  left join project_activity pa on pa.user_id = bm.user_id
  left join conversation_activity ca on ca.user_id = bm.user_id
  left join event_activity ea on ea.user_id = bm.user_id;
end;
$$;
revoke all on function public.founder_beta_usage() from public, anon;
grant execute on function public.founder_beta_usage() to authenticated;
