-- AINDEV NEXUS P0. Run as the Supabase migration owner.
-- Application clients receive SELECT only; all mutations use guarded RPCs.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(full_name) between 1 and 160),
  role text not null default 'student' check (role in ('student','supervisor','university','admin')),
  slug text not null unique,
  headline text not null default '', location text not null default '', university text not null default '',
  career text not null default '', bio text not null default '', interests text not null default '',
  semester integer check (semester between 1 and 30),
  is_public boolean not null default false, is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null check (length(name) between 2 and 160),
  type text not null check (type in ('company','university','nonprofit','government','aindev')),
  is_demo boolean not null default false, created_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id), user_id uuid not null references public.profiles(id),
  role text not null check (role in ('student','supervisor','university')),
  created_at timestamptz not null default now(), primary key (organization_id,user_id)
);
create table public.skills (
  id uuid primary key default gen_random_uuid(), name text not null check (length(name) between 2 and 100),
  category text not null check (category in ('technical','business','human')),
  created_at timestamptz not null default now()
);
create unique index skills_name_unique on public.skills(lower(name));
create table public.challenges (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  title text not null check (length(title) between 3 and 200), description text not null default '',
  problem text not null default '', expected_outcome text not null default '', modality text not null default 'hybrid',
  start_date date, end_date date, status text not null default 'open' check (status in ('open','closed')),
  created_by uuid not null references public.profiles(id), is_demo boolean not null default false,
  created_at timestamptz not null default now(), check (end_date is null or start_date is null or end_date >= start_date)
);
create table public.challenge_skills (
  challenge_id uuid references public.challenges(id), skill_id uuid references public.skills(id), primary key(challenge_id,skill_id)
);
create table public.challenge_participants (
  challenge_id uuid references public.challenges(id), student_id uuid references public.profiles(id),
  joined_at timestamptz not null default now(), primary key(challenge_id,student_id)
);
create table public.experiences (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id),
  organization_id uuid not null references public.organizations(id), challenge_id uuid references public.challenges(id),
  title text not null check (length(title) between 3 and 200), description text not null default '',
  responsibilities text not null default '', deliverables text not null default '', start_date date not null, end_date date not null,
  hours numeric(10,2) not null check (hours > 0 and hours <= 10000), verified_hours numeric(10,2) not null default 0,
  status text not null default 'declared' check (status in ('declared','pending_validation','changes_requested','rejected','verified','revoked')),
  is_demo boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (end_date >= start_date), check (verified_hours >= 0 and verified_hours <= hours),
  check (status in ('verified','revoked') or verified_hours = 0)
);
create table public.experience_skills (
  experience_id uuid references public.experiences(id), skill_id uuid references public.skills(id), primary key(experience_id,skill_id)
);
create table public.evidence (
  id uuid primary key default gen_random_uuid(), experience_id uuid not null references public.experiences(id),
  title text not null check (length(title) between 2 and 200), description text not null default '',
  url text not null check (length(url) <= 2048 and url ~ '^https://[^[:space:]@]+$'),
  kind text not null check (kind in ('url','repository','document','image','presentation','result')),
  is_public boolean not null default false, created_at timestamptz not null default now()
);
create table public.validation_requests (
  id uuid primary key default gen_random_uuid(), experience_id uuid not null references public.experiences(id),
  requested_by uuid not null references public.profiles(id), status text not null default 'pending' check(status in ('pending','completed')),
  created_at timestamptz not null default now(), completed_at timestamptz
);
create unique index validation_one_pending on public.validation_requests(experience_id) where status='pending';
create table public.validations (
  id uuid primary key default gen_random_uuid(), experience_id uuid not null references public.experiences(id),
  request_id uuid not null unique references public.validation_requests(id), reviewer_id uuid not null references public.profiles(id),
  decision text not null check (decision in ('approve','request_changes','reject')),
  comment text not null check(length(comment) between 1 and 4000), rating integer check(rating between 1 and 5),
  verified_hours numeric(10,2) not null default 0 check(verified_hours>=0), created_at timestamptz not null default now(),
  check(decision='approve' or verified_hours=0), check(decision<>'approve' or rating is not null)
);
create table public.credentials (
  id uuid primary key default gen_random_uuid(), experience_id uuid not null unique references public.experiences(id),
  student_id uuid not null references public.profiles(id), issuer_id uuid not null references public.profiles(id),
  validation_id uuid not null unique references public.validations(id), status text not null default 'active' check(status in ('active','revoked')),
  issued_at timestamptz not null default now(), revoked_at timestamptz, revocation_reason text,
  is_demo boolean not null default false, check((status='active' and revoked_at is null) or (status='revoked' and revoked_at is not null))
);
create table public.credential_skills (
  credential_id uuid references public.credentials(id), skill_id uuid references public.skills(id),
  level integer not null check(level between 1 and 5), primary key(credential_id,skill_id)
);
create table public.activity_events (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id), subject_id uuid references public.profiles(id),
  organization_id uuid references public.organizations(id), action text not null, entity_id uuid,
  details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index experience_student_idx on public.experiences(student_id);
