create table public.beta_cohorts (
  id text primary key check(id~'^[a-z0-9_]{1,80}$'), name text not null check(char_length(name) between 1 and 120),
  starts_at timestamptz, ends_at timestamptz, status text not null check(status in('draft','ready','active','closed')),
  created_at timestamptz not null default now(), check(ends_at is null or starts_at is null or ends_at>starts_at)
);
insert into public.beta_cohorts(id,name,status) values('beta_2','Measured Beta 2','draft');
alter table public.beta_invites add column cohort_id text references public.beta_cohorts(id) on delete set null;
create index beta_invites_cohort_created_idx on public.beta_invites(cohort_id,created_at desc) where cohort_id is not null;
create table public.beta_cohort_participants (
  cohort_id text not null references public.beta_cohorts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_at timestamptz not null default now(), joined_at timestamptz,
  qualification jsonb not null default '{}' check(jsonb_typeof(qualification)='object' and octet_length(qualification::text)<=4096),
  manual_status text check(manual_status is null or manual_status in('INACTIVE')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(cohort_id,user_id)
);
create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(), cohort_id text not null references public.beta_cohorts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, project_id text,
  kind text not null check(kind in('contextual','activation_check','artifact_check','exit_survey','support')),
  category text not null check(category in('bug','confusing','missing','valuable','other')),
  rating text check(rating is null or rating in('yes','partly','no')), feedback_text text check(feedback_text is null or char_length(feedback_text)<=4000),
  answers jsonb not null default '{}' check(jsonb_typeof(answers)='object' and octet_length(answers::text)<=8192),
  severity text check(severity is null or severity in('BLOCKER','MAJOR','MINOR','FEEDBACK')),
  resolved_at timestamptz, created_at timestamptz not null default now(),
  foreign key (user_id, project_id) references public.projects(user_id, id) on delete set null (project_id)
);
create table public.beta_founder_notes (
  id uuid primary key default gen_random_uuid(), cohort_id text not null references public.beta_cohorts(id) on delete cascade,
  participant_user_id uuid not null references auth.users(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  note text not null check(char_length(note) between 1 and 2000), created_at timestamptz not null default now()
);
create index beta_feedback_cohort_unresolved_idx on public.beta_feedback(cohort_id,created_at desc) where resolved_at is null;
alter table public.beta_cohorts enable row level security; alter table public.beta_cohort_participants enable row level security;
alter table public.beta_feedback enable row level security; alter table public.beta_founder_notes enable row level security;
revoke all on public.beta_cohorts,public.beta_cohort_participants,public.beta_feedback,public.beta_founder_notes from public,anon,authenticated;
grant select,insert,update,delete on public.beta_cohorts,public.beta_cohort_participants,public.beta_feedback,public.beta_founder_notes to service_role;

create function public.is_active_founder(actor uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.beta_memberships bm where bm.user_id=actor and bm.role='founder' and bm.status='active'); $$;
revoke all on function public.is_active_founder(uuid) from public,anon,authenticated; grant execute on function public.is_active_founder(uuid) to service_role;

create function public.assign_beta_cohort_participant(requested_user_id uuid,requested_cohort_id text,requested_qualification jsonb default '{}')
returns boolean language plpgsql security definer set search_path='' as $$ begin
 if not public.is_active_founder(auth.uid()) then raise exception 'Founder access required' using errcode='42501'; end if;
 if not exists(select 1 from auth.users where id=requested_user_id) or not exists(select 1 from public.beta_cohorts where id=requested_cohort_id and status in('draft','ready','active'))
 then raise exception 'Participant or cohort unavailable' using errcode='22023'; end if;
 insert into public.beta_cohort_participants(cohort_id,user_id,joined_at,qualification)
 values(requested_cohort_id,requested_user_id,(select created_at from auth.users where id=requested_user_id),requested_qualification)
 on conflict(cohort_id,user_id) do update set qualification=excluded.qualification,updated_at=now(); return true; end; $$;
revoke all on function public.assign_beta_cohort_participant(uuid,text,jsonb) from public,anon,service_role;
grant execute on function public.assign_beta_cohort_participant(uuid,text,jsonb) to authenticated;

create function public.join_claimed_invite_cohort() returns trigger language plpgsql security definer set search_path='' as $$
declare cohort text; begin select i.cohort_id into cohort from public.beta_invites i where i.id=new.invite_id;
 if cohort is not null then insert into public.beta_cohort_participants(cohort_id,user_id,invited_at,joined_at)
 values(cohort,new.user_id,new.claimed_at,new.claimed_at) on conflict(cohort_id,user_id) do update set joined_at=excluded.joined_at,updated_at=now(); end if; return new; end; $$;
create trigger beta_membership_join_cohort after insert on public.beta_memberships for each row execute function public.join_claimed_invite_cohort();

create function public.founder_beta2_invite_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare total_count bigint;claimed_count bigint;begin if not public.is_active_founder(auth.uid()) then raise exception 'Founder access required' using errcode='42501';end if;
 select count(*),count(*) filter(where claim_count>0) into total_count,claimed_count from public.beta_invites where cohort_id='beta_2';
 return jsonb_build_object('invited',total_count,'joined',claimed_count);end;$$;
revoke all on function public.founder_beta2_invite_summary() from public,anon,service_role;
grant execute on function public.founder_beta2_invite_summary() to authenticated;

create function public.submit_beta_feedback(requested_kind text,requested_category text,requested_project_id text,
 requested_rating text,requested_text text,requested_answers jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); cohort text; result uuid; begin
 select p.cohort_id into cohort from public.beta_cohort_participants p join public.beta_cohorts c on c.id=p.cohort_id
 where p.user_id=actor and c.status in('ready','active','draft') order by p.invited_at desc limit 1;
 if cohort is null then raise exception 'Beta cohort membership required' using errcode='42501'; end if;
 if requested_project_id is not null and not exists(select 1 from public.projects p where p.id=requested_project_id and p.user_id=actor)
 then raise exception 'Project scope not found' using errcode='22023'; end if;
 insert into public.beta_feedback(cohort_id,user_id,project_id,kind,category,rating,feedback_text,answers)
 values(cohort,actor,requested_project_id,requested_kind,requested_category,requested_rating,requested_text,requested_answers) returning id into result; return result; end; $$;
revoke all on function public.submit_beta_feedback(text,text,text,text,text,jsonb) from public,anon,service_role;
grant execute on function public.submit_beta_feedback(text,text,text,text,text,jsonb) to authenticated;

create function public.founder_beta2_participants(requested_cohort_id text default 'beta_2') returns table(
 user_id uuid,email text,invited_at timestamptz,joined_at timestamptz,first_intent_at timestamptz,project_created_at timestamptz,
 first_result_at timestamptz,activated_at timestamptz,meaningful_session_dates text[],last_meaningful_at timestamptz,
 completed_at timestamptz,milestones text[],ai_cost_usd numeric,unpriced_operations bigint,failed_operations bigint,
 entitlement_denials bigint,unresolved_feedback bigint) language plpgsql security definer set search_path='' as $$ begin
 if not public.is_active_founder(auth.uid()) then raise exception 'Founder access required' using errcode='42501'; end if;
 return query with events as(select e.user_id,
  min(e.created_at) filter(where e.event_type='first_intent_submitted') first_intent,
  min(e.created_at) filter(where e.event_type='project_created') project_created,
  min(e.created_at) filter(where e.event_type='project_scoped_result') first_result,
  min(e.created_at) filter(where e.event_type='activated') activated,
  min(e.created_at) filter(where e.event_type='launch_foundation_completed') completed,
  max(e.created_at) filter(where e.event_type='meaningful_session') last_meaningful,
  array_agg(distinct e.created_at::date::text) filter(where e.event_type='meaningful_session') session_dates,
  array_agg(distinct e.metadata->>'milestone') filter(where e.event_type='launch_foundation_progress') milestone_values
  from public.beta_usage_events e group by e.user_id), costs as(select a.user_id,coalesce(sum(a.estimated_cost_usd),0) cost,
  count(*) filter(where not a.provider_usage_available) unpriced,count(*) filter(where a.status='failed') failed from public.ai_usage_events a group by a.user_id),
 feedback as(select f.user_id,count(*) filter(where f.resolved_at is null) unresolved from public.beta_feedback f where f.cohort_id=requested_cohort_id group by f.user_id)
 select p.user_id,u.email::text,p.invited_at,p.joined_at,e.first_intent,e.project_created,e.first_result,e.activated,
  coalesce(e.session_dates,'{}'),e.last_meaningful,e.completed,coalesce(e.milestone_values,'{}'),coalesce(c.cost,0),
  coalesce(c.unpriced,0),coalesce(c.failed,0),null::bigint,coalesce(f.unresolved,0)
 from public.beta_cohort_participants p join auth.users u on u.id=p.user_id left join events e on e.user_id=p.user_id
 left join costs c on c.user_id=p.user_id left join feedback f on f.user_id=p.user_id where p.cohort_id=requested_cohort_id;
end; $$;
revoke all on function public.founder_beta2_participants(text) from public,anon,service_role;
grant execute on function public.founder_beta2_participants(text) to authenticated;

create function public.founder_triage_beta_feedback(requested_feedback_id uuid,requested_severity text,mark_resolved boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$ begin
 if not public.is_active_founder(auth.uid()) then raise exception 'Founder access required' using errcode='42501'; end if;
 if requested_severity not in('BLOCKER','MAJOR','MINOR','FEEDBACK') then raise exception 'Invalid severity' using errcode='22023'; end if;
 update public.beta_feedback set severity=requested_severity,resolved_at=case when mark_resolved then now() else null end
 where id=requested_feedback_id and cohort_id='beta_2'; return found; end; $$;
revoke all on function public.founder_triage_beta_feedback(uuid,text,boolean) from public,anon,service_role;
grant execute on function public.founder_triage_beta_feedback(uuid,text,boolean) to authenticated;

create function public.add_beta_founder_note(requested_user_id uuid,requested_note text) returns uuid
language plpgsql security definer set search_path='' as $$ declare result uuid; begin
 if not public.is_active_founder(auth.uid()) then raise exception 'Founder access required' using errcode='42501'; end if;
 if not exists(select 1 from public.beta_cohort_participants where cohort_id='beta_2' and user_id=requested_user_id)
 then raise exception 'Participant unavailable' using errcode='22023'; end if;
 insert into public.beta_founder_notes(cohort_id,participant_user_id,author_user_id,note)
 values('beta_2',requested_user_id,auth.uid(),left(trim(requested_note),2000)) returning id into result; return result; end; $$;
revoke all on function public.add_beta_founder_note(uuid,text) from public,anon,service_role;
grant execute on function public.add_beta_founder_note(uuid,text) to authenticated;

create function public.founder_beta2_feedback() returns table(id uuid,participant_user_id uuid,kind text,category text,
 rating text,severity text,feedback_text text,answers jsonb,created_at timestamptz,resolved_at timestamptz)
language plpgsql security definer set search_path='' as $$ begin
 if not public.is_active_founder(auth.uid()) then raise exception 'Founder access required' using errcode='42501'; end if;
 return query select f.id,f.user_id,f.kind,f.category,f.rating,f.severity,f.feedback_text,f.answers,f.created_at,f.resolved_at
 from public.beta_feedback f where f.cohort_id='beta_2' order by f.resolved_at nulls first,f.created_at desc limit 200; end; $$;
revoke all on function public.founder_beta2_feedback() from public,anon,service_role;
grant execute on function public.founder_beta2_feedback() to authenticated;

comment on table public.beta_feedback is 'Intentional participant feedback text, separated from content-free product analytics.';
comment on table public.beta_cohorts is 'Operational research cohorts; never an entitlement or authentication authority.';
