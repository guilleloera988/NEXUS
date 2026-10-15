-- SkillPass — required fields requested in the product feedback of 15 Oct 2026
-- (docs/STATUS.md, «Retroalimentación»).
--
-- 1. Evidence names the task it belongs to, and the deliverable whenever the challenge has
--    deliverables (sp_add_evidence, sp_update_evidence). Raises sp:field_required with the field.
-- 2. A company has a website (https) when it is created at onboarding and whenever its profile is
--    saved (sp_complete_onboarding, sp_update_organization). Universities keep it optional.
-- 3. A challenge opens (draft -> published, or any move into recruiting) only when complete:
--    summary, description, industry, location (unless remote), participation conditions,
--    competencies, deliverables, supervisor and both dates. A challenge that is no longer a draft
--    must stay complete when edited (sp_save_challenge). sp_challenge_publish_missing(challenge)
--    lists the missing items in that fixed order; sp_raise reports the first one. Text made only of
--    whitespace counts as empty, with the same character set as the app (JS \s plus U+0085 and
--    U+200B), independent of the database locale.
--    src/lib/challenge-readiness.ts mirrors the list for the form and the challenge page.
-- Drafts can still be saved incomplete. Rows already stored are not checked until they change.
-- The functions below are the definitions of 20261002000003 with only these checks added;
-- CREATE OR REPLACE keeps their owners and EXECUTE grants.

create function public.sp_challenge_publish_missing(c public.challenges) returns text[]
language sql stable security definer set search_path = public, pg_temp as $$
  select array_remove(array[
    case when coalesce(c.summary, '') !~ '[^[:space:]\u0085\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]' then 'summary' end,
    case when coalesce(c.description, '') !~ '[^[:space:]\u0085\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]' then 'description' end,
    case when coalesce(c.industry, '') !~ '[^[:space:]\u0085\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]' then 'industry' end,
    case when c.modality <> 'remote' and coalesce(c.location, '') !~ '[^[:space:]\u0085\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]' then 'location' end,
    case when coalesce(c.conditions, '') !~ '[^[:space:]\u0085\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]' then 'conditions' end,
    case when not exists(select 1 from public.challenge_competencies cc where cc.challenge_id = c.id) then 'competencies' end,
    case when not exists(select 1 from public.challenge_deliverables cd where cd.challenge_id = c.id) then 'deliverables' end,
    case when c.supervisor_id is null then 'supervisor_id' end,
    case when c.start_date is null or c.end_date is null then 'start_date' end
  ]::text[], null)
$$;
revoke all on function public.sp_challenge_publish_missing(public.challenges) from public, anon, authenticated;

