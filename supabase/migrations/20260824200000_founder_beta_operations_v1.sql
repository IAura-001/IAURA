drop function if exists public.founder_beta_usage();

create function public.founder_beta_usage()
returns table (
  user_id uuid, email text, display_name text, registered_at timestamptz,
  beta_joined_at timestamptz, last_sign_in_at timestamptz, last_active_at timestamptz,
  project_count bigint, conversation_count bigint, message_count bigint,
  meaningful_interaction_count bigint, latest_milestone text,
  evidence_source text, data_quality_issues text[]
)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.beta_memberships bm
    where bm.user_id = auth.uid() and bm.role = 'founder' and bm.status = 'active'
  ) then
    raise exception 'Founder access required' using errcode = '42501';
  end if;

  return query
  with project_activity as (
    select p.user_id, count(*)::bigint project_count, min(p.created_at) first_project_at,
      max(p.updated_at) last_project_at
    from public.projects p group by p.user_id
  ), conversation_activity as (
    select cs.user_id, cs.updated_at last_conversation_at,
      count(distinct c.item ->> 'conversationId')::bigint conversation_count,
      count(m.item) filter (where m.item ->> 'role' = 'user')::bigint message_count
    from public.conversation_state cs
    left join lateral jsonb_array_elements(
      case when jsonb_typeof(cs.data -> 'conversations') = 'array'
        then cs.data -> 'conversations' else '[]'::jsonb end
    ) c(item) on true
    left join lateral jsonb_array_elements(
      case when jsonb_typeof(c.item -> 'messages') = 'array'
        then c.item -> 'messages' else '[]'::jsonb end
    ) m(item) on true
    group by cs.user_id, cs.updated_at
  ), event_activity as (
    select e.user_id, count(*)::bigint event_count, min(e.created_at) first_event_at,
      max(e.created_at) last_event_at,
      (array_agg(coalesce(e.metadata ->> 'milestone', e.event_type) order by e.created_at desc))[1] latest_event,
      bool_or(e.project_id is not null and not exists (
        select 1 from public.projects owned
        where owned.user_id = e.user_id and owned.id = e.project_id
      )) ownership_mismatch
    from public.beta_usage_events e group by e.user_id
  ), duplicate_emails as (
    select lower(au.email) email from public.beta_memberships bm
    join auth.users au on au.id = bm.user_id
    where au.email is not null group by lower(au.email) having count(*) > 1
  ), facts as (
    select bm.user_id, au.email::text, p.display_name, au.created_at registered_at,
      bm.claimed_at beta_joined_at, au.last_sign_in_at,
      greatest(au.last_sign_in_at, pa.last_project_at, ca.last_conversation_at, ea.last_event_at) last_active_at,
      coalesce(pa.project_count, 0) project_count,
      coalesce(ca.conversation_count, 0) conversation_count,
      coalesce(ca.message_count, 0) message_count,
      coalesce(ca.message_count, 0) meaningful_interaction_count,
      ea.latest_event latest_milestone,
      case when coalesce(ea.event_count, 0) > 0 then 'explicit'
        when au.last_sign_in_at is not null or coalesce(pa.project_count, 0) > 0
          or coalesce(ca.message_count, 0) > 0 then 'inferred' else 'none' end evidence_source,
      array_remove(array[
        case when p.id is null then 'MISSING_PROFILE' end,
        case when bm.claimed_at < au.created_at then 'MEMBERSHIP_BEFORE_REGISTRATION' end,
        case when least(pa.first_project_at, ea.first_event_at) < au.created_at then 'ACTIVITY_BEFORE_REGISTRATION' end,
        case when coalesce(ea.ownership_mismatch, false) then 'EVENT_PROJECT_OWNERSHIP_MISMATCH' end,
        case when de.email is not null then 'DUPLICATE_EMAIL' end
      ], null)::text[] data_quality_issues
    from public.beta_memberships bm
    join auth.users au on au.id = bm.user_id
    left join public.profiles p on p.id = bm.user_id
    left join project_activity pa on pa.user_id = bm.user_id
    left join conversation_activity ca on ca.user_id = bm.user_id
    left join event_activity ea on ea.user_id = bm.user_id
    left join duplicate_emails de on de.email = lower(au.email)
  )
  select * from facts;
end;
$$;

revoke all on function public.founder_beta_usage() from public, anon;
grant execute on function public.founder_beta_usage() to authenticated;
comment on function public.founder_beta_usage() is
  'Founder-only operational metadata. Returns counts/timestamps/quality flags and never private content.';
