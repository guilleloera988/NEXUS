-- SkillPass — verified university membership (pilot readiness, docs/STATUS.md).
--
-- A student is linked to a university (profiles.university_id) only once the link is verified:
--   * at once, when the student's confirmed sign-in e-mail belongs to one of the university's student
--     e-mail domains (organizations.student_email_domains, set by the university's managers or AINDEV);
--   * or when the university's staff (or AINDEV) approve the request.
-- Until then the choice is only a request (university_requests, readable by the student alone): the student
-- does not count in the university's analytics, the university is not shown on the student's public pages,
-- and its staff cannot read the student's data. A rejection or removal is remembered (university_refusals):
-- choosing the university again, even with an institutional e-mail, does not reopen it; only the university
-- (or AINDEV) can approve the student later. Everything that already reads profiles.university_id keeps
-- working and now means "verified university".

alter table public.organizations add column student_email_domains text[] not null default '{}'
  constraint organizations_student_email_domains_chk check (cardinality(student_email_domains) <= 10);

alter table public.profiles
  add column university_verified_via text check (university_verified_via in ('email_domain','university','admin','seed')),
  add column university_verified_at timestamptz;

-- The student's pending (or refused) choice. One row per student.
create table public.university_requests (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  university_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','rejected','removed')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);
create index university_requests_university_idx on public.university_requests(university_id, status);
alter table public.university_requests enable row level security;
revoke all on public.university_requests from public, anon, authenticated;
grant select on public.university_requests to authenticated;
create policy university_requests_select on public.university_requests for select to authenticated
  using (student_id = (select auth.uid()));

-- Universities that rejected or removed a student. Internal: no API access.
create table public.university_refusals (
  student_id uuid not null references public.profiles(id) on delete cascade,
  university_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('rejected','removed')),
  created_at timestamptz not null default now(),
  primary key (student_id, university_id)
);
create index university_refusals_university_idx on public.university_refusals(university_id);
alter table public.university_refusals enable row level security;
revoke all on public.university_refusals from public, anon, authenticated;

-- Existing links were self-declared. Demo students stay linked; any other student keeps the choice as a
-- pending request that the university reviews; no other profile keeps a university.
update public.profiles set university_verified_via = 'seed', university_verified_at = created_at
  where university_id is not null and is_demo and role = 'student';
insert into public.university_requests(student_id, university_id, status, requested_at)
  select id, university_id, 'pending', now() from public.profiles
  where university_id is not null and university_verified_via is null and role = 'student';
update public.profiles set university_id = null where university_id is not null and university_verified_via is null;

-- A student e-mail domain a university may claim: a host name that is neither a public mail provider, nor a
-- parent of one (com.mx covers hotmail.com.mx), nor a shared public suffix (edu.mx would cover every school).
create function public.sp_student_email_domain_allowed(p_domain text) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select coalesce(char_length(p_domain) <= 253
    and p_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
    and p_domain <> all (array[
      'com.mx','net.mx','org.mx','edu.mx','gob.mx','ac.mx','com','net','org','edu','gov','co','io','info','biz',
      'com.ar','edu.ar','com.br','edu.br','com.co','edu.co','com.pe','edu.pe','com.ec','edu.ec','com.gt','edu.gt',
      'cl','es','edu.es','com.es','co.uk','ac.uk','org.uk','com.au','edu.au','co.jp','ac.jp','co.in','ac.in'])
    and not exists(
      select 1 from unnest(array['gmail.com','googlemail.com','hotmail.com','hotmail.es','hotmail.com.mx','outlook.com',
        'outlook.es','outlook.com.mx','live.com','live.com.mx','msn.com','yahoo.com','yahoo.com.mx','yahoo.es','ymail.com',
        'icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','gmx.com','gmx.net','zoho.com',
        'yandex.com','mail.com','prodigy.net.mx']) provider
      where provider = p_domain or provider like '%.' || p_domain), false)
$$;

-- True when the user's confirmed sign-in e-mail is on one of a verified university's student domains
-- (the domain itself or a subdomain of it).
create function public.sp_university_email_match(p_user uuid, p_university uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(
    select 1
    from auth.users u
    join public.organizations o on o.id = p_university and o.kind = 'university' and o.verification_status = 'verified'
    cross join lateral unnest(o.student_email_domains) d(domain)
    cross join lateral (select lower(substring(u.email from '@([^@]+)$')) as host) e
    where u.id = p_user and u.email_confirmed_at is not null
      and (e.host = d.domain or e.host like '%.' || d.domain))
$$;

-- Links a student to a university and clears their request.
create function public.sp_link_university(p_user uuid, p_university uuid, p_via text) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.profiles set university_id = p_university, university_verified_via = p_via, university_verified_at = now() where id = p_user;
  delete from public.university_requests where student_id = p_user;
  delete from public.university_refusals where student_id = p_user and university_id = p_university;
$$;

-- The student's university choice, called from sp_apply_student_profile (onboarding and profile saves).
create function public.sp_choose_university(p_user uuid, p_university uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare cur public.profiles; req public.university_requests; v_refusal text; v_name text; v_recent boolean;
begin
  select * into cur from public.profiles where id = p_user for update;
  select * into req from public.university_requests where student_id = p_user for update;
  if p_university is not distinct from cur.university_id and p_university is not null then
    delete from public.university_requests where student_id = p_user; -- a request elsewhere is withdrawn
    return;
  end if;
  if p_university is not distinct from req.university_id and p_university is not null then
    return; -- the same request stays as it is: pending, rejected or removed
  end if;
  -- Leaving the current university, or the current request.
  if cur.university_id is not null then
    update public.profiles set university_id = null, university_verified_via = null, university_verified_at = null where id = p_user;
    perform public.sp_audit('university_membership_left', 'profile', p_user, cur.university_id, null, p_user);
  end if;
  delete from public.university_requests where student_id = p_user;
  if p_university is null then return; end if;

  select kind into v_refusal from public.university_refusals where student_id = p_user and university_id = p_university;
  if v_refusal is not null then
    insert into public.university_requests(student_id, university_id, status, decided_at) values (p_user, p_university, v_refusal, now());
  elsif public.sp_university_email_match(p_user, p_university) then
    perform public.sp_link_university(p_user, p_university, 'email_domain');
    perform public.sp_audit('university_membership_verified', 'profile', p_user, p_university, null, p_user,
      '{}'::jsonb, jsonb_build_object('via', 'email_domain'));
  else
    insert into public.university_requests(student_id, university_id) values (p_user, p_university);
    -- Staff hear about a student at most once a day, however often the choice changes.
    v_recent := exists(select 1 from public.audit_logs where action = 'university_membership_requested' and subject_id = p_user
      and organization_id = p_university and created_at > now() - interval '1 day');
    perform public.sp_audit('university_membership_requested', 'profile', p_user, p_university, null, p_user);
    if not v_recent then
      v_name := cur.full_name;
      perform public.sp_notify(m.user_id, 'university_request', jsonb_build_object('student', v_name), '/dashboard')
        from public.organization_members m where m.organization_id = p_university;
    end if;
  end if;
end $$;

create or replace function public.sp_apply_student_profile(p_user uuid, p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uni uuid := public.sp_uuid(p, 'university_id', false); v_skills uuid[] := public.sp_uuid_array(p, 'skill_ids', 20);
begin
  -- A verified university, or the one the student already has or asked for (it may be under re-verification).
  if v_uni is not null and not exists(select 1 from public.organizations where id = v_uni and kind = 'university' and verification_status = 'verified')
     and v_uni is distinct from (select university_id from public.profiles where id = p_user)
     and v_uni is distinct from (select university_id from public.university_requests where student_id = p_user) then
    perform public.sp_raise('invalid_field', 'university_id');
  end if;
  if exists(select 1 from unnest(v_skills) s where not exists(select 1 from public.competencies k where k.id = s and k.is_active)) then
    perform public.sp_raise('invalid_field', 'skill_ids');
  end if;
  update public.profiles set
    full_name = public.sp_text(p, 'full_name', 1, 160),
    headline = public.sp_text(p, 'headline', 0, 160),
    bio = public.sp_text(p, 'bio', 0, 1200),
    location = public.sp_text(p, 'location', 0, 120),
    career = public.sp_text(p, 'career', 0, 160),
    semester = public.sp_int(p, 'semester', 1, 20, false),
    interests = public.sp_text_array(p, 'interests', 12, 40),
    availability = public.sp_choice(p, 'availability', array['full_time','part_time','weekends','flexible','not_available'], 'part_time'),
    hours_per_week = public.sp_int(p, 'hours_per_week', 1, 60, false)
  where id = p_user;
  perform public.sp_choose_university(p_user, v_uni);
  delete from public.declared_skills where student_id = p_user and not (competency_id = any(v_skills));
  insert into public.declared_skills(student_id, competency_id) select p_user, s from unnest(v_skills) s on conflict do nothing;
end $$;

-- The caller's university link and request, for the profile form.
create function public.sp_my_university(p jsonb default '{}'::jsonb) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'university', (select jsonb_build_object('id', o.id, 'name', o.name, 'verified_via', pr.university_verified_via)
                   from public.profiles pr join public.organizations o on o.id = pr.university_id where pr.id = auth.uid()),
    'request', (select jsonb_build_object('university_id', o.id, 'name', o.name, 'status', r.status, 'requested_at', r.requested_at)
                from public.university_requests r join public.organizations o on o.id = r.university_id where r.student_id = auth.uid()))
$$;

-- The university whose membership the caller manages: their own university (any member), or, for
-- AINDEV, the one named in organization_id. Returns null when the caller has none.
create function public.sp_membership_university(p jsonb) returns public.organizations
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare o public.organizations; v_org uuid := public.sp_uuid(p, 'organization_id', false);
begin
  if v_org is not null then
    select * into o from public.organizations where id = v_org and kind = 'university';
    if o.id is null or not (public.sp_is_admin() or public.sp_is_org_member(o.id)) then return null; end if;
  else
    select org.* into o from public.organization_members m join public.organizations org on org.id = m.organization_id
      where m.user_id = auth.uid() and org.kind = 'university' order by org.created_at limit 1;
  end if;
  return o;
end $$;

-- Pending requests for the caller's university, and the latest refusals (staff can still approve them),
-- with what staff need to recognize each student.
create function public.sp_university_requests(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare o public.organizations := public.sp_membership_university(p);
begin
  if o.id is null then return jsonb_build_object('organization', null, 'requests', '[]'::jsonb, 'refused', '[]'::jsonb); end if;
  return jsonb_build_object(
    'organization', jsonb_build_object('id', o.id, 'name', o.name, 'verification_status', o.verification_status,
      'student_email_domains', to_jsonb(o.student_email_domains), 'can_manage', public.sp_is_org_manager(o.id)),
    'requests', coalesce((select jsonb_agg(jsonb_build_object(
        'student_id', pr.id, 'full_name', pr.full_name, 'email', lower(u.email), 'email_confirmed', u.email_confirmed_at is not null,
        'career', pr.career, 'semester', pr.semester, 'requested_at', r.requested_at, 'is_demo', pr.is_demo)
        order by r.requested_at, pr.full_name)
      from public.university_requests r join public.profiles pr on pr.id = r.student_id left join auth.users u on u.id = pr.id
      where o.verification_status = 'verified' and r.university_id = o.id and r.status = 'pending' and pr.role = 'student'), '[]'::jsonb),
    'refused', coalesce((select jsonb_agg(x.j order by x.at desc) from (
        select jsonb_build_object('student_id', pr.id, 'full_name', pr.full_name, 'email', lower(u.email), 'kind', f.kind,
          'decided_at', f.created_at) as j, f.created_at as at
        from public.university_refusals f join public.profiles pr on pr.id = f.student_id left join auth.users u on u.id = pr.id
        join public.university_requests r on r.student_id = f.student_id and r.university_id = f.university_id
        where o.verification_status = 'verified' and f.university_id = o.id and pr.role = 'student'
        order by f.created_at desc limit 50) x), '[]'::jsonb));
end $$;

-- University staff (any member of the verified university) or AINDEV decide on a student's membership:
-- approve a request (or a refused student who still chooses the university), reject a pending request, or
-- remove a verified student.
create function public.sp_decide_university_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); o public.organizations; s public.profiles; r public.university_requests;
  v_decision text := public.sp_choice(p, 'decision', array['approve','reject','remove']);
  v_student uuid := public.sp_uuid(p, 'student_id');
begin
  o := public.sp_membership_university(jsonb_build_object('organization_id', public.sp_uuid(p, 'organization_id')));
  if o.id is null then perform public.sp_forbidden(); end if;
  if o.verification_status <> 'verified' then perform public.sp_raise('university_not_verified'); end if;
  select * into s from public.profiles where id = v_student and role = 'student' for update;
  if s.id is null then perform public.sp_raise('not_found'); end if;
  select * into r from public.university_requests where student_id = s.id for update;
  if v_decision = 'approve' then
    if r.university_id is distinct from o.id then perform public.sp_raise('membership_request_closed'); end if;
    perform public.sp_link_university(s.id, o.id, case when public.sp_is_org_member(o.id) then 'university' else 'admin' end);
    perform public.sp_notify(s.id, 'university_membership_approved', jsonb_build_object('university', o.name), '/profile');
  elsif v_decision = 'reject' then
    if r.university_id is distinct from o.id or r.status <> 'pending' then perform public.sp_raise('membership_request_closed'); end if;
    update public.university_requests set status = 'rejected', decided_at = now() where student_id = s.id;
    insert into public.university_refusals(student_id, university_id, kind) values (s.id, o.id, 'rejected')
      on conflict (student_id, university_id) do update set kind = 'rejected', created_at = now();
    perform public.sp_notify(s.id, 'university_membership_rejected', jsonb_build_object('university', o.name), '/profile');
  else
    if s.university_id is distinct from o.id then perform public.sp_raise('membership_request_closed'); end if;
    update public.profiles set university_id = null, university_verified_via = null, university_verified_at = null where id = s.id;
    insert into public.university_requests(student_id, university_id, status, decided_at) values (s.id, o.id, 'removed', now())
      on conflict (student_id) do update set university_id = excluded.university_id, status = 'removed', decided_at = now();
    insert into public.university_refusals(student_id, university_id, kind) values (s.id, o.id, 'removed')
      on conflict (student_id, university_id) do update set kind = 'removed', created_at = now();
    perform public.sp_notify(s.id, 'university_membership_removed', jsonb_build_object('university', o.name), '/profile');
  end if;
  perform public.sp_audit('university_membership_' || v_decision, 'profile', s.id, o.id, null, s.id);
  return jsonb_build_object('student_id', s.id, 'decision', v_decision);
end $$;

-- University managers (owner, manager) or AINDEV set the student e-mail domains. A domain cannot overlap
-- another university's (same, parent or subdomain) unless AINDEV sets it. Pending requests whose confirmed
-- e-mail now matches are verified at once; refused students are not.
create function public.sp_set_university_domains(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.organizations; v_raw text[] := public.sp_text_array(p, 'student_email_domains', 10, 253); v_domains text[] := '{}'; d text;
  v_before text[]; v_verified int := 0; r record;
begin
  perform public.sp_actor();
  -- NO KEY UPDATE: approvals and choices hold a profile row and then take KEY SHARE on the organization (FK check).
  select * into o from public.organizations where id = public.sp_uuid(p, 'organization_id') and kind = 'university' for no key update;
  if o.id is null or not public.sp_is_org_manager(o.id) then perform public.sp_forbidden(); end if;
  foreach d in array v_raw loop
    d := lower(regexp_replace(btrim(d), '^@', ''));
    if d !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' then perform public.sp_raise('invalid_field', 'student_email_domains'); end if;
    if not public.sp_student_email_domain_allowed(d) then perform public.sp_raise('domain_not_allowed', 'student_email_domains'); end if;
    if not public.sp_is_admin() and exists(
      select 1 from public.organizations x cross join lateral unnest(x.student_email_domains) e(domain)
      where x.id <> o.id and x.kind = 'university' and (e.domain = d or e.domain like '%.' || d or d like '%.' || e.domain)) then
      perform public.sp_raise('domain_in_use', 'student_email_domains');
    end if;
    if not (d = any(v_domains)) then v_domains := v_domains || d; end if;
  end loop;
  v_before := o.student_email_domains;
  update public.organizations set student_email_domains = v_domains where id = o.id;
  perform public.sp_audit('university_domains_updated', 'organization', o.id, o.id, null, null,
    jsonb_build_object('student_email_domains', to_jsonb(v_before)), jsonb_build_object('student_email_domains', to_jsonb(v_domains)));
  for r in select q.student_id from public.university_requests q join public.profiles pr on pr.id = q.student_id
           where q.university_id = o.id and q.status = 'pending' and pr.role = 'student'
             and public.sp_university_email_match(q.student_id, o.id)
           for update of pr loop -- profile first, then the request (in sp_link_university): the order every writer uses
    perform public.sp_link_university(r.student_id, o.id, 'email_domain');
    perform public.sp_notify(r.student_id, 'university_membership_approved', jsonb_build_object('university', o.name), '/profile');
    perform public.sp_audit('university_membership_verified', 'profile', r.student_id, o.id, null, r.student_id,
      '{}'::jsonb, jsonb_build_object('via', 'email_domain'));
    v_verified := v_verified + 1;
  end loop;
  return jsonb_build_object('id', o.id, 'student_email_domains', to_jsonb(v_domains), 'verified', v_verified);
end $$;

-- Supabase grants new functions to the API roles by default: the helpers stay internal and only the
-- four RPCs are callable by signed-in users.
revoke all on function public.sp_student_email_domain_allowed(text), public.sp_university_email_match(uuid, uuid),
  public.sp_link_university(uuid, uuid, text), public.sp_choose_university(uuid, uuid), public.sp_membership_university(jsonb),
  public.sp_my_university(jsonb), public.sp_university_requests(jsonb), public.sp_decide_university_request(jsonb),
  public.sp_set_university_domains(jsonb)
  from public, anon, authenticated;
grant execute on function public.sp_my_university(jsonb), public.sp_university_requests(jsonb), public.sp_decide_university_request(jsonb),
  public.sp_set_university_domains(jsonb) to authenticated;