create index experience_org_idx on public.experiences(organization_id);
create index member_user_idx on public.organization_members(user_id);
create index evidence_experience_idx on public.evidence(experience_id);
create index event_subject_idx on public.activity_events(subject_id);

create function public.nexus_handle_signup() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.profiles(id,full_name,slug)
  values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'Estudiante'),160),'nexus-'||replace(new.id::text,'-',''));
  return new;
end $$;
create trigger nexus_auth_signup after insert on auth.users for each row execute function public.nexus_handle_signup();

create function public.nexus_is_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin')
$$;
create function public.nexus_org_staff(p_org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.nexus_is_admin() or exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid() and role in ('supervisor','university'))
$$;
create function public.nexus_can_review(p_org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.nexus_is_admin() or exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid() and role='supervisor')
$$;
create function public.nexus_can_read_student(p_student uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select p_student=auth.uid() or public.nexus_is_admin()
    or exists(select 1 from public.experiences e where e.student_id=p_student and public.nexus_org_staff(e.organization_id))
    or exists(select 1 from public.organization_members m where m.user_id=p_student and public.nexus_org_staff(m.organization_id))
$$;
create function public.nexus_can_read_experience(p_exp uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.experiences where id=p_exp and (student_id=auth.uid() or public.nexus_org_staff(organization_id)))
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.skills enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_skills enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.experiences enable row level security;
alter table public.experience_skills enable row level security;
alter table public.evidence enable row level security;
alter table public.validation_requests enable row level security;
alter table public.validations enable row level security;
alter table public.credentials enable row level security;
alter table public.credential_skills enable row level security;
alter table public.activity_events enable row level security;
create policy profile_read on public.profiles for select to authenticated using(public.nexus_can_read_student(id));
-- The company/university directory and open challenges are deliberately discoverable to signed-in students.
create policy organization_read on public.organizations for select to authenticated using(true);
create policy member_read on public.organization_members for select to authenticated using(user_id=auth.uid() or public.nexus_org_staff(organization_id));
create policy skill_read on public.skills for select to authenticated using(true);
create policy challenge_read on public.challenges for select to authenticated using(status='open' or public.nexus_org_staff(organization_id));
create policy challenge_skill_read on public.challenge_skills for select to authenticated using(exists(select 1 from public.challenges c where c.id=challenge_id));
create policy participant_read on public.challenge_participants for select to authenticated using(student_id=auth.uid() or exists(select 1 from public.challenges c where c.id=challenge_id and public.nexus_org_staff(c.organization_id)));
create policy experience_read on public.experiences for select to authenticated using(student_id=auth.uid() or public.nexus_org_staff(organization_id));
create policy experience_skill_read on public.experience_skills for select to authenticated using(public.nexus_can_read_experience(experience_id));
create policy evidence_read on public.evidence for select to authenticated using(public.nexus_can_read_experience(experience_id));
create policy request_read on public.validation_requests for select to authenticated using(public.nexus_can_read_experience(experience_id));
create policy validation_read on public.validations for select to authenticated using(public.nexus_can_read_experience(experience_id));
create policy credential_read on public.credentials for select to authenticated using(public.nexus_can_read_experience(experience_id));
create policy credential_skill_read on public.credential_skills for select to authenticated using(exists(select 1 from public.credentials c where c.id=credential_id));
create policy event_read on public.activity_events for select to authenticated using(actor_id=auth.uid() or subject_id=auth.uid() or public.nexus_org_staff(organization_id));

create function public.nexus_snapshot() returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return jsonb_build_object(
    'profile',(select to_jsonb(p) from public.profiles p where id=auth.uid()),
    'profiles',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.profiles p),
    'organizations',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.organizations p),
    'organization_members',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.organization_members p),
    'skills',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.skills p),
    'challenges',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.challenges p),
    'challenge_skills',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.challenge_skills p),
    'challenge_participants',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.challenge_participants p),
    'experiences',(select coalesce(jsonb_agg(p order by created_at desc),'[]'::jsonb) from public.experiences p),
    'experience_skills',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.experience_skills p),
    'evidence',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.evidence p),
    'validation_requests',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.validation_requests p),
    'validations',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.validations p),
    'credentials',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.credentials p),
    'credential_skills',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.credential_skills p),
    'activity_events',(select coalesce(jsonb_agg(p order by created_at desc),'[]'::jsonb) from public.activity_events p)
  );
