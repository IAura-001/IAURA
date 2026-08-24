create type public.ai_usage_status as enum ('reserved', 'succeeded', 'failed');

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  completed_at timestamptz,
  provider text,
  model text,
  operation_type text not null check (operation_type in
    ('chat','creative_copy','creative_image','transcription','speech')),
  request_id text not null check (char_length(request_id) between 1 and 200),
  provider_request_id text,
  input_tokens bigint check (input_tokens >= 0),
  output_tokens bigint check (output_tokens >= 0),
  total_tokens bigint check (total_tokens >= 0),
  cached_input_tokens bigint check (cached_input_tokens >= 0),
  cache_write_tokens bigint check (cache_write_tokens >= 0),
  reasoning_tokens bigint check (reasoning_tokens >= 0),
  provider_usage_available boolean not null default false,
  estimated_cost_usd numeric(16,8) check (estimated_cost_usd >= 0),
  cost_pricing_version text,
  status public.ai_usage_status not null default 'reserved',
  unique (user_id, request_id),
  unique (provider, provider_request_id),
  check ((estimated_cost_usd is null) = (cost_pricing_version is null))
);

create index ai_usage_events_user_occurred_idx on public.ai_usage_events(user_id, occurred_at desc);
create index ai_usage_events_occurred_idx on public.ai_usage_events(occurred_at desc);
create index ai_usage_events_provider_model_idx on public.ai_usage_events(provider, model);
alter table public.ai_usage_events enable row level security;
revoke all on table public.ai_usage_events from public, anon, authenticated;
grant select, insert, update on table public.ai_usage_events to service_role;

create table public.ai_usage_policies (
  user_id uuid primary key references auth.users(id) on delete cascade,
  max_operations_24h integer not null check (max_operations_24h between 1 and 10000),
  max_concurrent integer not null check (max_concurrent between 1 and 100),
  updated_at timestamptz not null default now()
);
alter table public.ai_usage_policies enable row level security;
revoke all on table public.ai_usage_policies from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_usage_policies to service_role;

create function public.reserve_ai_usage_operation(
  requested_user_id uuid, requested_operation_type text, requested_request_id text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare reserved_id uuid; rolling_operations bigint; concurrent_operations bigint;
  policy_max_operations integer; policy_max_concurrent integer;
begin
  if auth.role() is distinct from 'service_role' and session_user <> 'postgres' then
    raise exception 'Trusted server access required' using errcode = '42501';
  end if;
  if requested_user_id is null or requested_operation_type not in
    ('chat','creative_copy','creative_image','transcription','speech')
    or requested_request_id is null or char_length(requested_request_id) not between 1 and 200 then
    raise exception 'Invalid AI usage reservation' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_user_id::text, 0));
  select coalesce(p.max_operations_24h,100), coalesce(p.max_concurrent,3)
  into policy_max_operations, policy_max_concurrent
  from (select 1) seed left join public.ai_usage_policies p on p.user_id=requested_user_id;
  select count(*) filter (where occurred_at >= now() - interval '24 hours'),
    count(*) filter (where status = 'reserved' and occurred_at >= now() - interval '10 minutes')
  into rolling_operations, concurrent_operations
  from public.ai_usage_events where user_id = requested_user_id;
  -- Private Beta safety policy applies explicitly and equally to founders.
  if rolling_operations >= policy_max_operations or concurrent_operations >= policy_max_concurrent then
    raise exception 'AI usage safety limit reached' using errcode = 'P0001';
  end if;
  insert into public.ai_usage_events(user_id, operation_type, request_id)
  values(requested_user_id, requested_operation_type, requested_request_id)
  returning id into reserved_id;
  return reserved_id;
end; $$;

revoke all on function public.reserve_ai_usage_operation(uuid,text,text) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage_operation(uuid,text,text) to service_role;

