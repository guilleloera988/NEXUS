-- SkillPass — verified university membership (pilot readiness, docs/STATUS.md).
--
-- A student is linked to a university (profiles.university_id) only once the link is verified:
--   * at once, when the student's confirmed sign-in e-mail belongs to one of the university's student
--     e-mail domains (organizations.student_email_domains, set by the university's managers or AINDEV);
--   * or when the university's staff (or AINDEV) approve the request.
-- Until then the choice is only a request (profiles.university_request_id / _status): the student does
-- not count in the university's analytics, the university is not shown on the student's public pages,
-- and the university's staff cannot read the student's data. Everything that already reads
-- profiles.university_id keeps working and now means "verified university".

alter table public.organizations add column student_email_domains text[] not null default '{}'
  constraint organizations_student_email_domains_chk check (cardinality(student_email_domains) <= 10);

alter table public.profiles
  add column university_request_id uuid references public.organizations(id) on delete set null,
  add column university_request_status text check (university_request_status in ('pending','rejected')),
  add column university_request_at timestamptz,
  add column university_verified_via text check (university_verified_via in ('email_domain','university','admin','seed')),
  add column university_verified_at timestamptz;
create index profiles_university_request_idx on public.profiles(university_request_id);

-- Existing links were self-declared. Demo data stays linked; any other student keeps the choice as a
-- pending request that the university reviews.
update public.profiles set university_verified_via = 'seed', university_verified_at = created_at
  where university_id is not null and is_demo;
update public.profiles set university_request_id = university_id, university_request_status = 'pending',
    university_request_at = now(), university_id = null
  where university_id is not null and not is_demo and role = 'student';

-- A student e-mail domain a university may claim: a plain host name, never a public mail provider.
create function public.sp_student_email_domain_valid(p_domain text) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select coalesce(char_length(p_domain) <= 253
    and p_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
    and p_domain <> all (array['gmail.com','googlemail.com','hotmail.com','hotmail.es','hotmail.com.mx','outlook.com',
      'outlook.es','outlook.com.mx','live.com','live.com.mx','msn.com','yahoo.com','yahoo.com.mx','yahoo.es','ymail.com',
      'icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','gmx.com','gmx.net','zoho.com',
      'yandex.com','mail.com','prodigy.net.mx']), false)
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

-- The student's university choice, called from sp_apply_student_profile (onboarding and profile saves).
create function public.sp_choose_university(p_user uuid, p_university uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare cur public.profiles; v_name text;
begin
  select * into cur from public.profiles where id = p_user for update;
  if p_university is null then
    update public.profiles set university_id = null, university_verified_via = null, university_verified_at = null,
      university_request_id = null, university_request_status = null, university_request_at = null
    where id = p_user and (university_id is not null or university_request_id is not null);
  elsif p_university = cur.university_id then
    -- Already verified there: a request for another university is withdrawn.
    update public.profiles set university_request_id = null, university_request_status = null, university_request_at = null
    where id = p_user and university_request_id is not null;
  elsif public.sp_university_email_match(p_user, p_university) then
    update public.profiles set university_id = p_university, university_verified_via = 'email_domain', university_verified_at = now(),
      university_request_id = null, university_request_status = null, university_request_at = null
    where id = p_user;
    perform public.sp_audit('university_membership_verified', 'profile', p_user, p_university, null, p_user,
      '{}'::jsonb, jsonb_build_object('via', 'email_domain'));
  elsif p_university = cur.university_request_id then
    null; -- The same request stays as it is (pending, or rejected until the university decides again).
  else
    update public.profiles set university_id = null, university_verified_via = null, university_verified_at = null,
      university_request_id = p_university, university_request_status = 'pending', university_request_at = now()
    where id = p_user;
    perform public.sp_audit('university_membership_requested', 'profile', p_user, p_university, null, p_user);
    select full_name into v_name from public.profiles where id = p_user;
    perform public.sp_notify(m.user_id, 'university_request', jsonb_build_object('student', v_name), '/dashboard')
      from public.organization_members m where m.organization_id = p_university;
  end if;
end $$;

create or replace function public.sp_apply_student_profile(p_user uuid, p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uni uuid := public.sp_uuid(p, 'university_id', false); v_skills uuid[] := public.sp_uuid_array(p, 'skill_ids', 20);
begin
  if v_uni is not null and not exists(select 1 from public.organizations where id = v_uni and kind = 'university' and verification_status = 'verified') then
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

-- Pending membership requests for the caller's university, with what staff need to recognize each student.
create function public.sp_university_requests(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare o public.organizations := public.sp_membership_university(p);
begin
  if o.id is null then return jsonb_build_object('organization', null, 'requests', '[]'::jsonb); end if;
  return jsonb_build_object(
    'organization', jsonb_build_object('id', o.id, 'name', o.name, 'verification_status', o.verification_status,
      'student_email_domains', to_jsonb(o.student_email_domains), 'can_manage', public.sp_is_org_manager(o.id)),
    'verified_students', (select count(*) from public.profiles where university_id = o.id and role = 'student'),
    'requests', coalesce((select jsonb_agg(jsonb_build_object(
        'student_id', pr.id, 'full_name', pr.full_name, 'email', lower(u.email), 'career', pr.career,
        'semester', pr.semester, 'requested_at', pr.university_request_at, 'is_demo', pr.is_demo)
        order by pr.university_request_at, pr.full_name)
      from public.profiles pr left join auth.users u on u.id = pr.id
      where o.verification_status = 'verified' and pr.university_request_id = o.id
        and pr.university_request_status = 'pending' and pr.role = 'student'), '[]'::jsonb));
end $$;

-- University staff (any member of the verified university) or AINDEV decide on a student's membership:
-- approve a request, reject it, or remove a verified student.
create function public.sp_decide_university_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); o public.organizations; s public.profiles;
  v_decision text := public.sp_choice(p, 'decision', array['approve','reject','remove']);
  v_student uuid := public.sp_uuid(p, 'student_id');
begin
  o := public.sp_membership_university(jsonb_build_object('organization_id', public.sp_uuid(p, 'organization_id')));
  if o.id is null then perform public.sp_forbidden(); end if;
  if o.verification_status <> 'verified' then perform public.sp_raise('university_not_verified'); end if;
  select * into s from public.profiles where id = v_student and role = 'student' for update;
  if s.id is null then perform public.sp_raise('not_found'); end if;
  if v_decision = 'approve' then
    if s.university_request_id is distinct from o.id then perform public.sp_raise('membership_request_closed'); end if;
    update public.profiles set university_id = o.id,
      university_verified_via = case when a.role = 'admin' then 'admin' else 'university' end,
      university_verified_at = now(), university_request_id = null, university_request_status = null, university_request_at = null
    where id = s.id;
    perform public.sp_notify(s.id, 'university_membership_approved', jsonb_build_object('university', o.name), '/profile');
  elsif v_decision = 'reject' then
    if s.university_request_id is distinct from o.id or s.university_request_status <> 'pending' then perform public.sp_raise('membership_request_closed'); end if;
    update public.profiles set university_request_status = 'rejected' where id = s.id;
    perform public.sp_notify(s.id, 'university_membership_rejected', jsonb_build_object('university', o.name), '/profile');
  else
    if s.university_id is distinct from o.id then perform public.sp_raise('membership_request_closed'); end if;
    update public.profiles set university_id = null, university_verified_via = null, university_verified_at = null,
      university_request_id = o.id, university_request_status = 'rejected', university_request_at = now()
    where id = s.id;
    perform public.sp_notify(s.id, 'university_membership_removed', jsonb_build_object('university', o.name), '/profile');
  end if;
  perform public.sp_audit('university_membership_' || v_decision, 'profile', s.id, o.id, null, s.id);
  return jsonb_build_object('student_id', s.id, 'decision', v_decision);
end $$;

-- University managers (owner, manager) or AINDEV set the student e-mail domains. Pending requests whose
-- confirmed e-mail now matches are verified at once.
create function public.sp_set_university_domains(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.organizations; v_raw text[] := public.sp_text_array(p, 'student_email_domains', 10, 253); v_domains text[] := '{}'; d text;
  v_before text[]; v_verified int := 0; r record;
begin
  perform public.sp_actor();
  select * into o from public.organizations where id = public.sp_uuid(p, 'organization_id') and kind = 'university' for update;
  if o.id is null or not public.sp_is_org_manager(o.id) then perform public.sp_forbidden(); end if;
  foreach d in array v_raw loop
    d := lower(regexp_replace(btrim(d), '^@', ''));
    if not public.sp_student_email_domain_valid(d) then perform public.sp_raise('invalid_field', 'student_email_domains'); end if;
    if not (d = any(v_domains)) then v_domains := v_domains || d; end if;
  end loop;
  v_before := o.student_email_domains;
  update public.organizations set student_email_domains = v_domains where id = o.id;
  perform public.sp_audit('university_domains_updated', 'organization', o.id, o.id, null, null,
    jsonb_build_object('student_email_domains', to_jsonb(v_before)), jsonb_build_object('student_email_domains', to_jsonb(v_domains)));
  for r in select pr.id from public.profiles pr
           where pr.university_request_id = o.id and pr.university_request_status = 'pending' and pr.role = 'student'
             and public.sp_university_email_match(pr.id, o.id)
           for update loop
    update public.profiles set university_id = o.id, university_verified_via = 'email_domain', university_verified_at = now(),
      university_request_id = null, university_request_status = null, university_request_at = null
    where id = r.id;
    perform public.sp_notify(r.id, 'university_membership_approved', jsonb_build_object('university', o.name), '/profile');
    perform public.sp_audit('university_membership_verified', 'profile', r.id, o.id, null, r.id,
      '{}'::jsonb, jsonb_build_object('via', 'email_domain'));
    v_verified := v_verified + 1;
  end loop;
  return jsonb_build_object('id', o.id, 'student_email_domains', to_jsonb(v_domains), 'verified', v_verified);
end $$;

-- Supabase grants new functions to the API roles by default: the helpers stay internal and only the
-- three RPCs are callable by signed-in users.
revoke all on function public.sp_student_email_domain_valid(text), public.sp_university_email_match(uuid, uuid),
  public.sp_choose_university(uuid, uuid), public.sp_membership_university(jsonb),
  public.sp_university_requests(jsonb), public.sp_decide_university_request(jsonb), public.sp_set_university_domains(jsonb)
  from public, anon, authenticated;
grant execute on function public.sp_university_requests(jsonb), public.sp_decide_university_request(jsonb),
  public.sp_set_university_domains(jsonb) to authenticated;
