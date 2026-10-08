-- SkillPass — mutation RPCs.
--
-- Every function: SECURITY DEFINER, fixed search_path, takes one jsonb payload,
-- derives the actor from auth.uid() (never from the payload), validates input,
-- checks authorization, writes an audit entry and returns a small jsonb result.
-- Errors use message 'sp:<key>' (translated by the UI) and detail = offending field.

-- ---------------------------------------------------------------------------
-- Internal helpers (not granted to API roles)
-- ---------------------------------------------------------------------------
create function public.sp_raise(p_key text, p_field text default null) returns void
language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception using errcode = 'P0001', message = 'sp:' || p_key, detail = coalesce(p_field, '');
end $$;

create function public.sp_forbidden(p_key text default 'forbidden') returns void
language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception using errcode = '42501', message = 'sp:' || p_key;
end $$;

create function public.sp_text(p jsonb, k text, min_len int default 0, max_len int default 2000) returns text
language plpgsql immutable set search_path = public, pg_temp as $$
declare v text;
begin
  if p ? k and jsonb_typeof(p->k) not in ('string','null') then perform public.sp_raise('invalid_field', k); end if;
  v := regexp_replace(btrim(coalesce(p->>k, '')), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g');
  if char_length(v) < min_len or char_length(v) > max_len then perform public.sp_raise('invalid_field', k); end if;
  return v;
end $$;

create function public.sp_choice(p jsonb, k text, allowed text[], fallback text default null) returns text
language plpgsql immutable set search_path = public, pg_temp as $$
declare v text := nullif(btrim(coalesce(p->>k, '')), '');
begin
  if v is null and fallback is not null then return fallback; end if;
  if v is null or not (v = any(allowed)) then perform public.sp_raise('invalid_field', k); end if;
  return v;
end $$;

create function public.sp_uuid(p jsonb, k text, required boolean default true) returns uuid
language plpgsql immutable set search_path = public, pg_temp as $$
declare v text := nullif(btrim(coalesce(p->>k, '')), '');
begin
  if v is null then
    if required then perform public.sp_raise('invalid_field', k); end if;
    return null;
  end if;
  if v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then perform public.sp_raise('invalid_field', k); end if;
  return v::uuid;
end $$;

create function public.sp_num(p jsonb, k text, min_v numeric, max_v numeric, required boolean default true) returns numeric
language plpgsql immutable set search_path = public, pg_temp as $$
declare v text := nullif(btrim(coalesce(p->>k, '')), ''); n numeric;
begin
  if v is null then
    if required then perform public.sp_raise('invalid_field', k); end if;
    return null;
  end if;
  if v !~ '^-?[0-9]{1,7}(\.[0-9]{1,4})?$' then perform public.sp_raise('invalid_field', k); end if;
  n := v::numeric;
  if n < min_v or n > max_v then perform public.sp_raise('invalid_field', k); end if;
  return n;
end $$;

create function public.sp_int(p jsonb, k text, min_v int, max_v int, required boolean default true) returns int
language plpgsql immutable set search_path = public, pg_temp as $$
declare n numeric := public.sp_num(p, k, min_v, max_v, required);
begin
  if n is not null and n <> trunc(n) then perform public.sp_raise('invalid_field', k); end if;
  return n::int;
end $$;

create function public.sp_date(p jsonb, k text, required boolean default true) returns date
language plpgsql immutable set search_path = public, pg_temp as $$
declare v text := nullif(btrim(coalesce(p->>k, '')), ''); d date;
begin
  if v is null then
    if required then perform public.sp_raise('invalid_field', k); end if;
    return null;
  end if;
  if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then perform public.sp_raise('invalid_field', k); end if;
  begin d := v::date; exception when others then perform public.sp_raise('invalid_field', k); end;
  if to_char(d, 'YYYY-MM-DD') <> v or d < date '2000-01-01' or d > date '2100-12-31' then perform public.sp_raise('invalid_field', k); end if;
  return d;
end $$;

create function public.sp_bool(p jsonb, k text, fallback boolean default false) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if p->k is null or jsonb_typeof(p->k) = 'null' then return fallback; end if;
  if jsonb_typeof(p->k) = 'boolean' then return (p->k)::boolean; end if;
  if p->>k in ('true','on','1') then return true; end if;
  if p->>k in ('false','off','0','') then return false; end if;
  perform public.sp_raise('invalid_field', k);
  return null;
end $$;

create function public.sp_uuid_array(p jsonb, k text, max_items int) returns uuid[]
language plpgsql immutable set search_path = public, pg_temp as $$
declare r uuid[] := '{}'; e jsonb;
begin
  if p->k is null or jsonb_typeof(p->k) = 'null' then return r; end if;
  if jsonb_typeof(p->k) <> 'array' or jsonb_array_length(p->k) > max_items then perform public.sp_raise('invalid_field', k); end if;
  for e in select value from jsonb_array_elements(p->k) loop
    if jsonb_typeof(e) <> 'string' or (e #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform public.sp_raise('invalid_field', k);
    end if;
    if not ((e #>> '{}')::uuid = any(r)) then r := r || (e #>> '{}')::uuid; end if;
  end loop;
  return r;
end $$;

create function public.sp_text_array(p jsonb, k text, max_items int, max_len int) returns text[]
language plpgsql immutable set search_path = public, pg_temp as $$
declare r text[] := '{}'; e jsonb; v text;
begin
  if p->k is null or jsonb_typeof(p->k) = 'null' then return r; end if;
  if jsonb_typeof(p->k) <> 'array' or jsonb_array_length(p->k) > max_items then perform public.sp_raise('invalid_field', k); end if;
  for e in select value from jsonb_array_elements(p->k) loop
    if jsonb_typeof(e) <> 'string' then perform public.sp_raise('invalid_field', k); end if;
    v := btrim(e #>> '{}');
    if char_length(v) = 0 then continue; end if;
    if char_length(v) > max_len then perform public.sp_raise('invalid_field', k); end if;
    if not (v = any(r)) then r := r || v; end if;
  end loop;
  return r;
end $$;

create function public.sp_slugify(p_text text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select coalesce(nullif(btrim(regexp_replace(
    translate(lower(coalesce(p_text, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]+', '-', 'g'), '-'), ''), 'skillpass')
$$;

create function public.sp_random_hex(p_len int) returns text
language sql volatile set search_path = public, pg_temp as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, p_len))
$$;

create function public.sp_actor() returns public.profiles
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.profiles;
begin
  if auth.uid() is null then perform public.sp_forbidden('auth_required'); end if;
  select * into r from public.profiles where id = auth.uid();
  if not found then perform public.sp_forbidden('profile_required'); end if;
  return r;
end $$;

create function public.sp_audit(p_action text, p_entity_type text, p_entity_id uuid, p_org uuid, p_challenge uuid,
  p_subject uuid, p_before jsonb default '{}'::jsonb, p_after jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, organization_id, challenge_id, subject_id, before, after)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_org, p_challenge, p_subject,
          coalesce(p_before, '{}'::jsonb), coalesce(p_after, '{}'::jsonb));
$$;

create function public.sp_notify(p_user uuid, p_kind text, p_params jsonb, p_link text) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications(user_id, kind, params, link)
  select p_user, p_kind, coalesce(p_params, '{}'::jsonb), coalesce(p_link, '')
  where p_user is not null and p_user is distinct from auth.uid();
$$;

-- Owners/managers of the challenge organization plus the challenge supervisor.
create function public.sp_notify_reviewers(p_challenge uuid, p_kind text, p_params jsonb, p_link text) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications(user_id, kind, params, link)
  select distinct u, p_kind, coalesce(p_params, '{}'::jsonb), coalesce(p_link, '')
  from (
    select m.user_id as u from public.challenges c join public.organization_members m on m.organization_id = c.organization_id
    where c.id = p_challenge and m.member_role in ('owner','manager')
    union
    select c.supervisor_id from public.challenges c where c.id = p_challenge and c.supervisor_id is not null
  ) x
  where u is distinct from auth.uid();
$$;

create function public.sp_new_credential_code() returns text
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v text;
begin
  loop
    v := 'SKP-' || to_char(now(), 'YYYY') || '-' || public.sp_random_hex(4) || '-' || public.sp_random_hex(4);
    exit when not exists(select 1 from public.credentials where code = v);
  end loop;
  return v;
end $$;

-- Transparent, rule-based Skills Match (not AI). Documented in docs/ARCHITECTURE.md.
--   skills 60: per required competency, verified (level>=3) = 1.0, declared = 0.6, missing = 0
--   interests 15: at least one shared interest area with the challenge tags
--   career 10: challenge open to all careers, or career matches a target career
--   availability 15: weekly hours available vs estimated VATH / duration
create function public.sp_match_score(p_student uuid, p_challenge uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.profiles; c public.challenges; v_total int; v_credit numeric;
  v_skills numeric; v_interests numeric; v_career numeric; v_avail numeric; v_weekly numeric; v_comps jsonb;
begin
  if not (p_student = auth.uid() or public.sp_can_review_challenge(p_challenge) or public.sp_is_admin()) then
    return null;
  end if;
  select * into s from public.profiles where id = p_student and role = 'student';
  select * into c from public.challenges where id = p_challenge;
  if s.id is null or c.id is null then return null; end if;

  select count(*), coalesce(sum(case when vc.competency_id is not null then 1.0 when ds.competency_id is not null then 0.6 else 0 end), 0),
         coalesce(jsonb_agg(jsonb_build_object('competency_id', k.id, 'slug', k.slug, 'name_es', k.name_es, 'name_en', k.name_en,
           'required_level', cc.required_level,
           'source', case when vc.competency_id is not null then 'verified' when ds.competency_id is not null then 'declared' else 'missing' end)
           order by k.name_en), '[]'::jsonb)
    into v_total, v_credit, v_comps
  from public.challenge_competencies cc
  join public.competencies k on k.id = cc.competency_id
  left join public.student_verified_competencies vc on vc.competency_id = cc.competency_id and vc.student_id = p_student
  left join public.declared_skills ds on ds.competency_id = cc.competency_id and ds.student_id = p_student
  where cc.challenge_id = p_challenge;

  v_skills := case when v_total = 0 then 30 else round(60 * v_credit / v_total, 1) end;
  v_interests := case when s.interests && c.tags then 15 else 0 end;
  v_career := case
    when cardinality(c.target_careers) = 0 then 10
    when s.career <> '' and exists(select 1 from unnest(c.target_careers) t
      where position(lower(t) in lower(s.career)) > 0 or position(lower(s.career) in lower(t)) > 0) then 10
    else 0 end;
  v_weekly := round(c.estimated_vath / greatest(c.duration_weeks, 1), 1);
  v_avail := case
    when s.availability = 'not_available' then 0
    when s.hours_per_week is null then 7.5
    when s.hours_per_week >= v_weekly then 15
    else round(15 * s.hours_per_week / v_weekly, 1) end;

  return jsonb_build_object(
    'score', least(100, round(v_skills + v_interests + v_career + v_avail))::int,
    'skills', v_skills, 'interests', v_interests, 'career', v_career, 'availability', v_avail,
    'weekly_hours', v_weekly, 'competencies', v_comps);
end $$;

-- Immutable summary stored on each credential (what was verified, by whom, at issuance).
create function public.sp_build_credential_snapshot(p_assignment uuid, p_issuer uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'student_name', s.full_name,
    'challenge_title', c.title,
    'organization_name', o.name,
    'industry', c.industry,
    'modality', c.modality,
    'start_date', c.start_date,
    'end_date', c.end_date,
    'verified_hours', (select coalesce(sum(verified_hours), 0) from public.vath_entries v
      where v.assignment_id = a.id and v.status in ('verified','adjusted')),
    'competencies', (select coalesce(jsonb_agg(jsonb_build_object('competency_id', k.id, 'slug', k.slug, 'name_es', k.name_es,
        'name_en', k.name_en, 'category', k.category, 'level', x.level) order by x.level desc, k.name_en), '[]'::jsonb)
      from (select competency_id, max(level) as level from public.competency_assessments where assignment_id = a.id
            group by competency_id having max(level) >= 3) x join public.competencies k on k.id = x.competency_id),
    'supervisor_name', i.full_name,
    'supervisor_title', i.headline,
    'publication_policy', c.publication_policy,
    'evidence_approved', (select count(*) from public.evidence where assignment_id = a.id and status = 'approved'),
    'deliverables', (select count(*) from public.challenge_deliverables where challenge_id = c.id),
    'issuer', 'SkillPass by AINDEV NEXUS')
  from public.assignments a
  join public.challenges c on c.id = a.challenge_id
  join public.organizations o on o.id = c.organization_id
  join public.profiles s on s.id = a.student_id
  join public.profiles i on i.id = p_issuer
  where a.id = p_assignment
$$;

-- ---------------------------------------------------------------------------
-- Account creation (auth.users trigger) and invitations
-- ---------------------------------------------------------------------------
-- Self-service roles are limited to student/company/university. 'supervisor' is
-- only granted through an invitation; 'admin' is never granted from metadata.
create function public.sp_handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_type text := coalesce(new.raw_user_meta_data->>'account_type', 'student');
  v_name text := left(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), 160);
  v_inv public.invitations; v_kind text; v_role text;
begin
  if v_type not in ('student','company','university') then v_type := 'student'; end if;
  if v_name = '' then v_name := left(split_part(coalesce(new.email, 'usuario'), '@', 1), 160); end if;
  if v_name = '' then v_name := 'Usuario'; end if;

  select * into v_inv from public.invitations
    where status = 'pending' and email = lower(coalesce(new.email, '')) order by created_at desc limit 1;
  if v_inv.id is not null then
    select kind into v_kind from public.organizations where id = v_inv.organization_id;
    v_role := case
      when v_inv.member_role = 'supervisor' then 'supervisor'
      when v_kind = 'university' then 'university'
      else 'company' end;
  else
    v_role := v_type;
  end if;

  insert into public.profiles(id, role, full_name, slug)
  values (new.id, v_role, v_name, left(public.sp_slugify(v_name), 70) || '-' || lower(public.sp_random_hex(6)));

  if v_inv.id is not null then
    insert into public.organization_members(organization_id, user_id, member_role)
    values (v_inv.organization_id, new.id, v_inv.member_role) on conflict do nothing;
    update public.invitations set status = 'accepted', accepted_by = new.id, accepted_at = now() where id = v_inv.id;
  end if;
  return new;
end $$;
create trigger sp_on_auth_user_created after insert on auth.users for each row execute function public.sp_handle_new_user();

-- Existing accounts accept pending invitations addressed to their e-mail.
create function public.sp_accept_invitations(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); v_inv record; v_count int := 0;
begin
  for v_inv in
    select i.*, o.kind from public.invitations i join public.organizations o on o.id = i.organization_id
    where i.status = 'pending' and i.email = public.sp_auth_email()
  loop
    if (v_inv.kind = 'company' and a.role in ('company','supervisor')) or (v_inv.kind = 'university' and a.role = 'university') then
      insert into public.organization_members(organization_id, user_id, member_role)
      values (v_inv.organization_id, a.id, v_inv.member_role) on conflict do nothing;
      update public.invitations set status = 'accepted', accepted_by = a.id, accepted_at = now() where id = v_inv.id;
      perform public.sp_audit('invitation_accepted', 'organization', v_inv.organization_id, v_inv.organization_id, null, a.id);
      v_count := v_count + 1;
    end if;
  end loop;
  return jsonb_build_object('accepted', v_count);
end $$;

-- ---------------------------------------------------------------------------
-- Onboarding and profile
-- ---------------------------------------------------------------------------
create function public.sp_apply_student_profile(p_user uuid, p jsonb) returns void
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
    university_id = v_uni,
    career = public.sp_text(p, 'career', 0, 160),
    semester = public.sp_int(p, 'semester', 1, 20, false),
    interests = public.sp_text_array(p, 'interests', 12, 40),
    availability = public.sp_choice(p, 'availability', array['full_time','part_time','weekends','flexible','not_available'], 'part_time'),
    hours_per_week = public.sp_int(p, 'hours_per_week', 1, 60, false)
  where id = p_user;
  delete from public.declared_skills where student_id = p_user and not (competency_id = any(v_skills));
  insert into public.declared_skills(student_id, competency_id) select p_user, s from unnest(v_skills) s on conflict do nothing;
end $$;

create function public.sp_complete_onboarding(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); v_org uuid; v_kind text; v_name text;
begin
  if a.role = 'student' then
    perform public.sp_apply_student_profile(a.id, p);
    update public.profiles set open_to_opportunities = public.sp_bool(p, 'open_to_opportunities', false), onboarding_completed = true where id = a.id;
  elsif a.role in ('company','university') then
    v_kind := case a.role when 'company' then 'company' else 'university' end;
    select m.organization_id into v_org from public.organization_members m join public.organizations o on o.id = m.organization_id
      where m.user_id = a.id and o.kind = v_kind limit 1;
    if v_org is null then
      v_name := public.sp_text(p, 'organization_name', 2, 160);
      insert into public.organizations(kind, name, slug, industry, size, location, website, description, needs, campus, programs, created_by, is_demo)
      values (v_kind, v_name, left(public.sp_slugify(v_name), 80) || '-' || lower(public.sp_random_hex(4)),
        case when v_kind = 'company' then public.sp_text(p, 'industry', 0, 60) else 'education' end,
        case when v_kind = 'company' then public.sp_choice(p, 'size', array['','1-10','11-50','51-200','201-1000','1000+'], '') else '' end,
        public.sp_text(p, 'location', 0, 120),
        public.sp_text(p, 'website', 0, 300),
        public.sp_text(p, 'description', 0, 1500),
        case when v_kind = 'company' then public.sp_text(p, 'needs', 0, 1500) else '' end,
        case when v_kind = 'university' then public.sp_text(p, 'campus', 0, 120) else '' end,
        case when v_kind = 'university' then public.sp_text_array(p, 'programs', 60, 120) else '{}' end,
        a.id, a.is_demo)
      returning id into v_org;
      insert into public.organization_members(organization_id, user_id, member_role) values (v_org, a.id, 'owner');
      perform public.sp_audit('organization_created', 'organization', v_org, v_org, null, a.id, '{}'::jsonb, jsonb_build_object('name', v_name, 'kind', v_kind));
    end if;
    update public.profiles set full_name = public.sp_text(p, 'full_name', 1, 160), headline = public.sp_text(p, 'headline', 0, 160),
      onboarding_completed = true where id = a.id;
  else
    update public.profiles set full_name = public.sp_text(p, 'full_name', 1, 160), headline = public.sp_text(p, 'headline', 0, 160),
      onboarding_completed = true where id = a.id;
  end if;
  perform public.sp_audit('onboarding_completed', 'profile', a.id, v_org, null, a.id);
  return jsonb_build_object('id', a.id, 'organization_id', v_org);
end $$;

create function public.sp_update_profile(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor();
begin
  if a.role = 'student' then
    perform public.sp_apply_student_profile(a.id, p);
    update public.profiles set
      skillpass_public = public.sp_bool(p, 'skillpass_public', a.skillpass_public),
      open_to_opportunities = public.sp_bool(p, 'open_to_opportunities', a.open_to_opportunities),
      public_show_university = public.sp_bool(p, 'public_show_university', a.public_show_university),
      public_show_career = public.sp_bool(p, 'public_show_career', a.public_show_career)
    where id = a.id;
  else
    update public.profiles set full_name = public.sp_text(p, 'full_name', 1, 160), headline = public.sp_text(p, 'headline', 0, 160),
      bio = public.sp_text(p, 'bio', 0, 1200) where id = a.id;
  end if;
  perform public.sp_audit('profile_updated', 'profile', a.id, null, null, a.id);
  return jsonb_build_object('id', a.id);
end $$;

-- Privacy switches only (SkillPass page), so they can be toggled without re-sending the profile.
create function public.sp_update_privacy(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor();
begin
  if a.role <> 'student' then perform public.sp_forbidden('students_only'); end if;
  update public.profiles set
    skillpass_public = public.sp_bool(p, 'skillpass_public', a.skillpass_public),
    open_to_opportunities = public.sp_bool(p, 'open_to_opportunities', a.open_to_opportunities),
    public_show_university = public.sp_bool(p, 'public_show_university', a.public_show_university),
    public_show_career = public.sp_bool(p, 'public_show_career', a.public_show_career)
  where id = a.id;
  perform public.sp_audit('privacy_updated', 'profile', a.id, null, null, a.id,
    jsonb_build_object('skillpass_public', a.skillpass_public, 'open_to_opportunities', a.open_to_opportunities),
    (select jsonb_build_object('skillpass_public', skillpass_public, 'open_to_opportunities', open_to_opportunities) from public.profiles where id = a.id));
  return jsonb_build_object('id', a.id);
end $$;

-- ---------------------------------------------------------------------------
-- Organizations and members
-- ---------------------------------------------------------------------------
create function public.sp_update_organization(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); o public.organizations; v_name text;
begin
  select * into o from public.organizations where id = public.sp_uuid(p, 'organization_id') for update;
  if not found or not public.sp_is_org_manager(o.id) then perform public.sp_forbidden(); end if;
  v_name := public.sp_text(p, 'name', 2, 160);
  update public.organizations set
    name = v_name,
    industry = public.sp_text(p, 'industry', 0, 60),
    size = public.sp_choice(p, 'size', array['','1-10','11-50','51-200','201-1000','1000+'], ''),
    location = public.sp_text(p, 'location', 0, 120),
    website = public.sp_text(p, 'website', 0, 300),
    description = public.sp_text(p, 'description', 0, 1500),
    needs = public.sp_text(p, 'needs', 0, 1500),
    campus = public.sp_text(p, 'campus', 0, 120),
    programs = public.sp_text_array(p, 'programs', 60, 120),
    -- Renaming a verified organization requires a new review by AINDEV.
    verification_status = case when v_name <> o.name and not public.sp_is_admin() then 'pending' else verification_status end
  where id = o.id;
  perform public.sp_audit('organization_updated', 'organization', o.id, o.id, null, null, jsonb_build_object('name', o.name), jsonb_build_object('name', v_name));
  return jsonb_build_object('id', o.id);
end $$;

create function public.sp_invite_member(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.profiles := public.sp_actor(); o public.organizations;
  v_email text := lower(public.sp_text(p, 'email', 5, 254)); v_role text; v_user public.profiles;
begin
  select * into o from public.organizations where id = public.sp_uuid(p, 'organization_id');
  if not found or not public.sp_is_org_manager(o.id) or o.kind = 'aindev' then perform public.sp_forbidden(); end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then perform public.sp_raise('invalid_field', 'email'); end if;
  v_role := public.sp_choice(p, 'member_role', case when o.kind = 'company' then array['manager','supervisor'] else array['manager','staff'] end);

  select pr.* into v_user from auth.users u join public.profiles pr on pr.id = u.id where lower(u.email) = v_email;
  if v_user.id is not null then
    if not ((o.kind = 'company' and v_user.role in ('company','supervisor')) or (o.kind = 'university' and v_user.role = 'university')) then
      perform public.sp_raise('user_role_incompatible', 'email');
    end if;
    insert into public.organization_members(organization_id, user_id, member_role) values (o.id, v_user.id, v_role)
      on conflict (organization_id, user_id) do update set member_role = excluded.member_role;
    perform public.sp_notify(v_user.id, 'organization_membership', jsonb_build_object('organization', o.name), '/organization');
    perform public.sp_audit('member_added', 'organization', o.id, o.id, null, v_user.id, '{}'::jsonb, jsonb_build_object('member_role', v_role));
    return jsonb_build_object('status', 'added');
  end if;

  if exists(select 1 from public.invitations where organization_id = o.id and email = v_email and status = 'pending') then
    perform public.sp_raise('already_invited', 'email');
  end if;
  insert into public.invitations(organization_id, email, member_role, invited_by) values (o.id, v_email, v_role, a.id);
  perform public.sp_audit('member_invited', 'organization', o.id, o.id, null, null, '{}'::jsonb, jsonb_build_object('email', v_email, 'member_role', v_role));
  return jsonb_build_object('status', 'invited');
end $$;

create function public.sp_revoke_invitation(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare i public.invitations;
begin
  perform public.sp_actor();
  select * into i from public.invitations where id = public.sp_uuid(p, 'invitation_id') for update;
  if not found or not public.sp_is_org_manager(i.organization_id) then perform public.sp_forbidden(); end if;
  if i.status <> 'pending' then perform public.sp_raise('invitation_closed'); end if;
  update public.invitations set status = 'revoked' where id = i.id;
  perform public.sp_audit('invitation_revoked', 'organization', i.organization_id, i.organization_id, null, null, '{}'::jsonb, jsonb_build_object('email', i.email));
  return jsonb_build_object('id', i.id);
end $$;

create function public.sp_remove_member(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid := public.sp_uuid(p, 'organization_id'); v_user uuid := public.sp_uuid(p, 'user_id'); v_role text;
begin
  perform public.sp_actor();
  if not public.sp_is_org_manager(v_org) then perform public.sp_forbidden(); end if;
  select member_role into v_role from public.organization_members where organization_id = v_org and user_id = v_user;
  if v_role is null then perform public.sp_raise('not_found'); end if;
  if v_role = 'owner' and (select count(*) from public.organization_members where organization_id = v_org and member_role = 'owner') <= 1 then
    perform public.sp_raise('last_owner');
  end if;
  if exists(select 1 from public.challenges where organization_id = v_org and supervisor_id = v_user and status not in ('completed','archived')) then
    perform public.sp_raise('member_supervises_challenges');
  end if;
  delete from public.organization_members where organization_id = v_org and user_id = v_user;
  perform public.sp_audit('member_removed', 'organization', v_org, v_org, null, v_user, jsonb_build_object('member_role', v_role));
  return jsonb_build_object('id', v_user);
end $$;

-- ---------------------------------------------------------------------------
-- Challenges
-- ---------------------------------------------------------------------------
create function public.sp_save_challenge(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.profiles := public.sp_actor(); c public.challenges; v_id uuid := public.sp_uuid(p, 'id', false); v_org uuid;
  v_supervisor uuid := public.sp_uuid(p, 'supervisor_id', false); v_start date := public.sp_date(p, 'start_date', false);
  v_end date := public.sp_date(p, 'end_date', false); v_comp_type text; v_vath numeric; v_item jsonb; v_comp uuid; v_level int;
  v_comp_ids uuid[] := '{}'; v_del_ids uuid[] := '{}'; v_del uuid; v_ord int := 0;
begin
  if v_id is null then
    v_org := public.sp_uuid(p, 'organization_id');
    if not exists(select 1 from public.organizations where id = v_org and kind = 'company') or not public.sp_is_org_manager(v_org) then
      perform public.sp_forbidden();
    end if;
  else
    select * into c from public.challenges where id = v_id for update;
    if not found or not public.sp_can_manage_challenge(v_id) then perform public.sp_forbidden(); end if;
    if c.status in ('completed','archived') then perform public.sp_raise('challenge_locked'); end if;
    v_org := c.organization_id;
  end if;
  if v_start is not null and v_end is not null and v_end < v_start then perform public.sp_raise('invalid_dates', 'end_date'); end if;
  if v_supervisor is not null and not exists(select 1 from public.organization_members
      where organization_id = v_org and user_id = v_supervisor and member_role in ('owner','manager','supervisor')) then
    perform public.sp_raise('invalid_field', 'supervisor_id');
  end if;
  v_comp_type := public.sp_choice(p, 'compensation_type', array['paid','stipend','prize','in_kind','none'], 'none');
  v_vath := public.sp_num(p, 'estimated_vath', 1, 1000);
  -- Fair-work guardrail: unpaid challenges are limited to short learning scopes.
  if v_comp_type = 'none' and v_vath > 60 then perform public.sp_raise('fair_work_unpaid_limit', 'estimated_vath'); end if;

  if jsonb_typeof(coalesce(p->'competencies', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p->'competencies', '[]'::jsonb)) > 10 then
    perform public.sp_raise('invalid_field', 'competencies');
  end if;
  if jsonb_typeof(coalesce(p->'deliverables', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p->'deliverables', '[]'::jsonb)) > 12 then
    perform public.sp_raise('invalid_field', 'deliverables');
  end if;

  if v_id is null then
    insert into public.challenges(organization_id, title, summary, description, problem, objective, industry, tags, target_careers,
      modality, location, duration_weeks, start_date, end_date, max_participants, estimated_vath, supervisor_id, conditions,
      compensation_type, compensation_details, ip_policy, ip_details, confidentiality, publication_policy, created_by, is_demo)
    values (v_org, public.sp_text(p, 'title', 3, 160), public.sp_text(p, 'summary', 0, 400), public.sp_text(p, 'description', 0, 4000),
      public.sp_text(p, 'problem', 10, 3000), public.sp_text(p, 'objective', 10, 2000), public.sp_text(p, 'industry', 0, 60),
      public.sp_text_array(p, 'tags', 8, 40), public.sp_text_array(p, 'target_careers', 12, 120),
      public.sp_choice(p, 'modality', array['remote','hybrid','onsite'], 'hybrid'), public.sp_text(p, 'location', 0, 120),
      public.sp_int(p, 'duration_weeks', 1, 52), v_start, v_end, public.sp_int(p, 'max_participants', 1, 50), v_vath, v_supervisor,
      public.sp_text(p, 'conditions', 0, 2000), v_comp_type, public.sp_text(p, 'compensation_details', 0, 600),
      public.sp_choice(p, 'ip_policy', array['student_owns','shared','company_license','company_owns','to_be_agreed'], 'to_be_agreed'),
      public.sp_text(p, 'ip_details', 0, 1500),
      public.sp_choice(p, 'confidentiality', array['public','confidential','nda_required'], 'public'),
      public.sp_choice(p, 'publication_policy', array['public_allowed','summary_only','confidential'], 'public_allowed'),
      a.id, a.is_demo)
    returning * into c;
  else
    update public.challenges set
      title = public.sp_text(p, 'title', 3, 160), summary = public.sp_text(p, 'summary', 0, 400),
      description = public.sp_text(p, 'description', 0, 4000), problem = public.sp_text(p, 'problem', 10, 3000),
      objective = public.sp_text(p, 'objective', 10, 2000), industry = public.sp_text(p, 'industry', 0, 60),
      tags = public.sp_text_array(p, 'tags', 8, 40), target_careers = public.sp_text_array(p, 'target_careers', 12, 120),
      modality = public.sp_choice(p, 'modality', array['remote','hybrid','onsite'], 'hybrid'), location = public.sp_text(p, 'location', 0, 120),
      duration_weeks = public.sp_int(p, 'duration_weeks', 1, 52), start_date = v_start, end_date = v_end,
      max_participants = public.sp_int(p, 'max_participants', 1, 50), estimated_vath = v_vath, supervisor_id = v_supervisor,
      conditions = public.sp_text(p, 'conditions', 0, 2000), compensation_type = v_comp_type,
      compensation_details = public.sp_text(p, 'compensation_details', 0, 600),
      ip_policy = public.sp_choice(p, 'ip_policy', array['student_owns','shared','company_license','company_owns','to_be_agreed'], 'to_be_agreed'),
      ip_details = public.sp_text(p, 'ip_details', 0, 1500),
      confidentiality = public.sp_choice(p, 'confidentiality', array['public','confidential','nda_required'], 'public'),
      publication_policy = public.sp_choice(p, 'publication_policy', array['public_allowed','summary_only','confidential'], 'public_allowed')
    where id = v_id returning * into c;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p->'competencies', '[]'::jsonb)) loop
    v_comp := public.sp_uuid(v_item, 'competency_id');
    v_level := public.sp_int(v_item, 'required_level', 1, 5, false);
    if not exists(select 1 from public.competencies where id = v_comp and is_active) then perform public.sp_raise('invalid_field', 'competencies'); end if;
    v_comp_ids := v_comp_ids || v_comp;
    insert into public.challenge_competencies(challenge_id, competency_id, required_level) values (c.id, v_comp, coalesce(v_level, 3))
      on conflict (challenge_id, competency_id) do update set required_level = excluded.required_level;
  end loop;
  delete from public.challenge_competencies where challenge_id = c.id and not (competency_id = any(v_comp_ids));

  for v_item in select value from jsonb_array_elements(coalesce(p->'deliverables', '[]'::jsonb)) loop
    v_ord := v_ord + 1;
    v_del := public.sp_uuid(v_item, 'id', false);
    if v_del is not null and exists(select 1 from public.challenge_deliverables where id = v_del and challenge_id = c.id) then
      update public.challenge_deliverables set title = public.sp_text(v_item, 'title', 2, 160), description = public.sp_text(v_item, 'description', 0, 1000),
        due_date = public.sp_date(v_item, 'due_date', false), sort_order = v_ord where id = v_del;
    else
      insert into public.challenge_deliverables(challenge_id, title, description, due_date, sort_order)
      values (c.id, public.sp_text(v_item, 'title', 2, 160), public.sp_text(v_item, 'description', 0, 1000), public.sp_date(v_item, 'due_date', false), v_ord)
      returning id into v_del;
    end if;
    v_del_ids := v_del_ids || v_del;
  end loop;
  delete from public.challenge_deliverables where challenge_id = c.id and not (id = any(v_del_ids));

  if c.status not in ('draft') and (cardinality(v_comp_ids) = 0 or cardinality(v_del_ids) = 0 or c.supervisor_id is null) then
    perform public.sp_raise('challenge_incomplete');
  end if;

  perform public.sp_audit(case when v_id is null then 'challenge_created' else 'challenge_updated' end, 'challenge', c.id, v_org, c.id, null,
    '{}'::jsonb, jsonb_build_object('title', c.title, 'status', c.status));
  return jsonb_build_object('id', c.id);
end $$;

create function public.sp_set_challenge_status(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c public.challenges; v_new text := public.sp_choice(p, 'status', array['draft','published','recruiting','active','under_review','completed','archived']);
  v_allowed text[]; v_participant uuid;
begin
  perform public.sp_actor();
  select * into c from public.challenges where id = public.sp_uuid(p, 'challenge_id') for update;
  if not found or not public.sp_can_manage_challenge(c.id) then perform public.sp_forbidden(); end if;
  v_allowed := case c.status
    when 'draft' then array['published','recruiting','archived']
    when 'published' then array['draft','recruiting','active','archived']
    when 'recruiting' then array['published','active','archived']
    when 'active' then array['recruiting','under_review','completed']
    when 'under_review' then array['active','completed']
    when 'completed' then array['archived']
    else array[]::text[] end;
  if not (v_new = any(v_allowed)) then perform public.sp_raise('invalid_transition', 'status'); end if;

  if c.status = 'draft' and v_new in ('published','recruiting') then
    if not exists(select 1 from public.organizations where id = c.organization_id and verification_status = 'verified') then
      perform public.sp_raise('organization_not_verified');
    end if;
    if not exists(select 1 from public.challenge_competencies where challenge_id = c.id) then perform public.sp_raise('challenge_incomplete', 'competencies'); end if;
    if not exists(select 1 from public.challenge_deliverables where challenge_id = c.id) then perform public.sp_raise('challenge_incomplete', 'deliverables'); end if;
    if c.supervisor_id is null then perform public.sp_raise('challenge_incomplete', 'supervisor_id'); end if;
    if c.start_date is null or c.end_date is null then perform public.sp_raise('challenge_incomplete', 'start_date'); end if;
  end if;
  if v_new = 'draft' and exists(select 1 from public.applications where challenge_id = c.id) then perform public.sp_raise('challenge_has_applications'); end if;
  if v_new = 'archived' and exists(select 1 from public.assignments where challenge_id = c.id and status = 'active') then
    perform public.sp_raise('challenge_has_active_assignments');
  end if;
  if v_new = 'completed' and exists(select 1 from public.validation_requests where challenge_id = c.id and status = 'pending') then
    perform public.sp_raise('pending_validations');
  end if;

  update public.challenges set status = v_new,
    published_at = case when v_new in ('published','recruiting') then coalesce(published_at, now()) else published_at end
  where id = c.id;
  if v_new in ('active','under_review','completed') then
    for v_participant in select student_id from public.assignments where challenge_id = c.id and status in ('active','completed') loop
      perform public.sp_notify(v_participant, 'challenge_status', jsonb_build_object('challenge', c.title, 'status', v_new), '/workspace/' || c.id);
    end loop;
  end if;
  perform public.sp_audit('challenge_status_changed', 'challenge', c.id, c.organization_id, c.id, null,
    jsonb_build_object('status', c.status), jsonb_build_object('status', v_new));
  return jsonb_build_object('id', c.id, 'status', v_new);
end $$;

-- ---------------------------------------------------------------------------
-- Applications and assignments
-- ---------------------------------------------------------------------------
create function public.sp_apply(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); c public.challenges; v_app public.applications; v_match jsonb;
  v_motivation text := public.sp_text(p, 'motivation', 20, 2000); v_note text := public.sp_text(p, 'availability_note', 0, 400);
begin
  if a.role <> 'student' then perform public.sp_forbidden('students_only'); end if;
  if not a.onboarding_completed then perform public.sp_raise('onboarding_required'); end if;
  select * into c from public.challenges where id = public.sp_uuid(p, 'challenge_id');
  if not found then perform public.sp_raise('not_found'); end if;
  if c.status <> 'recruiting' then perform public.sp_raise('challenge_not_recruiting'); end if;
  v_match := public.sp_match_score(a.id, c.id);

  select * into v_app from public.applications where challenge_id = c.id and student_id = a.id for update;
  if v_app.id is not null then
    if v_app.status <> 'withdrawn' then perform public.sp_raise('already_applied'); end if;
    update public.applications set motivation = v_motivation, availability_note = v_note, status = 'submitted',
      match_score = (v_match->>'score')::int, match_breakdown = v_match, decided_by = null, decided_at = null, decision_note = ''
    where id = v_app.id returning * into v_app;
  else
    insert into public.applications(challenge_id, student_id, motivation, availability_note, match_score, match_breakdown)
    values (c.id, a.id, v_motivation, v_note, (v_match->>'score')::int, v_match) returning * into v_app;
  end if;
  perform public.sp_notify_reviewers(c.id, 'application_received', jsonb_build_object('student', a.full_name, 'challenge', c.title),
    '/challenges/' || c.id || '?tab=candidates');
  perform public.sp_audit('application_submitted', 'application', v_app.id, c.organization_id, c.id, a.id,
    '{}'::jsonb, jsonb_build_object('match_score', v_app.match_score));
  return jsonb_build_object('id', v_app.id, 'match_score', v_app.match_score);
end $$;

create function public.sp_withdraw_application(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); v_app public.applications; c public.challenges;
begin
  select * into v_app from public.applications where id = public.sp_uuid(p, 'application_id') for update;
  if not found or v_app.student_id <> a.id then perform public.sp_forbidden(); end if;
  if v_app.status not in ('submitted','shortlisted') then perform public.sp_raise('application_closed'); end if;
  select * into c from public.challenges where id = v_app.challenge_id;
  update public.applications set status = 'withdrawn' where id = v_app.id;
  perform public.sp_audit('application_withdrawn', 'application', v_app.id, c.organization_id, c.id, a.id,
    jsonb_build_object('status', v_app.status), jsonb_build_object('status', 'withdrawn'));
  return jsonb_build_object('id', v_app.id);
end $$;

create function public.sp_decide_application(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.profiles := public.sp_actor(); v_app public.applications; c public.challenges; v_asg uuid;
  v_decision text := public.sp_choice(p, 'decision', array['shortlist','accept','reject']);
  v_note text := public.sp_text(p, 'note', 0, 1000); v_status text;
begin
  select * into v_app from public.applications where id = public.sp_uuid(p, 'application_id') for update;
  if not found then perform public.sp_raise('not_found'); end if;
  select * into c from public.challenges where id = v_app.challenge_id for update;
  if not public.sp_can_manage_challenge(c.id) then perform public.sp_forbidden(); end if;
  if v_app.status not in ('submitted','shortlisted') then perform public.sp_raise('application_closed'); end if;
  v_status := case v_decision when 'shortlist' then 'shortlisted' when 'accept' then 'accepted' else 'rejected' end;

  if v_decision = 'accept' then
    if c.status not in ('published','recruiting','active') then perform public.sp_raise('challenge_closed'); end if;
    if (select count(*) from public.assignments where challenge_id = c.id and status in ('active','completed')) >= c.max_participants then
      perform public.sp_raise('challenge_full');
    end if;
    insert into public.assignments(challenge_id, student_id, application_id, assigned_by)
    values (c.id, v_app.student_id, v_app.id, a.id)
    on conflict (challenge_id, student_id) do update
      set status = 'active', application_id = excluded.application_id, assigned_by = excluded.assigned_by, started_at = now(), completed_at = null
      where public.assignments.status = 'withdrawn'
    returning id into v_asg;
    if v_asg is null then perform public.sp_raise('already_assigned'); end if;
    perform public.sp_notify(v_app.student_id, 'challenge_assigned', jsonb_build_object('challenge', c.title), '/workspace/' || c.id);
  elsif v_decision = 'shortlist' then
    perform public.sp_notify(v_app.student_id, 'application_shortlisted', jsonb_build_object('challenge', c.title), '/challenges/' || c.id);
  else
    perform public.sp_notify(v_app.student_id, 'application_rejected', jsonb_build_object('challenge', c.title), '/challenges/' || c.id);
  end if;

  update public.applications set status = v_status, decided_by = a.id, decided_at = now(), decision_note = v_note where id = v_app.id;
  perform public.sp_audit('application_decided', 'application', v_app.id, c.organization_id, c.id, v_app.student_id,
    jsonb_build_object('status', v_app.status), jsonb_build_object('status', v_status, 'note', v_note));
  return jsonb_build_object('id', v_app.id, 'status', v_status, 'assignment_id', v_asg);
end $$;

create function public.sp_end_assignment(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); v_asg public.assignments; c public.challenges; v_reason text := public.sp_text(p, 'reason', 5, 600);
begin
  select * into v_asg from public.assignments where id = public.sp_uuid(p, 'assignment_id') for update;
  if not found or not (v_asg.student_id = a.id or public.sp_can_manage_challenge(v_asg.challenge_id)) then perform public.sp_forbidden(); end if;
  if v_asg.status <> 'active' then perform public.sp_raise('assignment_not_active'); end if;
  if exists(select 1 from public.validation_requests where assignment_id = v_asg.id and status = 'pending') then
    perform public.sp_raise('pending_validations');
  end if;
  select * into c from public.challenges where id = v_asg.challenge_id;
  update public.assignments set status = 'withdrawn' where id = v_asg.id;
  if v_asg.student_id <> a.id then
    perform public.sp_notify(v_asg.student_id, 'assignment_ended', jsonb_build_object('challenge', c.title), '/challenges/' || c.id);
  else
    perform public.sp_notify_reviewers(c.id, 'assignment_ended', jsonb_build_object('challenge', c.title, 'student', a.full_name), '/challenges/' || c.id);
  end if;
  perform public.sp_audit('assignment_ended', 'assignment', v_asg.id, c.organization_id, c.id, v_asg.student_id,
    jsonb_build_object('status', 'active'), jsonb_build_object('status', 'withdrawn', 'reason', v_reason));
  return jsonb_build_object('id', v_asg.id);
end $$;

create function public.sp_invite_to_challenge(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); c public.challenges; v_student uuid := public.sp_uuid(p, 'student_id');
  v_message text := public.sp_text(p, 'message', 0, 600);
begin
  select * into c from public.challenges where id = public.sp_uuid(p, 'challenge_id');
  if not found or not public.sp_can_manage_challenge(c.id) then perform public.sp_forbidden(); end if;
  if c.status not in ('published','recruiting') then perform public.sp_raise('challenge_not_recruiting'); end if;
  if not public.sp_in_talent_pool(v_student) then perform public.sp_forbidden('student_not_in_talent_pool'); end if;
  if exists(select 1 from public.applications where challenge_id = c.id and student_id = v_student)
     or exists(select 1 from public.notifications where user_id = v_student and kind = 'challenge_invitation' and params->>'challenge_id' = c.id::text) then
    perform public.sp_raise('already_invited');
  end if;
  insert into public.notifications(user_id, kind, params, link)
  values (v_student, 'challenge_invitation', jsonb_build_object('challenge', c.title, 'challenge_id', c.id, 'message', v_message,
    'organization', (select name from public.organizations where id = c.organization_id)), '/challenges/' || c.id);
  perform public.sp_audit('challenge_invitation_sent', 'challenge', c.id, c.organization_id, c.id, v_student);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- Workspace: tasks
-- ---------------------------------------------------------------------------
create function public.sp_workspace_access(p_challenge uuid) returns public.challenges
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c public.challenges;
begin
  select * into c from public.challenges where id = p_challenge;
  if not found then perform public.sp_raise('not_found'); end if;
  if not (public.sp_can_review_challenge(c.id) or exists(select 1 from public.assignments
      where challenge_id = c.id and student_id = auth.uid() and status = 'active')) then
    perform public.sp_forbidden();
  end if;
  if c.status in ('completed','archived') then perform public.sp_raise('challenge_locked'); end if;
  return c;
end $$;

create function public.sp_save_task(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); t public.tasks; c public.challenges; v_id uuid := public.sp_uuid(p, 'id', false);
  v_assignee uuid := public.sp_uuid(p, 'assignee_id', false); v_deliverable uuid := public.sp_uuid(p, 'deliverable_id', false);
begin
  if v_id is not null then
    select * into t from public.tasks where id = v_id for update;
    if not found then perform public.sp_raise('not_found'); end if;
    c := public.sp_workspace_access(t.challenge_id);
  else
    c := public.sp_workspace_access(public.sp_uuid(p, 'challenge_id'));
  end if;
  if v_assignee is not null and not exists(select 1 from public.assignments where challenge_id = c.id and student_id = v_assignee and status = 'active') then
    perform public.sp_raise('invalid_field', 'assignee_id');
  end if;
  if v_deliverable is not null and not exists(select 1 from public.challenge_deliverables where id = v_deliverable and challenge_id = c.id) then
    perform public.sp_raise('invalid_field', 'deliverable_id');
  end if;
  if v_id is null then
    insert into public.tasks(challenge_id, deliverable_id, title, description, status, assignee_id, due_date, created_by,
      sort_order)
    values (c.id, v_deliverable, public.sp_text(p, 'title', 2, 160), public.sp_text(p, 'description', 0, 1500),
      public.sp_choice(p, 'status', array['todo','in_progress','done'], 'todo'), v_assignee, public.sp_date(p, 'due_date', false), a.id,
      (select coalesce(max(sort_order), 0) + 1 from public.tasks where challenge_id = c.id))
    returning * into t;
  else
    update public.tasks set deliverable_id = v_deliverable, title = public.sp_text(p, 'title', 2, 160),
      description = public.sp_text(p, 'description', 0, 1500), status = public.sp_choice(p, 'status', array['todo','in_progress','done'], t.status),
      assignee_id = v_assignee, due_date = public.sp_date(p, 'due_date', false)
    where id = v_id returning * into t;
  end if;
  perform public.sp_audit(case when v_id is null then 'task_created' else 'task_updated' end, 'task', t.id, c.organization_id, c.id, null,
    '{}'::jsonb, jsonb_build_object('title', t.title, 'status', t.status));
  return jsonb_build_object('id', t.id);
end $$;

create function public.sp_set_task_status(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.tasks; c public.challenges; v_status text := public.sp_choice(p, 'status', array['todo','in_progress','done']);
begin
  perform public.sp_actor();
  select * into t from public.tasks where id = public.sp_uuid(p, 'task_id') for update;
  if not found then perform public.sp_raise('not_found'); end if;
  c := public.sp_workspace_access(t.challenge_id);
  update public.tasks set status = v_status where id = t.id;
  perform public.sp_audit('task_status_changed', 'task', t.id, c.organization_id, c.id, null,
    jsonb_build_object('status', t.status), jsonb_build_object('status', v_status, 'title', t.title));
  return jsonb_build_object('id', t.id, 'status', v_status);
end $$;

create function public.sp_delete_task(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); t public.tasks; c public.challenges;
begin
  select * into t from public.tasks where id = public.sp_uuid(p, 'task_id') for update;
  if not found then perform public.sp_raise('not_found'); end if;
  c := public.sp_workspace_access(t.challenge_id);
  if not (t.created_by = a.id or public.sp_can_review_challenge(c.id)) then perform public.sp_forbidden(); end if;
  delete from public.tasks where id = t.id;
  perform public.sp_audit('task_deleted', 'task', t.id, c.organization_id, c.id, null, jsonb_build_object('title', t.title));
  return jsonb_build_object('id', t.id);
end $$;

-- ---------------------------------------------------------------------------
-- Evidence
-- ---------------------------------------------------------------------------
create function public.sp_student_assignment(p_challenge uuid) returns public.assignments
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v public.assignments;
begin
  select * into v from public.assignments where challenge_id = p_challenge and student_id = auth.uid() and status = 'active';
  if not found then perform public.sp_forbidden('not_assigned'); end if;
  if not exists(select 1 from public.challenges where id = p_challenge and status in ('published','recruiting','active','under_review')) then
    perform public.sp_raise('challenge_locked');
  end if;
  return v;
end $$;

create function public.sp_add_evidence(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.profiles := public.sp_actor(); v_asg public.assignments; c public.challenges; v_prev public.evidence; v_id uuid;
  v_kind text := public.sp_choice(p, 'kind', array['file','image','pdf','document','presentation','link','repository','video']);
  v_url text := nullif(public.sp_text(p, 'url', 0, 2048), ''); v_path text := nullif(public.sp_text(p, 'storage_path', 0, 400), '');
  v_mime text := nullif(public.sp_text(p, 'mime_type', 0, 120), ''); v_size int := public.sp_int(p, 'size_bytes', 1, 10485760, false);
  v_file text := nullif(public.sp_text(p, 'file_name', 0, 200), ''); v_comps uuid[] := public.sp_uuid_array(p, 'competency_ids', 10);
  v_deliverable uuid := public.sp_uuid(p, 'deliverable_id', false); v_task uuid := public.sp_uuid(p, 'task_id', false);
  v_previous uuid := public.sp_uuid(p, 'previous_id', false); v_version int := 1;
begin
  if a.role <> 'student' then perform public.sp_forbidden('students_only'); end if;
  v_asg := public.sp_student_assignment(public.sp_uuid(p, 'challenge_id'));
  select * into c from public.challenges where id = v_asg.challenge_id;

  if (v_url is null) = (v_path is null) then perform public.sp_raise('evidence_source_required', 'url'); end if;
  if v_url is not null then
    if v_url !~ '^https://[^[:space:]@]+$' then perform public.sp_raise('invalid_field', 'url'); end if;
    if v_kind not in ('link','repository','video','presentation','document') then perform public.sp_raise('invalid_field', 'kind'); end if;
    v_mime := null; v_size := null; v_file := null;
  else
    -- Files are uploaded by the server to "<student uuid>/<challenge uuid>/<random>-<name>".
    if v_path !~ ('^' || a.id::text || '/' || c.id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$') then
      perform public.sp_raise('invalid_field', 'storage_path');
    end if;
    if v_kind not in ('file','image','pdf','document','presentation') or v_file is null or v_size is null then
      perform public.sp_raise('invalid_field', 'kind');
    end if;
    if v_mime is null or v_mime not in ('application/pdf','image/png','image/jpeg','image/webp','image/gif','text/plain','text/csv','application/zip',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.ms-powerpoint','application/vnd.ms-excel') then
      perform public.sp_raise('invalid_file_type', 'mime_type');
    end if;
  end if;
  if v_deliverable is not null and not exists(select 1 from public.challenge_deliverables where id = v_deliverable and challenge_id = c.id) then
    perform public.sp_raise('invalid_field', 'deliverable_id');
  end if;
  if v_task is not null and not exists(select 1 from public.tasks where id = v_task and challenge_id = c.id) then
    perform public.sp_raise('invalid_field', 'task_id');
  end if;
  if exists(select 1 from unnest(v_comps) x where not exists(select 1 from public.challenge_competencies cc where cc.challenge_id = c.id and cc.competency_id = x)) then
    perform public.sp_raise('invalid_field', 'competency_ids');
  end if;
  if v_previous is not null then
    select * into v_prev from public.evidence where id = v_previous;
    if not found or v_prev.student_id <> a.id or v_prev.challenge_id <> c.id then perform public.sp_raise('invalid_field', 'previous_id'); end if;
    v_version := v_prev.version + 1;
  end if;

  insert into public.evidence(challenge_id, assignment_id, student_id, deliverable_id, task_id, title, description, kind, url, storage_path,
    file_name, mime_type, size_bytes, version, previous_id, is_public)
  values (c.id, v_asg.id, a.id, v_deliverable, v_task, public.sp_text(p, 'title', 2, 160), public.sp_text(p, 'description', 0, 2000), v_kind,
    v_url, v_path, v_file, v_mime, v_size, v_version, v_previous,
    public.sp_bool(p, 'is_public', false) and c.publication_policy = 'public_allowed')
  returning id into v_id;
  insert into public.evidence_competencies(evidence_id, competency_id) select v_id, x from unnest(v_comps) x;
  perform public.sp_audit('evidence_added', 'evidence', v_id, c.organization_id, c.id, a.id, '{}'::jsonb,
    jsonb_build_object('title', public.sp_text(p, 'title', 2, 160), 'kind', v_kind, 'version', v_version));
  return jsonb_build_object('id', v_id);
end $$;

create function public.sp_update_evidence(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); e public.evidence; c public.challenges; v_comps uuid[] := public.sp_uuid_array(p, 'competency_ids', 10);
  v_deliverable uuid := public.sp_uuid(p, 'deliverable_id', false); v_task uuid := public.sp_uuid(p, 'task_id', false);
begin
  select * into e from public.evidence where id = public.sp_uuid(p, 'id') for update;
  if not found or e.student_id <> a.id then perform public.sp_forbidden(); end if;
  if e.status not in ('draft','reviewed') then perform public.sp_raise('evidence_locked'); end if;
  perform public.sp_student_assignment(e.challenge_id);
  select * into c from public.challenges where id = e.challenge_id;
  if v_deliverable is not null and not exists(select 1 from public.challenge_deliverables where id = v_deliverable and challenge_id = c.id) then
    perform public.sp_raise('invalid_field', 'deliverable_id');
  end if;
  if v_task is not null and not exists(select 1 from public.tasks where id = v_task and challenge_id = c.id) then
    perform public.sp_raise('invalid_field', 'task_id');
  end if;
  if exists(select 1 from unnest(v_comps) x where not exists(select 1 from public.challenge_competencies cc where cc.challenge_id = c.id and cc.competency_id = x)) then
    perform public.sp_raise('invalid_field', 'competency_ids');
  end if;
  update public.evidence set title = public.sp_text(p, 'title', 2, 160), description = public.sp_text(p, 'description', 0, 2000),
    deliverable_id = v_deliverable, task_id = v_task, status = 'draft',
    is_public = public.sp_bool(p, 'is_public', e.is_public) and c.publication_policy = 'public_allowed'
  where id = e.id;
  delete from public.evidence_competencies where evidence_id = e.id;
  insert into public.evidence_competencies(evidence_id, competency_id) select e.id, x from unnest(v_comps) x;
  perform public.sp_audit('evidence_updated', 'evidence', e.id, c.organization_id, c.id, a.id, jsonb_build_object('status', e.status), jsonb_build_object('status', 'draft'));
  return jsonb_build_object('id', e.id);
end $$;

create function public.sp_delete_evidence(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); e public.evidence;
begin
  select * into e from public.evidence where id = public.sp_uuid(p, 'id') for update;
  if not found or e.student_id <> a.id then perform public.sp_forbidden(); end if;
  if e.status <> 'draft' then perform public.sp_raise('evidence_locked'); end if;
  if exists(select 1 from public.vath_entry_evidence ve join public.vath_entries v on v.id = ve.vath_entry_id
            where ve.evidence_id = e.id and v.status <> 'draft') then
    perform public.sp_raise('evidence_in_use');
  end if;
  if exists(select 1 from public.evidence where previous_id = e.id) then perform public.sp_raise('evidence_in_use'); end if;
  delete from public.evidence where id = e.id;
  perform public.sp_audit('evidence_deleted', 'evidence', e.id, null, e.challenge_id, a.id, jsonb_build_object('title', e.title));
  return jsonb_build_object('id', e.id, 'storage_path', e.storage_path);
end $$;

create function public.sp_set_evidence_visibility(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); e public.evidence; v_public boolean := public.sp_bool(p, 'is_public', false);
begin
  select * into e from public.evidence where id = public.sp_uuid(p, 'id') for update;
  if not found or e.student_id <> a.id then perform public.sp_forbidden(); end if;
  if v_public and not exists(select 1 from public.challenges where id = e.challenge_id and publication_policy = 'public_allowed') then
    perform public.sp_raise('publication_not_allowed');
  end if;
  update public.evidence set is_public = v_public where id = e.id;
  perform public.sp_audit('evidence_visibility_changed', 'evidence', e.id, null, e.challenge_id, a.id,
    jsonb_build_object('is_public', e.is_public), jsonb_build_object('is_public', v_public));
  return jsonb_build_object('id', e.id, 'is_public', v_public);
end $$;

-- ---------------------------------------------------------------------------
-- VATH entries
-- ---------------------------------------------------------------------------
create function public.sp_save_vath(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.profiles := public.sp_actor(); v public.vath_entries; v_asg public.assignments; c public.challenges;
  v_id uuid := public.sp_uuid(p, 'id', false); v_date date := public.sp_date(p, 'activity_date');
  v_activity text := public.sp_text(p, 'activity', 3, 160); v_hours numeric := public.sp_num(p, 'hours', 0.25, 16);
  v_task uuid := public.sp_uuid(p, 'task_id', false); v_evidence uuid[] := public.sp_uuid_array(p, 'evidence_ids', 10); v_day numeric;
begin
  if a.role <> 'student' then perform public.sp_forbidden('students_only'); end if;
  if v_id is not null then
    select * into v from public.vath_entries where id = v_id for update;
    if not found or v.student_id <> a.id then perform public.sp_forbidden(); end if;
    if v.status <> 'draft' then perform public.sp_raise('vath_locked'); end if;
    v_asg := public.sp_student_assignment(v.challenge_id);
  else
    v_asg := public.sp_student_assignment(public.sp_uuid(p, 'challenge_id'));
  end if;
  select * into c from public.challenges where id = v_asg.challenge_id;

  if v_date > current_date then perform public.sp_raise('vath_future_date', 'activity_date'); end if;
  if c.start_date is not null and v_date < c.start_date - 14 then perform public.sp_raise('vath_outside_challenge', 'activity_date'); end if;
  if v_task is not null and not exists(select 1 from public.tasks where id = v_task and challenge_id = c.id) then
    perform public.sp_raise('invalid_field', 'task_id');
  end if;
  if exists(select 1 from unnest(v_evidence) x where not exists(
      select 1 from public.evidence e where e.id = x and e.student_id = a.id and e.challenge_id = c.id and e.status <> 'rejected')) then
    perform public.sp_raise('invalid_field', 'evidence_ids');
  end if;
  select coalesce(sum(submitted_hours), 0) into v_day from public.vath_entries
    where student_id = a.id and activity_date = v_date and status <> 'rejected' and id is distinct from v_id;
  if v_day + v_hours > 16 then perform public.sp_raise('vath_daily_limit', 'hours'); end if;
  if exists(select 1 from public.vath_entries where assignment_id = v_asg.id and activity_date = v_date
            and lower(btrim(activity)) = lower(v_activity) and status <> 'rejected' and id is distinct from v_id) then
    perform public.sp_raise('vath_duplicate', 'activity');
  end if;

  if v_id is null then
    insert into public.vath_entries(challenge_id, assignment_id, student_id, task_id, activity_date, activity, description, submitted_hours)
    values (c.id, v_asg.id, a.id, v_task, v_date, v_activity, public.sp_text(p, 'description', 10, 2000), v_hours)
    returning * into v;
  else
    update public.vath_entries set task_id = v_task, activity_date = v_date, activity = v_activity,
      description = public.sp_text(p, 'description', 10, 2000), submitted_hours = v_hours
    where id = v_id returning * into v;
  end if;
  delete from public.vath_entry_evidence where vath_entry_id = v.id;
  insert into public.vath_entry_evidence(vath_entry_id, evidence_id) select v.id, x from unnest(v_evidence) x;
  perform public.sp_audit('vath_saved', 'vath_entry', v.id, c.organization_id, c.id, a.id, '{}'::jsonb,
    jsonb_build_object('hours', v_hours, 'activity_date', v_date));
  return jsonb_build_object('id', v.id);
end $$;

create function public.sp_delete_vath(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); v public.vath_entries;
begin
  select * into v from public.vath_entries where id = public.sp_uuid(p, 'id') for update;
  if not found or v.student_id <> a.id then perform public.sp_forbidden(); end if;
  if v.status <> 'draft' then perform public.sp_raise('vath_locked'); end if;
  delete from public.vath_entries where id = v.id;
  perform public.sp_audit('vath_deleted', 'vath_entry', v.id, null, v.challenge_id, a.id, jsonb_build_object('hours', v.submitted_hours));
  return jsonb_build_object('id', v.id);
end $$;

-- ---------------------------------------------------------------------------
-- Validation
-- ---------------------------------------------------------------------------
create function public.sp_submit_for_validation(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.profiles := public.sp_actor(); v_asg public.assignments; c public.challenges; v_req uuid;
  v_vath uuid[]; v_evidence uuid[]; v_hours numeric; v_note text := public.sp_text(p, 'note', 0, 1000); v_missing text;
begin
  if a.role <> 'student' then perform public.sp_forbidden('students_only'); end if;
  v_asg := public.sp_student_assignment(public.sp_uuid(p, 'challenge_id'));
  select * into c from public.challenges where id = v_asg.challenge_id;
  select coalesce(array_agg(id), '{}'), coalesce(sum(submitted_hours), 0) into v_vath, v_hours
    from public.vath_entries where assignment_id = v_asg.id and status = 'draft';
  select coalesce(array_agg(id), '{}') into v_evidence from public.evidence where assignment_id = v_asg.id and status = 'draft';
  if cardinality(v_vath) = 0 and cardinality(v_evidence) = 0 then perform public.sp_raise('nothing_to_submit'); end if;

  -- Hours are only reviewable when backed by evidence.
  select v.activity into v_missing from public.vath_entries v
    where v.id = any(v_vath) and not exists(select 1 from public.vath_entry_evidence ve join public.evidence e on e.id = ve.evidence_id
      where ve.vath_entry_id = v.id and e.status <> 'rejected') limit 1;
  if v_missing is not null then perform public.sp_raise('vath_requires_evidence', v_missing); end if;

  select id into v_req from public.validation_requests where assignment_id = v_asg.id and status = 'pending' for update;
  if v_req is null then
    insert into public.validation_requests(challenge_id, assignment_id, student_id, supervisor_id, student_note)
    values (c.id, v_asg.id, a.id, c.supervisor_id, v_note) returning id into v_req;
  elsif v_note <> '' then
    update public.validation_requests set student_note = v_note where id = v_req;
  end if;
  insert into public.validation_request_items(request_id, item_type, item_id)
    select v_req, 'vath', x from unnest(v_vath) x union all select v_req, 'evidence', x from unnest(v_evidence) x
    on conflict do nothing;
  update public.vath_entries set status = 'submitted', submitted_at = now() where id = any(v_vath);
  update public.evidence set status = 'submitted', submitted_at = now() where id = any(v_evidence);

  perform public.sp_notify_reviewers(c.id, 'validation_requested',
    jsonb_build_object('student', a.full_name, 'challenge', c.title, 'hours', v_hours), '/validations/' || v_req);
  perform public.sp_audit('validation_requested', 'validation_request', v_req, c.organization_id, c.id, a.id, '{}'::jsonb,
    jsonb_build_object('vath_entries', cardinality(v_vath), 'evidence', cardinality(v_evidence), 'hours', v_hours));
  return jsonb_build_object('request_id', v_req, 'vath_count', cardinality(v_vath), 'evidence_count', cardinality(v_evidence), 'hours', v_hours);
end $$;

create function public.sp_complete_validation(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.profiles := public.sp_actor(); r public.validation_requests; c public.challenges; v_asg public.assignments;
  s public.profiles; o public.organizations; v_item record; d jsonb; v_decision text; v_comment text; v_hours numeric; v_status text;
  v_ok int := 0; v_bad int := 0; v_changes int := 0; v_added numeric := 0; v_outcome text; v_comp uuid; v_level int;
  v_issue boolean := public.sp_bool(p, 'issue_credential', false); v_summary text := public.sp_text(p, 'summary_comment', 0, 2000);
  v_total numeric; v_cred uuid; v_code text; v_snapshot jsonb;
begin
  select * into r from public.validation_requests where id = public.sp_uuid(p, 'request_id') for update;
  if not found then perform public.sp_raise('not_found'); end if;
  if not public.sp_can_review_challenge(r.challenge_id) then perform public.sp_forbidden(); end if;
  if r.student_id = a.id then perform public.sp_forbidden('self_validation'); end if;
  if r.status <> 'pending' then perform public.sp_raise('request_closed'); end if;
  foreach v_decision in array array['vath','evidence','competencies'] loop
    if p ? v_decision and jsonb_typeof(p->v_decision) <> 'array' then perform public.sp_raise('invalid_field', v_decision); end if;
  end loop;
  select * into c from public.challenges where id = r.challenge_id;
  select * into v_asg from public.assignments where id = r.assignment_id for update;
  select * into s from public.profiles where id = r.student_id;
  select * into o from public.organizations where id = c.organization_id;

  -- 1. Hours: verify, adjust (with justification) or reject (with justification).
  for v_item in select v.* from public.vath_entries v join public.validation_request_items i on i.item_id = v.id and i.item_type = 'vath'
                where i.request_id = r.id and v.status = 'submitted' order by v.activity_date loop
    select value into d from jsonb_array_elements(coalesce(p->'vath', '[]'::jsonb)) where value->>'id' = v_item.id::text limit 1;
    if d is null then perform public.sp_raise('missing_decision', v_item.id::text); end if;
    v_decision := public.sp_choice(d, 'decision', array['verify','adjust','reject']);
    v_comment := public.sp_text(d, 'comment', 0, 2000);
    if v_decision = 'verify' then
      v_hours := v_item.submitted_hours; v_status := 'verified'; v_ok := v_ok + 1;
    elsif v_decision = 'adjust' then
      v_hours := public.sp_num(d, 'verified_hours', 0, 16);
      if v_hours >= v_item.submitted_hours then perform public.sp_raise('adjust_must_reduce', v_item.id::text); end if;
      if char_length(v_comment) < 5 then perform public.sp_raise('comment_required', v_item.id::text); end if;
      v_status := 'adjusted'; v_ok := v_ok + 1;
    else
      if char_length(v_comment) < 5 then perform public.sp_raise('comment_required', v_item.id::text); end if;
      v_hours := 0; v_status := 'rejected'; v_bad := v_bad + 1;
    end if;
    v_added := v_added + v_hours;
    update public.vath_entries set status = v_status, verified_hours = v_hours, validated_by = a.id, validated_at = now(),
      validation_comment = v_comment where id = v_item.id;
    insert into public.validation_decisions(request_id, item_type, item_id, decision, previous_value, new_value, comment, decided_by)
    values (r.id, 'vath', v_item.id, v_status, jsonb_build_object('status', 'submitted', 'submitted_hours', v_item.submitted_hours),
      jsonb_build_object('status', v_status, 'verified_hours', v_hours), v_comment, a.id);
  end loop;

  -- 2. Evidence: approve, request changes or reject.
  for v_item in select e.* from public.evidence e join public.validation_request_items i on i.item_id = e.id and i.item_type = 'evidence'
                where i.request_id = r.id and e.status = 'submitted' order by e.created_at loop
    select value into d from jsonb_array_elements(coalesce(p->'evidence', '[]'::jsonb)) where value->>'id' = v_item.id::text limit 1;
    if d is null then perform public.sp_raise('missing_decision', v_item.id::text); end if;
    v_decision := public.sp_choice(d, 'decision', array['approve','request_changes','reject']);
    v_comment := public.sp_text(d, 'comment', 0, 2000);
    if v_decision <> 'approve' and char_length(v_comment) < 5 then perform public.sp_raise('comment_required', v_item.id::text); end if;
    v_status := case v_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'reviewed' end;
    if v_decision = 'approve' then v_ok := v_ok + 1; elsif v_decision = 'reject' then v_bad := v_bad + 1; else v_changes := v_changes + 1; end if;
    update public.evidence set status = v_status, reviewed_by = a.id, reviewed_at = now(), review_comment = v_comment where id = v_item.id;
    insert into public.validation_decisions(request_id, item_type, item_id, decision, previous_value, new_value, comment, decided_by)
    values (r.id, 'evidence', v_item.id, case v_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'changes_requested' end,
      jsonb_build_object('status', 'submitted'), jsonb_build_object('status', v_status), v_comment, a.id);
  end loop;

  -- 3. Competency rubric (1-5). Only competencies defined for the challenge.
  for d in select value from jsonb_array_elements(coalesce(p->'competencies', '[]'::jsonb)) loop
    v_comp := public.sp_uuid(d, 'competency_id');
    v_level := public.sp_int(d, 'level', 1, 5);
    if not exists(select 1 from public.challenge_competencies where challenge_id = c.id and competency_id = v_comp) then
      perform public.sp_raise('invalid_field', 'competencies');
    end if;
    if exists(select 1 from public.competency_assessments where request_id = r.id and competency_id = v_comp) then
      perform public.sp_raise('duplicate_competency', 'competencies');
    end if;
    insert into public.competency_assessments(request_id, challenge_id, assignment_id, student_id, competency_id, level, comment, assessor_id)
    values (r.id, c.id, v_asg.id, r.student_id, v_comp, v_level, public.sp_text(d, 'comment', 0, 1000), a.id);
  end loop;

  v_outcome := case
    when v_ok > 0 and v_bad = 0 and v_changes = 0 then 'approved'
    when v_ok > 0 then 'partially_approved'
    when v_changes > 0 then 'changes_requested'
    else 'rejected' end;
  update public.validation_requests set status = 'completed', outcome = v_outcome, summary_comment = v_summary,
    completed_by = a.id, completed_at = now() where id = r.id;

  -- 4. Optional: confirm the experience and issue the SkillPass credential.
  if v_issue then
    if v_asg.status <> 'active' then perform public.sp_raise('assignment_not_active'); end if;
    select coalesce(sum(verified_hours), 0) into v_total from public.vath_entries where assignment_id = v_asg.id and status in ('verified','adjusted');
    if v_total <= 0 then perform public.sp_raise('credential_requires_hours'); end if;
    if not exists(select 1 from public.competency_assessments where assignment_id = v_asg.id) then
      perform public.sp_raise('credential_requires_assessment');
    end if;
    v_code := public.sp_new_credential_code();
    v_snapshot := public.sp_build_credential_snapshot(v_asg.id, a.id);
    insert into public.credentials(code, student_id, challenge_id, assignment_id, organization_id, request_id, issued_by, snapshot, is_demo)
    values (v_code, r.student_id, c.id, v_asg.id, c.organization_id, r.id, a.id, v_snapshot, c.is_demo or s.is_demo)
    returning id into v_cred;
    update public.assignments set status = 'completed', completed_at = now() where id = v_asg.id;
    update public.validation_requests set issued_credential_id = v_cred where id = r.id;
    insert into public.validation_decisions(request_id, item_type, item_id, decision, previous_value, new_value, comment, decided_by)
    values (r.id, 'assignment', v_asg.id, 'credential_issued', jsonb_build_object('status', 'active'),
      jsonb_build_object('status', 'completed', 'credential_code', v_code, 'verified_hours', v_total), v_summary, a.id);
    perform public.sp_notify(r.student_id, 'credential_issued', jsonb_build_object('challenge', c.title, 'code', v_code), '/my-skillpass');
    perform public.sp_audit('credential_issued', 'credential', v_cred, c.organization_id, c.id, r.student_id, '{}'::jsonb,
      jsonb_build_object('code', v_code, 'verified_hours', v_total));
  end if;

  perform public.sp_notify(r.student_id, 'validation_completed', jsonb_build_object('challenge', c.title, 'outcome', v_outcome, 'hours', v_added),
    '/workspace/' || c.id || '?tab=validation');
  perform public.sp_audit('validation_completed', 'validation_request', r.id, c.organization_id, c.id, r.student_id,
    jsonb_build_object('status', 'pending'), jsonb_build_object('outcome', v_outcome, 'verified_hours', v_added, 'credential', v_code));
  return jsonb_build_object('outcome', v_outcome, 'verified_hours', v_added, 'credential_code', v_code);
end $$;

-- ---------------------------------------------------------------------------
-- Credentials
-- ---------------------------------------------------------------------------
create function public.sp_set_credential_verification(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); v public.credentials; v_enabled boolean := public.sp_bool(p, 'enabled', true);
begin
  select * into v from public.credentials where id = public.sp_uuid(p, 'credential_id') for update;
  if not found or v.student_id <> a.id then perform public.sp_forbidden(); end if;
  update public.credentials set verification_enabled = v_enabled where id = v.id;
  perform public.sp_audit('credential_verification_toggled', 'credential', v.id, v.organization_id, v.challenge_id, a.id,
    jsonb_build_object('verification_enabled', v.verification_enabled), jsonb_build_object('verification_enabled', v_enabled));
  return jsonb_build_object('id', v.id, 'verification_enabled', v_enabled);
end $$;

create function public.sp_revoke_credential(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); v public.credentials; v_reason text := public.sp_text(p, 'reason', 5, 1000);
begin
  if not public.sp_is_admin() then perform public.sp_forbidden('admin_only'); end if;
  select * into v from public.credentials where id = public.sp_uuid(p, 'credential_id') for update;
  if not found then perform public.sp_raise('not_found'); end if;
  if v.status <> 'active' then perform public.sp_raise('credential_not_active'); end if;
  update public.credentials set status = 'revoked', revoked_at = now(), revoked_by = a.id, revocation_reason = v_reason where id = v.id;
  perform public.sp_notify(v.student_id, 'credential_revoked', jsonb_build_object('code', v.code), '/my-skillpass');
  perform public.sp_audit('credential_revoked', 'credential', v.id, v.organization_id, v.challenge_id, v.student_id,
    jsonb_build_object('status', 'active'), jsonb_build_object('status', 'revoked', 'reason', v_reason));
  return jsonb_build_object('id', v.id);
end $$;

-- ---------------------------------------------------------------------------
-- AINDEV administration
-- ---------------------------------------------------------------------------
create function public.sp_admin_set_org_status(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.organizations; v_status text := public.sp_choice(p, 'status', array['pending','verified','rejected']); v_owner uuid;
begin
  perform public.sp_actor();
  if not public.sp_is_admin() then perform public.sp_forbidden('admin_only'); end if;
  select * into o from public.organizations where id = public.sp_uuid(p, 'organization_id') for update;
  if not found then perform public.sp_raise('not_found'); end if;
  update public.organizations set verification_status = v_status, verified_at = case when v_status = 'verified' then now() else null end where id = o.id;
  for v_owner in select user_id from public.organization_members where organization_id = o.id and member_role in ('owner','manager') loop
    perform public.sp_notify(v_owner, 'organization_status', jsonb_build_object('organization', o.name, 'status', v_status), '/organization');
  end loop;
  perform public.sp_audit('organization_status_changed', 'organization', o.id, o.id, null, null,
    jsonb_build_object('status', o.verification_status), jsonb_build_object('status', v_status));
  return jsonb_build_object('id', o.id, 'status', v_status);
end $$;

create function public.sp_admin_set_user_role(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); t public.profiles; v_role text := public.sp_choice(p, 'role', array['student','company','supervisor','university']);
begin
  if not public.sp_is_admin() then perform public.sp_forbidden('admin_only'); end if;
  select * into t from public.profiles where id = public.sp_uuid(p, 'user_id') for update;
  if not found then perform public.sp_raise('not_found'); end if;
  if t.id = a.id or t.role = 'admin' then perform public.sp_forbidden('admin_role_protected'); end if;
  update public.profiles set role = v_role where id = t.id;
  perform public.sp_audit('user_role_changed', 'profile', t.id, null, null, t.id, jsonb_build_object('role', t.role), jsonb_build_object('role', v_role));
  return jsonb_build_object('id', t.id, 'role', v_role);
end $$;

create function public.sp_admin_set_member(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.organizations; t public.profiles; v_role text := public.sp_choice(p, 'member_role', array['owner','manager','supervisor','staff']);
begin
  perform public.sp_actor();
  if not public.sp_is_admin() then perform public.sp_forbidden('admin_only'); end if;
  select * into o from public.organizations where id = public.sp_uuid(p, 'organization_id');
  select * into t from public.profiles where id = public.sp_uuid(p, 'user_id');
  if o.id is null or t.id is null then perform public.sp_raise('not_found'); end if;
  if t.role = 'student' then perform public.sp_raise('user_role_incompatible'); end if;
  insert into public.organization_members(organization_id, user_id, member_role) values (o.id, t.id, v_role)
    on conflict (organization_id, user_id) do update set member_role = excluded.member_role;
  perform public.sp_audit('member_set', 'organization', o.id, o.id, null, t.id, '{}'::jsonb, jsonb_build_object('member_role', v_role));
  return jsonb_build_object('ok', true);
end $$;

create function public.sp_admin_save_competency(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid := public.sp_uuid(p, 'id', false); v_slug text := public.sp_slugify(public.sp_text(p, 'slug', 2, 60));
begin
  perform public.sp_actor();
  if not public.sp_is_admin() then perform public.sp_forbidden('admin_only'); end if;
  if v_id is null then
    insert into public.competencies(slug, name_es, name_en, category, description_es, description_en, is_active)
    values (v_slug, public.sp_text(p, 'name_es', 2, 80), public.sp_text(p, 'name_en', 2, 80),
      public.sp_choice(p, 'category', array['technical','digital','business','human']), public.sp_text(p, 'description_es', 0, 400),
      public.sp_text(p, 'description_en', 0, 400), public.sp_bool(p, 'is_active', true))
    returning id into v_id;
  else
    update public.competencies set slug = v_slug, name_es = public.sp_text(p, 'name_es', 2, 80), name_en = public.sp_text(p, 'name_en', 2, 80),
      category = public.sp_choice(p, 'category', array['technical','digital','business','human']),
      description_es = public.sp_text(p, 'description_es', 0, 400), description_en = public.sp_text(p, 'description_en', 0, 400),
      is_active = public.sp_bool(p, 'is_active', true)
    where id = v_id;
    if not found then perform public.sp_raise('not_found'); end if;
  end if;
  perform public.sp_audit('competency_saved', 'competency', v_id, null, null, null, '{}'::jsonb, jsonb_build_object('slug', v_slug));
  return jsonb_build_object('id', v_id);
end $$;

create function public.sp_report_incident(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); v_id uuid;
begin
  if (select count(*) from public.incidents where reported_by = a.id and created_at > now() - interval '1 hour') >= 10 then
    perform public.sp_raise('rate_limited');
  end if;
  insert into public.incidents(reported_by, entity_type, entity_id, category, description)
  values (a.id, public.sp_choice(p, 'entity_type', array['credential','evidence','challenge','profile','validation','other'], 'other'),
    public.sp_uuid(p, 'entity_id', false), public.sp_choice(p, 'category', array['incorrect_data','misconduct','privacy','suspected_fraud','technical','other']),
    public.sp_text(p, 'description', 10, 2000))
  returning id into v_id;
  perform public.sp_audit('incident_reported', 'incident', v_id, null, null, a.id);
  return jsonb_build_object('id', v_id);
end $$;

create function public.sp_admin_update_incident(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); i public.incidents; v_status text := public.sp_choice(p, 'status', array['open','investigating','resolved','dismissed']);
begin
  if not public.sp_is_admin() then perform public.sp_forbidden('admin_only'); end if;
  select * into i from public.incidents where id = public.sp_uuid(p, 'incident_id') for update;
  if not found then perform public.sp_raise('not_found'); end if;
  update public.incidents set status = v_status, resolution = public.sp_text(p, 'resolution', 0, 2000), handled_by = a.id, handled_at = now() where id = i.id;
  perform public.sp_audit('incident_updated', 'incident', i.id, null, null, i.reported_by, jsonb_build_object('status', i.status), jsonb_build_object('status', v_status));
  return jsonb_build_object('id', i.id);
end $$;

create function public.sp_mark_notifications_read(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); v_ids uuid[] := public.sp_uuid_array(p, 'ids', 200); v_count int;
begin
  update public.notifications set read_at = now()
  where user_id = a.id and read_at is null and (public.sp_bool(p, 'all', false) or id = any(v_ids));
  get diagnostics v_count = row_count;
  return jsonb_build_object('updated', v_count);
end $$;
