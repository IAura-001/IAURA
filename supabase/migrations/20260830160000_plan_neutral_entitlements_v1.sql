create table public.entitlement_profiles (
  id text primary key check (id ~ '^[a-z0-9_]{1,80}$'),
  capabilities jsonb not null check (jsonb_typeof(capabilities) = 'array'),
  limits jsonb not null check (jsonb_typeof(limits) = 'object'),
  fallback_profile_id text references public.entitlement_profiles(id),
  enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

insert into public.entitlement_profiles(id, capabilities, limits) values
('beta_default_v1', '["project.create","ai.chat","ai.creative_copy","ai.creative_image","ai.transcription","ai.speech","image.tier.draft","image.tier.premium","image.tier.ultra","asset.upload"]',
 '{"maxActiveProjects":100,"aiOperationsPerMonth":10000,"imageCreditsPerMonth":1000,"storageBytes":5368709120,"assetCount":5000,"concurrentAiOperations":3}'),
('internal_unrestricted_v1', '["project.create","ai.chat","ai.creative_copy","ai.creative_image","ai.transcription","ai.speech","image.tier.draft","image.tier.premium","image.tier.ultra","asset.upload"]',
 '{"maxActiveProjects":10000,"aiOperationsPerMonth":1000000,"imageCreditsPerMonth":1000000,"storageBytes":1099511627776,"assetCount":1000000,"concurrentAiOperations":20}');
update public.entitlement_profiles set fallback_profile_id = 'beta_default_v1';

create table public.user_entitlement_assignments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_id text not null references public.entitlement_profiles(id),
  starts_at timestamptz, ends_at timestamptz,
  source text not null default 'manual' check (source in ('manual','internal','billing_sync','trial')),
  updated_at timestamptz not null default now(), check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create table public.user_entitlement_overrides (
  user_id uuid primary key references auth.users(id) on delete cascade,
  capabilities jsonb not null default '{}' check (jsonb_typeof(capabilities) = 'object'),
  limits jsonb not null default '{}' check (jsonb_typeof(limits) = 'object'),
  starts_at timestamptz, ends_at timestamptz, reason text not null check (char_length(reason) between 1 and 200),
  updated_at timestamptz not null default now(), check (ends_at is null or starts_at is null or ends_at > starts_at)
);
alter table public.entitlement_profiles enable row level security;
alter table public.user_entitlement_assignments enable row level security;
alter table public.user_entitlement_overrides enable row level security;
revoke all on public.entitlement_profiles, public.user_entitlement_assignments,
  public.user_entitlement_overrides from public, anon, authenticated;
grant select, insert, update, delete on public.entitlement_profiles,
  public.user_entitlement_assignments, public.user_entitlement_overrides to service_role;

alter table public.ai_usage_events add column entitlement_units integer not null default 1 check (entitlement_units between 0 and 100);
alter table public.ai_usage_events add column image_credit_units integer not null default 0 check (image_credit_units between 0 and 100);

create table public.asset_storage_reservations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  asset_id text not null, reserved_bytes bigint not null check (reserved_bytes between 1 and 23068672),
  created_at timestamptz not null default now(), unique(user_id, asset_id),
  foreign key (user_id, project_id) references public.projects(user_id, id) on delete cascade
);
create index asset_storage_reservations_expiry_idx on public.asset_storage_reservations(created_at);
alter table public.asset_storage_reservations enable row level security;
revoke all on public.asset_storage_reservations from public, anon, authenticated;
grant select, insert, update, delete on public.asset_storage_reservations to service_role;
revoke insert on public.creative_asset_objects from authenticated;
drop policy if exists creative_assets_insert_own on storage.objects;

