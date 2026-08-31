insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creative-assets', 'creative-assets', false, 20971520,
  array['image/png','image/webp','image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.creative_asset_objects (
  asset_id text primary key check (asset_id ~ '^[a-zA-Z0-9_-]{1,200}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  original_path text not null unique,
  thumbnail_path text unique,
  mime_type text not null check (mime_type in ('image/png','image/webp','image/jpeg')),
  byte_size bigint not null check (byte_size between 1 and 20971520),
  thumbnail_byte_size bigint not null default 0 check (thumbnail_byte_size between 0 and 2097152),
  schema_version smallint not null default 1 check (schema_version between 1 and 32),
  metadata jsonb not null check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id, asset_id),
  foreign key (user_id, project_id) references public.projects(user_id, id) on delete cascade
);
create index creative_asset_objects_user_project_created_idx
  on public.creative_asset_objects(user_id, project_id, created_at desc);
alter table public.creative_asset_objects enable row level security;
create policy creative_asset_objects_select_own on public.creative_asset_objects
  for select to authenticated using (user_id = (select auth.uid()));
create policy creative_asset_objects_insert_owned_project on public.creative_asset_objects
  for insert to authenticated with check (user_id = (select auth.uid()) and exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())
  ));
create policy creative_asset_objects_delete_own on public.creative_asset_objects
  for delete to authenticated using (user_id = (select auth.uid()));
create policy creative_asset_objects_update_own on public.creative_asset_objects
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())
  ));
revoke all on public.creative_asset_objects from anon, authenticated;
grant select, insert, update, delete on public.creative_asset_objects to authenticated;

create policy creative_assets_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'creative-assets' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.projects p
      where p.id = (storage.foldername(name))[2] and p.user_id = (select auth.uid())));
create policy creative_assets_select_own on storage.objects for select to authenticated
  using (bucket_id = 'creative-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy creative_assets_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'creative-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter table public.ai_usage_events add column project_id text;
alter table public.ai_usage_events add constraint ai_usage_events_owned_project_fk
  foreign key (user_id, project_id) references public.projects(user_id, id) on delete set null (project_id);
create index ai_usage_events_project_occurred_idx on public.ai_usage_events(project_id, occurred_at desc)
  where project_id is not null;

revoke all on function public.reserve_ai_usage_operation(text,text) from public, anon, authenticated, service_role;
drop function public.reserve_ai_usage_operation(text,text);
create function public.reserve_ai_usage_operation(
  requested_operation_type text, requested_request_id text, requested_project_id text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); reserved_id uuid; rolling_operations bigint; concurrent_operations bigint;
  policy_max_operations integer; policy_max_concurrent integer;
begin
  if auth.role() is distinct from 'authenticated' or actor is null then
    raise exception 'Authenticated user access required' using errcode = '42501'; end if;
  if requested_operation_type not in ('chat','creative_copy','creative_image','transcription','speech')
    or requested_request_id is null or char_length(requested_request_id) not between 1 and 200 then
    raise exception 'Invalid AI usage reservation' using errcode = '22023'; end if;
  if requested_project_id is not null and not exists (
    select 1 from public.projects p where p.id = requested_project_id and p.user_id = actor
  ) then raise exception 'Project scope not found' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  select coalesce(p.max_operations_24h,100), coalesce(p.max_concurrent,3)
    into policy_max_operations, policy_max_concurrent from (select 1) seed
    left join public.ai_usage_policies p on p.user_id = actor;
  select count(*) filter(where occurred_at >= now()-interval '24 hours'),
    count(*) filter(where status='reserved' and occurred_at >= now()-interval '10 minutes')
    into rolling_operations, concurrent_operations from public.ai_usage_events where user_id = actor;
  if rolling_operations >= policy_max_operations or concurrent_operations >= policy_max_concurrent then
    raise exception 'AI usage safety limit reached' using errcode = 'P0001'; end if;
  insert into public.ai_usage_events(user_id, project_id, operation_type, request_id)
    values(actor, requested_project_id, requested_operation_type, requested_request_id)
    returning id into reserved_id;
  return reserved_id;
end; $$;
revoke all on function public.reserve_ai_usage_operation(text,text,text) from public, anon, service_role;
grant execute on function public.reserve_ai_usage_operation(text,text,text) to authenticated;

comment on table public.creative_asset_objects is
  'Private cloud object inventory and plan-neutral byte accounting. Binary content remains in private Storage.';