create function public.founder_ai_cost_operations()
returns table (
  scope text, user_id uuid, email text, operations bigint, failed_operations bigint,
  input_tokens bigint, output_tokens bigint, total_tokens bigint,
  estimated_cost_usd numeric, unpriced_operations bigint, last_operation_at timestamptz,
  active_users bigint, cost_per_active_user numeric, anomaly_status text,
  limit_operations_24h bigint, limit_max_operations_24h integer
) language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.beta_memberships bm
    where bm.user_id = auth.uid() and bm.role = 'founder' and bm.status = 'active') then
    raise exception 'Founder access required' using errcode = '42501';
  end if;
  return query
  with reporting_windows(activity_scope, since_at) as (values
    ('today', date_trunc('day', now())), ('7d', now()-interval '7 days'), ('30d', now()-interval '30 days')
  ), daily_activity as (
    select e.user_id as activity_user_id, date_trunc('day', e.occurred_at) as activity_day,
      count(*) as operation_count, coalesce(sum(e.total_tokens),0) as token_count,
      coalesce(sum(e.estimated_cost_usd),0) as estimated_cost
    from public.ai_usage_events e where e.occurred_at >= now()-interval '30 days'
    group by e.user_id, date_trunc('day', e.occurred_at)
  ), daily_baseline as (
    select d.activity_day, avg(d.operation_count) as average_operations
    from daily_activity d group by d.activity_day
  ), anomaly as (
    select d.activity_user_id,
      max(case when d.operation_count >= 80 or d.token_count >= 500000 or d.estimated_cost >= 5 then 3
        when d.operation_count >= 50 or d.token_count >= 250000 or d.estimated_cost >= 3 then 2
        when d.operation_count >= 25 or d.token_count >= 100000 or d.estimated_cost >= 1
          or (d.operation_count >= 10 and d.operation_count >= 4*b.average_operations) then 1 else 0 end)
        as anomaly_level
    from daily_activity d join daily_baseline b on b.activity_day=d.activity_day
    group by d.activity_user_id
  ), rolling as (
    select e.user_id as activity_user_id,
      count(*) filter(where e.occurred_at >= now()-interval '24 hours') as operations_24h
    from public.ai_usage_events e group by e.user_id
  )
  select w.activity_scope, null::uuid, null::text, count(e.id), count(e.id) filter(where e.status='failed'),
    coalesce(sum(e.input_tokens),0)::bigint, coalesce(sum(e.output_tokens),0)::bigint,
    coalesce(sum(e.total_tokens),0)::bigint,
    coalesce(sum(e.estimated_cost_usd),0), count(*) filter(where e.status='succeeded' and e.estimated_cost_usd is null),
    max(e.occurred_at), count(distinct e.user_id),
    coalesce(sum(e.estimated_cost_usd),0)/nullif(count(distinct e.user_id),0), 'NORMAL', null::bigint, 100
  from reporting_windows w left join public.ai_usage_events e on e.occurred_at >= w.since_at
  group by w.activity_scope
  union all
  select 'user_30d', bm.user_id, au.email::text, count(e.id), count(e.id) filter(where e.status='failed'),
    coalesce(sum(e.input_tokens),0)::bigint, coalesce(sum(e.output_tokens),0)::bigint,
    coalesce(sum(e.total_tokens),0)::bigint,
    coalesce(sum(e.estimated_cost_usd),0), count(*) filter(where e.status='succeeded' and e.estimated_cost_usd is null),
    max(e.occurred_at), null::bigint, null::numeric,
    case coalesce(a.anomaly_level,0) when 3 then 'REVIEW' when 2 then 'HIGH' when 1 then 'ELEVATED' else 'NORMAL' end,
    coalesce(r.operations_24h,0), coalesce(p.max_operations_24h,100)
  from public.beta_memberships bm join auth.users au on au.id=bm.user_id
  left join public.ai_usage_events e on e.user_id=bm.user_id and e.occurred_at>=now()-interval '30 days'
  left join anomaly a on a.activity_user_id=bm.user_id
  left join rolling r on r.activity_user_id=bm.user_id
  left join public.ai_usage_policies p on p.user_id=bm.user_id
  group by bm.user_id,au.email,a.anomaly_level,r.operations_24h,p.max_operations_24h;
end; $$;

revoke all on function public.founder_ai_cost_operations() from public, anon;
grant execute on function public.founder_ai_cost_operations() to authenticated;
comment on table public.ai_usage_events is
  'Authoritative metadata-only provider operation accounting. Never stores prompts, content, or secrets.';