create function public.effective_entitlement_document(actor uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare assignment public.user_entitlement_assignments; profile public.entitlement_profiles;
  fallback public.entitlement_profiles; override_row public.user_entitlement_overrides;
  effective_capabilities jsonb; effective_limits jsonb; period_start timestamptz;
  period_end timestamptz; active_projects bigint; ai_used bigint; image_used bigint;
  stored_bytes bigint; asset_count bigint; concurrent_ai bigint;
begin
  if actor is null then raise exception 'Authenticated user access required' using errcode='42501'; end if;
  select * into fallback from public.entitlement_profiles where id='beta_default_v1' and enabled;
  if fallback.id is null then raise exception 'Default entitlement profile unavailable' using errcode='55000'; end if;
  select * into assignment from public.user_entitlement_assignments a where a.user_id=actor
    and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>now());
  if assignment.profile_id is not null then select * into profile from public.entitlement_profiles
    where id=assignment.profile_id and enabled; end if;
  if profile.id is null then profile := fallback; end if;
  effective_capabilities := profile.capabilities; effective_limits := profile.limits;
  select * into override_row from public.user_entitlement_overrides o where o.user_id=actor
    and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now());
  if override_row.user_id is not null then
    effective_limits := effective_limits || override_row.limits;
    select coalesce(jsonb_agg(value), '[]'::jsonb) into effective_capabilities from (
      select value from jsonb_array_elements_text(effective_capabilities)
      where coalesce((override_row.capabilities->>value)::boolean, true)
      union select key from jsonb_each_text(override_row.capabilities) where value::boolean
    ) capabilities;
  end if;
  period_start := date_trunc('month', now()); period_end := period_start + interval '1 month';
  select count(*) into active_projects from public.projects p where p.user_id=actor
    and coalesce(p.data->>'status','planning') <> 'completed';
  select coalesce(sum(e.entitlement_units),0), coalesce(sum(e.image_credit_units),0),
    count(*) filter(where e.status='reserved' and e.occurred_at>=now()-interval '10 minutes')
    into ai_used,image_used,concurrent_ai from public.ai_usage_events e where e.user_id=actor and e.occurred_at>=period_start;
  select coalesce(sum(a.byte_size+a.thumbnail_byte_size),0), count(*) into stored_bytes,asset_count
    from public.creative_asset_objects a where a.user_id=actor;
  return jsonb_build_object('profileId',profile.id,'capabilities',effective_capabilities,'limits',effective_limits,
    'usage',jsonb_build_object('activeProjects',active_projects,'aiOperationsThisMonth',ai_used,
      'imageCreditsThisMonth',image_used,'storageBytes',stored_bytes,'assetCount',asset_count,
      'concurrentAiOperations',concurrent_ai),
    'period',jsonb_build_object('kind','calendar_month','startsAt',period_start,'resetsAt',period_end),
    'assignment',jsonb_build_object('startsAt',assignment.starts_at,'endsAt',assignment.ends_at));
end; $$;
revoke all on function public.effective_entitlement_document(uuid) from public,anon,authenticated;
grant execute on function public.effective_entitlement_document(uuid) to service_role;

create function public.resolve_current_entitlements() returns jsonb language sql stable security definer set search_path='' as $$
  select public.effective_entitlement_document(auth.uid()); $$;
revoke all on function public.resolve_current_entitlements() from public,anon,service_role;
grant execute on function public.resolve_current_entitlements() to authenticated;