end $$;

create function public.nexus_action(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor uuid:=auth.uid(); actor_profile public.profiles; exp public.experiences; challenge public.challenges;
  cred public.credentials; result_id uuid; org_id uuid; request_id uuid; validation_id uuid; student uuid;
  skill_ids uuid[]; item uuid; decision text; new_status text; checked_hours numeric; checked_rating integer;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into actor_profile from public.profiles where id=actor;
  if not found then raise exception 'Profile required' using errcode='42501'; end if;
  if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>24000 then raise exception 'Invalid payload'; end if;
  if action='update_profile' then
    update public.profiles set full_name=trim(payload->>'full_name'),headline=left(coalesce(payload->>'headline',''),200),
      location=left(coalesce(payload->>'location',''),160), university=left(coalesce(payload->>'university',''),200),
      career=left(coalesce(payload->>'career',''),200),bio=left(coalesce(payload->>'bio',''),3000),
      interests=left(coalesce(payload->>'interests',''),1000),semester=nullif(payload->>'semester','')::integer,
      is_public=coalesce((payload->>'is_public')::boolean,false),updated_at=now() where id=actor;
    result_id:=actor;
  elsif action='join_challenge' then
    if actor_profile.role<>'student' then raise exception 'Student role required' using errcode='42501'; end if;
    select * into challenge from public.challenges where id=(payload->>'challenge_id')::uuid and status='open';
    if not found then raise exception 'Open challenge not found'; end if;
    insert into public.challenge_participants(challenge_id,student_id) values(challenge.id,actor) on conflict do nothing;
    result_id:=challenge.id; org_id:=challenge.organization_id; student:=actor;
  elsif action in ('create_experience','update_experience') then
    if actor_profile.role<>'student' then raise exception 'Student role required' using errcode='42501'; end if;
    if action='update_experience' then
      select * into exp from public.experiences where id=(payload->>'id')::uuid for update;
      if not found or exp.student_id<>actor or exp.status not in ('declared','changes_requested','rejected') then raise exception 'Experience is not editable' using errcode='42501'; end if;
    end if;
    org_id:=(payload->>'organization_id')::uuid;
    if nullif(payload->>'challenge_id','') is not null then
      select * into challenge from public.challenges where id=(payload->>'challenge_id')::uuid;
      if not found or challenge.organization_id<>org_id or not exists(select 1 from public.challenge_participants where challenge_id=challenge.id and student_id=actor) then raise exception 'Join this challenge first' using errcode='42501'; end if;
    elsif not exists(select 1 from public.organization_members where organization_id=org_id and user_id=actor) then
      raise exception 'Organization membership required' using errcode='42501';
    end if;
    select coalesce(array_agg(distinct x::uuid),'{}'::uuid[]) into skill_ids from jsonb_array_elements_text(coalesce(payload->'skill_ids','[]')) x;
    if cardinality(skill_ids)>30 then raise exception 'Maximum 30 skills'; end if;
    if exists(select 1 from unnest(skill_ids) s where not exists(select 1 from public.skills where id=s)) then raise exception 'Unknown skill'; end if;
    if action='create_experience' then
      insert into public.experiences(student_id,organization_id,challenge_id,title,description,responsibilities,deliverables,start_date,end_date,hours,is_demo)
      values(actor,org_id,nullif(payload->>'challenge_id','')::uuid,trim(payload->>'title'),coalesce(payload->>'description',''),
        coalesce(payload->>'responsibilities',''),coalesce(payload->>'deliverables',''),(payload->>'start_date')::date,(payload->>'end_date')::date,(payload->>'hours')::numeric,actor_profile.is_demo)
      returning id into result_id;
    else
      result_id:=exp.id;
      update public.experiences set organization_id=org_id,challenge_id=nullif(payload->>'challenge_id','')::uuid,title=trim(payload->>'title'),
        description=coalesce(payload->>'description',''),responsibilities=coalesce(payload->>'responsibilities',''),deliverables=coalesce(payload->>'deliverables',''),
        start_date=(payload->>'start_date')::date,end_date=(payload->>'end_date')::date,hours=(payload->>'hours')::numeric,status='declared',updated_at=now() where id=result_id;
      delete from public.experience_skills where experience_id=result_id;
    end if;
    insert into public.experience_skills(experience_id,skill_id) select result_id,unnest(skill_ids);
    student:=actor;
  elsif action='add_evidence' then
    select * into exp from public.experiences where id=(payload->>'experience_id')::uuid for update;
    if not found or exp.student_id<>actor or exp.status not in ('declared','changes_requested','rejected') then raise exception 'Evidence is immutable or inaccessible' using errcode='42501'; end if;
    insert into public.evidence(experience_id,title,description,url,kind,is_public)
      values(exp.id,trim(payload->>'title'),coalesce(payload->>'description',''),payload->>'url',payload->>'kind',coalesce((payload->>'is_public')::boolean,false)) returning id into result_id;
    student:=actor; org_id:=exp.organization_id;
  elsif action='request_validation' then
    select * into exp from public.experiences where id=(payload->>'experience_id')::uuid for update;
    if not found or exp.student_id<>actor or exp.status not in ('declared','changes_requested','rejected') then raise exception 'Experience cannot be submitted' using errcode='42501'; end if;
    if not exists(select 1 from public.evidence where experience_id=exp.id) or not exists(select 1 from public.experience_skills where experience_id=exp.id) then raise exception 'Evidence and skills are required'; end if;
    if not exists(select 1 from public.organization_members where organization_id=exp.organization_id and role='supervisor' and user_id<>actor) then raise exception 'An independent organization supervisor is required'; end if;
    insert into public.validation_requests(experience_id,requested_by) values(exp.id,actor) returning id into result_id;
    update public.experiences set status='pending_validation',updated_at=now() where id=exp.id;
    student:=actor; org_id:=exp.organization_id;
  elsif action='validate_experience' then
    select * into exp from public.experiences where id=(payload->>'experience_id')::uuid for update;
    if not found or exp.student_id=actor or not public.nexus_can_review(exp.organization_id) then raise exception 'Independent organization reviewer required' using errcode='42501'; end if;
    if exp.status<>'pending_validation' then raise exception 'Experience is not pending validation'; end if;
    select id into request_id from public.validation_requests where experience_id=exp.id and status='pending' for update;
    if request_id is null then raise exception 'Pending request required'; end if;
    decision:=payload->>'decision';
    if decision is null or decision not in ('approve','request_changes','reject') then raise exception 'Unknown decision'; end if;
    checked_hours:=case when decision='approve' then (payload->>'verified_hours')::numeric else 0 end;
    checked_rating:=nullif(payload->>'rating','')::integer;
    if decision='approve' and (checked_hours is null or checked_hours<0 or checked_hours>exp.hours or checked_rating is null or checked_rating not between 1 and 5) then raise exception 'Approval requires rating 1-5 and hours within declared hours'; end if;
    insert into public.validations(experience_id,request_id,reviewer_id,decision,comment,rating,verified_hours)
      values(exp.id,request_id,actor,decision,trim(payload->>'comment'),checked_rating,checked_hours) returning id into validation_id;
    update public.validation_requests set status='completed',completed_at=now() where id=request_id;
    new_status:=case decision when 'approve' then 'verified' when 'request_changes' then 'changes_requested' else 'rejected' end;
    update public.experiences set status=new_status,verified_hours=checked_hours,updated_at=now() where id=exp.id;
    if decision='approve' then
      insert into public.credentials(experience_id,student_id,issuer_id,validation_id,is_demo)
        values(exp.id,exp.student_id,actor,validation_id,exp.is_demo) returning id into result_id;
      insert into public.credential_skills(credential_id,skill_id,level) select result_id,skill_id,checked_rating from public.experience_skills where experience_id=exp.id;
    else result_id:=validation_id; end if;
    student:=exp.student_id;org_id:=exp.organization_id;
  elsif action='revoke_credential' then
    if not public.nexus_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
    if length(trim(coalesce(payload->>'reason','')))<3 then raise exception 'A revocation reason is required'; end if;
    select * into cred from public.credentials where id=(payload->>'credential_id')::uuid for update;
    if not found or cred.status<>'active' then raise exception 'Active credential not found'; end if;
    update public.credentials set status='revoked',revoked_at=now(),revocation_reason=left(trim(payload->>'reason'),1000) where id=cred.id;
    update public.experiences set status='revoked',updated_at=now() where id=cred.experience_id returning organization_id into org_id;
    result_id:=cred.id; student:=cred.student_id;
  elsif action='create_organization' then
    if not public.nexus_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
    insert into public.organizations(name,type,is_demo) values(trim(payload->>'name'),payload->>'type',actor_profile.is_demo) returning id into result_id;
    org_id:=result_id;
  elsif action='create_skill' then
    if not public.nexus_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
    insert into public.skills(name,category) values(trim(payload->>'name'),payload->>'category') returning id into result_id;
  elsif action='create_challenge' then
    if not public.nexus_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
    org_id:=(payload->>'organization_id')::uuid;
    insert into public.challenges(organization_id,title,description,problem,expected_outcome,modality,start_date,end_date,created_by,is_demo)
      values(org_id,trim(payload->>'title'),coalesce(payload->>'description',''),coalesce(payload->>'problem',''),coalesce(payload->>'expected_outcome',''),
      coalesce(payload->>'modality','hybrid'),nullif(payload->>'start_date','')::date,nullif(payload->>'end_date','')::date,actor,actor_profile.is_demo) returning id into result_id;
    insert into public.challenge_skills(challenge_id,skill_id) select distinct result_id,x::uuid from jsonb_array_elements_text(coalesce(payload->'skill_ids','[]')) x;
  elsif action='set_member' then
    if not public.nexus_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
    org_id:=(payload->>'organization_id')::uuid; student:=(payload->>'user_id')::uuid;
    insert into public.organization_members(organization_id,user_id,role) values(org_id,student,payload->>'role')
      on conflict(organization_id,user_id) do update set role=excluded.role;
    update public.profiles set role=payload->>'role',updated_at=now() where id=student and role<>'admin';
    result_id:=student;
  else raise exception 'Unknown action';
  end if;
  insert into public.activity_events(actor_id,subject_id,organization_id,action,entity_id,details)
    values(actor,coalesce(student,actor),org_id,action,result_id,
      case when action='validate_experience' then jsonb_build_object('decision',decision,'experience_id',exp.id) else '{}'::jsonb end);
  return jsonb_build_object('id',result_id);
end $$;

-- No anonymous SELECT policy. Public functions return only explicitly opted-in fields.
create function public.nexus_public_skillpass(p_slug text) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare owner_id uuid; result jsonb;
begin
  select id into owner_id from public.profiles where slug=p_slug and is_public=true;
  if owner_id is null then return null; end if;
  with approved as (
    select e.* from public.experiences e join public.credentials c on c.experience_id=e.id
    where e.student_id=owner_id and e.status in ('verified','revoked')
  ), public_profile as (
    select id,full_name,slug,headline,location,university,career,bio,interests,is_public,is_demo from public.profiles where id=owner_id
  )
  select jsonb_build_object(
    'profile',(select to_jsonb(p) from public_profile p),
    'profiles',(select jsonb_agg(p) from public_profile p),
    'organizations',(select coalesce(jsonb_agg(p),'[]') from (select o.id,o.name,o.type,o.is_demo from public.organizations o where o.id in(select organization_id from approved)) p),
    'organization_members','[]'::jsonb,
    'skills',(select coalesce(jsonb_agg(p),'[]') from public.skills p where id in(select cs.skill_id from public.credential_skills cs join public.credentials c on c.id=cs.credential_id where c.student_id=owner_id)),
    'challenges','[]'::jsonb,'challenge_skills','[]'::jsonb,'challenge_participants','[]'::jsonb,
    'experiences',(select coalesce(jsonb_agg(p),'[]') from (select id,student_id,organization_id,challenge_id,title,description,start_date,end_date,hours,verified_hours,status,is_demo from approved) p),
    'experience_skills',(select coalesce(jsonb_agg(p),'[]') from public.experience_skills p where experience_id in(select id from approved)),
    'evidence',(select coalesce(jsonb_agg(p),'[]') from public.evidence p where experience_id in(select id from approved) and is_public=true),
    'validation_requests','[]'::jsonb,
    'validations',(select coalesce(jsonb_agg(p),'[]') from (select v.id,v.experience_id,v.reviewer_id,r.full_name as reviewer_name,e.organization_id,v.decision,v.rating,v.verified_hours,v.created_at from public.validations v join approved e on e.id=v.experience_id join public.profiles r on r.id=v.reviewer_id where v.decision='approve') p),
    'credentials',(select coalesce(jsonb_agg(p),'[]') from (select id,experience_id,student_id,status,issued_at,revoked_at,is_demo from public.credentials where student_id=owner_id) p),
    'credential_skills',(select coalesce(jsonb_agg(p),'[]') from public.credential_skills p where credential_id in(select id from public.credentials where student_id=owner_id)),
    'activity_events','[]'::jsonb,
    'vath',(select coalesce(sum(e.verified_hours),0) from approved e join public.credentials c on c.experience_id=e.id where e.status='verified' and c.status='active')
  ) into result;
  return result;
end $$;
create function public.nexus_public_credential(p_id uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare pass jsonb; student_slug text; credential_record jsonb;
begin
  select p.slug,jsonb_build_object('id',c.id,'experience_id',c.experience_id,'student_id',c.student_id,'status',c.status,'issued_at',c.issued_at,'revoked_at',c.revoked_at,'is_demo',c.is_demo)
    into student_slug,credential_record from public.credentials c join public.profiles p on p.id=c.student_id where c.id=p_id and p.is_public=true;
  if student_slug is null then return null; end if;
  pass:=public.nexus_public_skillpass(student_slug);
  return pass||jsonb_build_object('credential',credential_record);
end $$;

revoke all on public.profiles,public.organizations,public.organization_members,public.skills,public.challenges,public.challenge_skills,public.challenge_participants,public.experiences,public.experience_skills,public.evidence,public.validation_requests,public.validations,public.credentials,public.credential_skills,public.activity_events from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.profiles,public.organizations,public.organization_members,public.skills,public.challenges,public.challenge_skills,public.challenge_participants,public.experiences,public.experience_skills,public.evidence,public.validation_requests,public.validations,public.credentials,public.credential_skills,public.activity_events to authenticated;
revoke all on function public.nexus_handle_signup() from public;
revoke all on function public.nexus_is_admin(),public.nexus_org_staff(uuid),public.nexus_can_review(uuid),public.nexus_can_read_student(uuid),public.nexus_can_read_experience(uuid),public.nexus_snapshot(),public.nexus_action(text,jsonb) from public;
grant execute on function public.nexus_is_admin(),public.nexus_org_staff(uuid),public.nexus_can_review(uuid),public.nexus_can_read_student(uuid),public.nexus_can_read_experience(uuid),public.nexus_snapshot(),public.nexus_action(text,jsonb) to authenticated;
revoke all on function public.nexus_public_skillpass(text),public.nexus_public_credential(uuid) from public;
grant execute on function public.nexus_public_skillpass(text),public.nexus_public_credential(uuid) to anon,authenticated;
