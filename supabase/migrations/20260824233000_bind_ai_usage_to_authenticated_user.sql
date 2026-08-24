-- Bind every reservation to the end-user JWT presented to PostgreSQL.
-- The previously deployed service-role RPC accepted an arbitrary user UUID.
revoke all on function public.reserve_ai_usage_operation(uuid,text,text)
  from public, anon, authenticated, service_role;
drop function public.reserve_ai_usage_operation(uuid,text,text);

create function public.reserve_ai_usage_operation(
  requested_operation_type text, requested_request_id text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  authenticated_user_id uuid;
  reserved_id uuid;
  rolling_operations bigint;
  concurrent_operations bigint;
  policy_max_operations integer;
  policy_max_concurrent integer;
begin
  authenticated_user_id := auth.uid();
  if auth.role() is distinct from 'authenticated' or authenticated_user_id is null then
    raise exception 'Authenticated user access required' using errcode = '42501';
  end if;
  if requested_operation_type not in ('chat','creative_copy','creative_image','transcription','speech')
    or requested_request_id is null or char_length(requested_request_id) not between 1 and 200 then
    raise exception 'Invalid AI usage reservation' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(authenticated_user_id::text, 0));
  select coalesce(p.max_operations_24h,100), coalesce(p.max_concurrent,3)
  into policy_max_operations, policy_max_concurrent
  from (select 1) seed
  left join public.ai_usage_policies p on p.user_id = authenticated_user_id;

  select count(*) filter (where e.occurred_at >= now() - interval '24 hours'),
    count(*) filter (where e.status = 'reserved' and e.occurred_at >= now() - interval '10 minutes')
  into rolling_operations, concurrent_operations
  from public.ai_usage_events e where e.user_id = authenticated_user_id;

  if rolling_operations >= policy_max_operations or concurrent_operations >= policy_max_concurrent then
    raise exception 'AI usage safety limit reached' using errcode = 'P0001';
  end if;

  insert into public.ai_usage_events(user_id, operation_type, request_id)
  values(authenticated_user_id, requested_operation_type, requested_request_id)
  returning id into reserved_id;
  return reserved_id;
end; $$;

revoke all on function public.reserve_ai_usage_operation(text,text)
  from public, anon, service_role;
grant execute on function public.reserve_ai_usage_operation(text,text) to authenticated;