create function public.create_project_with_entitlement(requested_id text, requested_data jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); document jsonb; current_count bigint; project_limit bigint;
begin
  if auth.role() is distinct from 'authenticated' or actor is null then raise exception 'Authenticated user access required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('project:'||actor::text,0));
  if exists(select 1 from public.projects where id=requested_id and user_id=actor) then return false; end if;
  document:=public.effective_entitlement_document(actor);
  if not (document->'capabilities' ? 'project.create') then raise exception 'CAPABILITY_NOT_ALLOWED' using errcode='P0002'; end if;
  current_count:=(document#>>'{usage,activeProjects}')::bigint; project_limit:=(document#>>'{limits,maxActiveProjects}')::bigint;
  if current_count>=project_limit then raise exception 'PROJECT_LIMIT_REACHED' using errcode='P0002'; end if;
  insert into public.projects(id,user_id,data) values(requested_id,actor,requested_data); return true;
end; $$;
revoke all on function public.create_project_with_entitlement(text,jsonb) from public,anon,service_role;
grant execute on function public.create_project_with_entitlement(text,jsonb) to authenticated;
revoke insert on public.projects from authenticated;

create function public.enforce_project_reactivation_entitlement() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); document jsonb; current_count bigint; project_limit bigint;
begin
  if coalesce(old.data->>'status','planning')='completed'
    and coalesce(new.data->>'status','planning')<>'completed' then
    if auth.role() is distinct from 'authenticated' or actor is null or actor<>old.user_id then
      raise exception 'Authenticated project owner required' using errcode='42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended('project:'||actor::text,0));
    document:=public.effective_entitlement_document(actor);
    if not (document->'capabilities' ? 'project.create') then
      raise exception 'CAPABILITY_NOT_ALLOWED' using errcode='P0002'; end if;
    current_count:=(document#>>'{usage,activeProjects}')::bigint;
    project_limit:=(document#>>'{limits,maxActiveProjects}')::bigint;
    if current_count>=project_limit then
      raise exception 'PROJECT_LIMIT_REACHED' using errcode='P0002'; end if;
  end if;
  return new;
end; $$;
revoke all on function public.enforce_project_reactivation_entitlement() from public,anon,authenticated,service_role;
create trigger projects_reactivation_entitlement before update of data on public.projects
for each row execute function public.enforce_project_reactivation_entitlement();

revoke all on function public.reserve_ai_usage_operation(text,text,text) from public,anon,authenticated,service_role;
drop function public.reserve_ai_usage_operation(text,text,text);
create function public.reserve_ai_usage_operation(requested_operation_type text, requested_request_id text,
  requested_project_id text default null, requested_image_tier text default null, requested_entitlement_units integer default 1)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); reserved_id uuid; rolling_operations bigint; concurrent_operations bigint;
  policy_max_operations integer; policy_max_concurrent integer; document jsonb; capability text;
  commercial_used bigint; commercial_limit bigint; commercial_concurrent bigint; image_units integer:=0; image_used bigint; image_limit bigint;
begin
  if auth.role() is distinct from 'authenticated' or actor is null then raise exception 'Authenticated user access required' using errcode='42501'; end if;
  if requested_operation_type not in ('chat','creative_copy','creative_image','transcription','speech') or requested_request_id is null
    or char_length(requested_request_id) not between 1 and 200 or requested_entitlement_units not between 0 and 100
    then raise exception 'Invalid AI usage reservation' using errcode='22023'; end if;
  if requested_project_id is not null and not exists(select 1 from public.projects p where p.id=requested_project_id and p.user_id=actor)
    then raise exception 'Project scope not found' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  document:=public.effective_entitlement_document(actor); capability:='ai.'||requested_operation_type;
  if not (document->'capabilities' ? capability) then raise exception 'CAPABILITY_NOT_ALLOWED' using errcode='P0002'; end if;
  commercial_used:=(document#>>'{usage,aiOperationsThisMonth}')::bigint;
  commercial_limit:=(document#>>'{limits,aiOperationsPerMonth}')::bigint;
  commercial_concurrent:=(document#>>'{limits,concurrentAiOperations}')::bigint;
  concurrent_operations:=(document#>>'{usage,concurrentAiOperations}')::bigint;
  if commercial_used+requested_entitlement_units>commercial_limit then raise exception 'AI_ALLOWANCE_EXHAUSTED' using errcode='P0002'; end if;
  if concurrent_operations>=commercial_concurrent then raise exception 'CONCURRENCY_LIMIT_REACHED' using errcode='P0003'; end if;
  if requested_operation_type='creative_image' then
    if requested_image_tier not in ('draft','premium','ultra') then raise exception 'Invalid image tier' using errcode='22023'; end if;
    if not (document->'capabilities' ? ('image.tier.'||requested_image_tier)) then raise exception 'IMAGE_TIER_NOT_ALLOWED' using errcode='P0002'; end if;
    image_units:=case requested_image_tier when 'ultra' then 6 when 'premium' then 2 else 1 end;
    image_used:=(document#>>'{usage,imageCreditsThisMonth}')::bigint; image_limit:=(document#>>'{limits,imageCreditsPerMonth}')::bigint;
    if image_used+image_units>image_limit then raise exception 'IMAGE_ALLOWANCE_EXHAUSTED' using errcode='P0002'; end if;
  end if;
  select coalesce(p.max_operations_24h,100),coalesce(p.max_concurrent,3) into policy_max_operations,policy_max_concurrent
    from (select 1) seed left join public.ai_usage_policies p on p.user_id=actor;
  select count(*) filter(where occurred_at>=now()-interval '24 hours'),count(*) filter(where status='reserved' and occurred_at>=now()-interval '10 minutes')
    into rolling_operations,concurrent_operations from public.ai_usage_events where user_id=actor;
  if rolling_operations>=policy_max_operations then raise exception 'SAFETY_LIMIT_REACHED' using errcode='P0001'; end if;
  if concurrent_operations>=policy_max_concurrent then raise exception 'CONCURRENCY_LIMIT_REACHED' using errcode='P0003'; end if;
  insert into public.ai_usage_events(user_id,project_id,operation_type,request_id,entitlement_units,image_credit_units)
    values(actor,requested_project_id,requested_operation_type,requested_request_id,requested_entitlement_units,image_units)
    returning id into reserved_id; return reserved_id;
end; $$;
revoke all on function public.reserve_ai_usage_operation(text,text,text,text,integer) from public,anon,service_role;
grant execute on function public.reserve_ai_usage_operation(text,text,text,text,integer) to authenticated;

create function public.reserve_asset_storage(requested_project_id text, requested_asset_id text, requested_bytes bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); document jsonb; used_bytes bigint; byte_limit bigint; used_assets bigint; asset_limit bigint; reservation_id uuid;
begin
  if auth.role() is distinct from 'authenticated' or actor is null then raise exception 'Authenticated user access required' using errcode='42501'; end if;
  if requested_bytes not between 1 and 23068672 or not exists(select 1 from public.projects p where p.id=requested_project_id and p.user_id=actor)
    then raise exception 'Invalid asset reservation' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('storage:'||actor::text,0));
  delete from public.asset_storage_reservations where created_at<now()-interval '15 minutes';
  document:=public.effective_entitlement_document(actor);
  if not (document->'capabilities' ? 'asset.upload') then raise exception 'CAPABILITY_NOT_ALLOWED' using errcode='P0002'; end if;
  used_bytes:=(document#>>'{usage,storageBytes}')::bigint + coalesce((select sum(reserved_bytes) from public.asset_storage_reservations where user_id=actor),0);
  byte_limit:=(document#>>'{limits,storageBytes}')::bigint; used_assets:=(document#>>'{usage,assetCount}')::bigint;
  asset_limit:=(document#>>'{limits,assetCount}')::bigint;
  if used_assets+(select count(*) from public.asset_storage_reservations where user_id=actor)>=asset_limit then raise exception 'ASSET_LIMIT_REACHED' using errcode='P0002'; end if;
  if requested_bytes>byte_limit-used_bytes then raise exception 'STORAGE_LIMIT_EXCEEDED' using errcode='P0002'; end if;
  insert into public.asset_storage_reservations(user_id,project_id,asset_id,reserved_bytes)
    values(actor,requested_project_id,requested_asset_id,requested_bytes) returning id into reservation_id; return reservation_id;
end; $$;
revoke all on function public.reserve_asset_storage(text,text,bigint) from public,anon,service_role;
grant execute on function public.reserve_asset_storage(text,text,bigint) to authenticated;

create function public.finalize_asset_storage(reservation_id uuid, requested_original_path text, requested_thumbnail_path text,
  requested_mime_type text, requested_byte_size bigint, requested_thumbnail_byte_size bigint, requested_metadata jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); reservation public.asset_storage_reservations;
begin
  select * into reservation from public.asset_storage_reservations r where r.id=reservation_id and r.user_id=actor for update;
  if reservation.id is null or reservation.reserved_bytes<>requested_byte_size+requested_thumbnail_byte_size then
    raise exception 'Invalid asset reservation' using errcode='22023'; end if;
  insert into public.creative_asset_objects(asset_id,user_id,project_id,original_path,thumbnail_path,mime_type,byte_size,
    thumbnail_byte_size,schema_version,metadata) values(reservation.asset_id,actor,reservation.project_id,requested_original_path,
    requested_thumbnail_path,requested_mime_type,requested_byte_size,requested_thumbnail_byte_size,1,requested_metadata);
  delete from public.asset_storage_reservations where id=reservation.id; return true;
end; $$;
revoke all on function public.finalize_asset_storage(uuid,text,text,text,bigint,bigint,jsonb) from public,anon,service_role;
grant execute on function public.finalize_asset_storage(uuid,text,text,text,bigint,bigint,jsonb) to authenticated;
create function public.release_asset_storage(reservation_id uuid) returns void language sql security definer set search_path='' as $$
  delete from public.asset_storage_reservations where id=reservation_id and user_id=auth.uid(); $$;
revoke all on function public.release_asset_storage(uuid) from public,anon,service_role;
grant execute on function public.release_asset_storage(uuid) to authenticated;

comment on table public.entitlement_profiles is 'Plan-neutral capability and limit definitions. Billing maps products to profile IDs only.';
comment on table public.asset_storage_reservations is 'Short-lived storage entitlement reservations preventing parallel upload limit bypass.';