create or replace function public.sp_set_challenge_status(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c public.challenges; v_new text := public.sp_choice(p, 'status', array['draft','published','recruiting','active','under_review','completed','archived']);
  v_allowed text[]; v_participant uuid; v_missing text[];
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
  end if;
  -- Opening a challenge needs every publish item: draft -> published, and any move into recruiting, so a
  -- challenge stored before these rules cannot open its call while incomplete.
  if v_new = 'recruiting' or (c.status = 'draft' and v_new = 'published') then
    v_missing := public.sp_challenge_publish_missing(c);
    if cardinality(v_missing) > 0 then perform public.sp_raise('challenge_incomplete', v_missing[1]); end if;
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

create or replace function public.sp_save_challenge(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.profiles := public.sp_actor(); c public.challenges; v_id uuid := public.sp_uuid(p, 'id', false); v_org uuid;
  v_supervisor uuid := public.sp_uuid(p, 'supervisor_id', false); v_start date := public.sp_date(p, 'start_date', false);
  v_end date := public.sp_date(p, 'end_date', false); v_comp_type text; v_vath numeric; v_item jsonb; v_comp uuid; v_level int;
  v_comp_ids uuid[] := '{}'; v_del_ids uuid[] := '{}'; v_del uuid; v_ord int := 0; v_missing text[];
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

  -- A challenge that left draft must stay as complete as publishing required.
  if c.status <> 'draft' then
    v_missing := public.sp_challenge_publish_missing(c);
    if cardinality(v_missing) > 0 then perform public.sp_raise('challenge_incomplete', v_missing[1]); end if;
  end if;

  perform public.sp_audit(case when v_id is null then 'challenge_created' else 'challenge_updated' end, 'challenge', c.id, v_org, c.id, null,
    '{}'::jsonb, jsonb_build_object('title', c.title, 'status', c.status));
  return jsonb_build_object('id', c.id);
end $$;

create or replace function public.sp_add_evidence(p jsonb) returns jsonb
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
  if v_task is null then perform public.sp_raise('field_required', 'task_id'); end if;
  if v_deliverable is null and exists(select 1 from public.challenge_deliverables where challenge_id = c.id) then
    perform public.sp_raise('field_required', 'deliverable_id');
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

create or replace function public.sp_update_evidence(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); e public.evidence; c public.challenges; v_comps uuid[] := public.sp_uuid_array(p, 'competency_ids', 10);
  v_deliverable uuid := public.sp_uuid(p, 'deliverable_id', false); v_task uuid := public.sp_uuid(p, 'task_id', false);
begin
  select * into e from public.evidence where id = public.sp_uuid(p, 'id') for update;
  if not found or e.student_id <> a.id then perform public.sp_forbidden(); end if;
  if e.status not in ('draft','reviewed') then perform public.sp_raise('evidence_locked'); end if;
  perform public.sp_student_assignment(e.challenge_id);
  select * into c from public.challenges where id = e.challenge_id;
  if v_task is null then perform public.sp_raise('field_required', 'task_id'); end if;
  if v_deliverable is null and exists(select 1 from public.challenge_deliverables where challenge_id = c.id) then
    perform public.sp_raise('field_required', 'deliverable_id');
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
  update public.evidence set title = public.sp_text(p, 'title', 2, 160), description = public.sp_text(p, 'description', 0, 2000),
    deliverable_id = v_deliverable, task_id = v_task, status = 'draft',
    is_public = public.sp_bool(p, 'is_public', e.is_public) and c.publication_policy = 'public_allowed'
  where id = e.id;
  delete from public.evidence_competencies where evidence_id = e.id;
  insert into public.evidence_competencies(evidence_id, competency_id) select e.id, x from unnest(v_comps) x;
  perform public.sp_audit('evidence_updated', 'evidence', e.id, c.organization_id, c.id, a.id, jsonb_build_object('status', e.status), jsonb_build_object('status', 'draft'));
  return jsonb_build_object('id', e.id);
end $$;

create or replace function public.sp_complete_onboarding(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); v_org uuid; v_kind text; v_name text; v_website text;
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
      v_website := public.sp_text(p, 'website', 0, 300);
      if v_kind = 'company' and v_website = '' then perform public.sp_raise('field_required', 'website'); end if;
      if v_website <> '' and v_website !~ '^https://[^[:space:]@]+$' then perform public.sp_raise('invalid_field', 'website'); end if;
      insert into public.organizations(kind, name, slug, industry, size, location, website, description, needs, campus, programs, created_by, is_demo)
      values (v_kind, v_name, left(public.sp_slugify(v_name), 80) || '-' || lower(public.sp_random_hex(4)),
        case when v_kind = 'company' then public.sp_text(p, 'industry', 0, 60) else 'education' end,
        case when v_kind = 'company' then public.sp_choice(p, 'size', array['','1-10','11-50','51-200','201-1000','1000+'], '') else '' end,
        public.sp_text(p, 'location', 0, 120),
        v_website,
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

create or replace function public.sp_update_organization(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); o public.organizations; v_name text; v_website text;
begin
  select * into o from public.organizations where id = public.sp_uuid(p, 'organization_id') for update;
  if not found or not public.sp_is_org_manager(o.id) then perform public.sp_forbidden(); end if;
  v_name := public.sp_text(p, 'name', 2, 160);
  v_website := public.sp_text(p, 'website', 0, 300);
  if o.kind = 'company' and v_website = '' then perform public.sp_raise('field_required', 'website'); end if;
  if v_website <> '' and v_website !~ '^https://[^[:space:]@]+$' then perform public.sp_raise('invalid_field', 'website'); end if;
  update public.organizations set
    name = v_name,
    industry = public.sp_text(p, 'industry', 0, 60),
    size = public.sp_choice(p, 'size', array['','1-10','11-50','51-200','201-1000','1000+'], ''),
    location = public.sp_text(p, 'location', 0, 120),
    website = v_website,
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
