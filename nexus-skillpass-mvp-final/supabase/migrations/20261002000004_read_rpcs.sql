-- SkillPass — read RPCs.
--
-- Page-shaped queries. Unless marked otherwise they are SECURITY INVOKER, so row
-- level security decides which rows the caller receives. The few SECURITY DEFINER
-- functions return aggregates or deliberately narrowed public data and perform
-- their own authorization checks.

-- Aggregate counters for a challenge card (no personal data).
create function public.sp_challenge_counts(p_challenge uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select case when public.sp_can_view_challenge(p_challenge) then jsonb_build_object(
    'participants', (select count(*) from public.assignments where challenge_id = p_challenge and status in ('active','completed')),
    'applications', (select count(*) from public.applications where challenge_id = p_challenge and status <> 'withdrawn'))
  else null end
$$;

create function public.sp_competency_json(k public.competencies) returns jsonb
language sql immutable set search_path = public, pg_temp as $$
  select jsonb_build_object('id', k.id, 'slug', k.slug, 'name_es', k.name_es, 'name_en', k.name_en, 'category', k.category)
$$;

-- Sanitized activity feed for a workspace: no hours or comments of other students.
create function public.sp_activity_feed(p_challenge uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select case when public.sp_is_participant(p_challenge) or public.sp_can_review_challenge(p_challenge) then (
    select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
      select l.action, l.created_at, pr.full_name as actor_name,
        jsonb_strip_nulls(jsonb_build_object('title', l.after->>'title', 'status', l.after->>'status', 'outcome', l.after->>'outcome')) as details
      from public.audit_logs l left join public.profiles pr on pr.id = l.actor_id
      where l.challenge_id = p_challenge and l.action in ('task_created','task_status_changed','evidence_added','validation_requested',
        'validation_completed','credential_issued','challenge_status_changed','application_decided')
      order by l.created_at desc limit 25) x)
  else '[]'::jsonb end
$$;

create function public.sp_me(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare v jsonb;
begin
  if auth.uid() is null then return null; end if;
  select jsonb_build_object(
    'profile', to_jsonb(pr),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('organization_id', m.organization_id, 'member_role', m.member_role,
        'organization', jsonb_build_object('id', o.id, 'name', o.name, 'kind', o.kind, 'slug', o.slug,
          'verification_status', o.verification_status, 'is_demo', o.is_demo)) order by o.name)
      from public.organization_members m join public.organizations o on o.id = m.organization_id where m.user_id = auth.uid()), '[]'::jsonb),
    'university', (select jsonb_build_object('id', o.id, 'name', o.name, 'verification_status', o.verification_status)
      from public.organizations o where o.id = pr.university_id),
    'unread_notifications', (select count(*) from public.notifications where user_id = auth.uid() and read_at is null),
    'pending_validations', (select count(*) from public.validation_requests r
      where r.status = 'pending' and r.student_id <> auth.uid() and public.sp_can_review_challenge(r.challenge_id)),
    'pending_invitations', (select count(*) from public.invitations i where i.status = 'pending' and i.email = public.sp_auth_email()))
  into v from public.profiles pr where pr.id = auth.uid();
  return v;
end $$;

create function public.sp_lookups(p jsonb default '{}'::jsonb) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'competencies', (select coalesce(jsonb_agg(public.sp_competency_json(k) order by k.category, k.name_en), '[]'::jsonb)
      from public.competencies k where k.is_active),
    'universities', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'campus', o.campus, 'is_demo', o.is_demo) order by o.name), '[]'::jsonb)
      from public.organizations o where o.kind = 'university' and o.verification_status = 'verified'))
$$;

create function public.sp_org_overview(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare v_org uuid := nullif(p->>'organization_id', '')::uuid;
begin
  if v_org is null then
    select m.organization_id into v_org from public.organization_members m where m.user_id = auth.uid()
      order by case m.member_role when 'owner' then 0 when 'manager' then 1 else 2 end limit 1;
  end if;
  if v_org is null or not public.sp_is_org_member(v_org) and not public.sp_is_admin() then return null; end if;
  return (select jsonb_build_object(
    'organization', to_jsonb(o),
    'my_role', (select member_role from public.organization_members where organization_id = o.id and user_id = auth.uid()),
    'can_manage', public.sp_is_org_manager(o.id),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'member_role', m.member_role, 'full_name', pr.full_name,
        'headline', pr.headline, 'role', pr.role) order by pr.full_name), '[]'::jsonb)
      from public.organization_members m join public.profiles pr on pr.id = m.user_id where m.organization_id = o.id),
    'invitations', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'member_role', i.member_role, 'created_at', i.created_at)
        order by i.created_at desc), '[]'::jsonb)
      from public.invitations i where i.organization_id = o.id and i.status = 'pending'))
    from public.organizations o where o.id = v_org);
end $$;

-- ---------------------------------------------------------------------------
-- Student
-- ---------------------------------------------------------------------------
create function public.sp_student_dashboard(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return null; end if;
  return jsonb_build_object(
    'stats', jsonb_build_object(
      'active_challenges', (select count(*) from public.assignments where student_id = v_uid and status = 'active'),
      'completed_challenges', (select count(*) from public.assignments where student_id = v_uid and status = 'completed'),
      'verified_vath', (select coalesce(sum(v.verified_hours), 0) from public.vath_entries v where v.student_id = v_uid and v.status in ('verified','adjusted')
        and not exists(select 1 from public.credentials c where c.assignment_id = v.assignment_id and c.status = 'revoked')),
      'pending_vath', (select coalesce(sum(submitted_hours), 0) from public.vath_entries where student_id = v_uid and status = 'submitted'),
      'draft_vath', (select coalesce(sum(submitted_hours), 0) from public.vath_entries where student_id = v_uid and status = 'draft'),
      'pending_validations', (select count(*) from public.validation_requests where student_id = v_uid and status = 'pending'),
      'verified_competencies', (select count(*) from public.student_verified_competencies where student_id = v_uid),
      'credentials', (select count(*) from public.credentials where student_id = v_uid and status = 'active'),
      'open_applications', (select count(*) from public.applications where student_id = v_uid and status in ('submitted','shortlisted'))),
    'assignments', (select coalesce(jsonb_agg(x order by x.status, x.end_date nulls last), '[]'::jsonb) from (
      select a.id, a.status, a.challenge_id, c.title, c.status as challenge_status, c.end_date, c.estimated_vath, o.name as organization_name,
        (select count(*) from public.tasks t where t.challenge_id = c.id) as tasks_total,
        (select count(*) from public.tasks t where t.challenge_id = c.id and t.status = 'done') as tasks_done,
        (select coalesce(sum(verified_hours), 0) from public.vath_entries v where v.assignment_id = a.id and v.status in ('verified','adjusted')) as verified_hours,
        (select coalesce(sum(submitted_hours), 0) from public.vath_entries v where v.assignment_id = a.id and v.status = 'submitted') as pending_hours,
        (select code from public.credentials cr where cr.assignment_id = a.id and cr.status = 'active') as credential_code
      from public.assignments a join public.challenges c on c.id = a.challenge_id join public.organizations o on o.id = c.organization_id
      where a.student_id = v_uid and a.status in ('active','completed')) x),
    'applications', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
      select ap.id, ap.status, ap.challenge_id, ap.created_at, ap.match_score, ap.decision_note, c.title, o.name as organization_name
      from public.applications ap join public.challenges c on c.id = ap.challenge_id join public.organizations o on o.id = c.organization_id
      where ap.student_id = v_uid and ap.status in ('submitted','shortlisted','rejected') order by ap.created_at desc limit 6) x),
    'recommended', (select coalesce(jsonb_agg(x order by (x.match->>'score')::int desc), '[]'::jsonb) from (
      select c.id, c.title, c.summary, c.duration_weeks, c.modality, c.estimated_vath, o.name as organization_name,
        public.sp_match_score(v_uid, c.id) as match
      from public.challenges c join public.organizations o on o.id = c.organization_id
      where c.status = 'recruiting' and not exists(select 1 from public.applications ap where ap.challenge_id = c.id and ap.student_id = v_uid)
      limit 12) x where (x.match->>'score')::int > 0),
    'progress', (select jsonb_build_object(
      'profile', pr.onboarding_completed and pr.bio <> '' and (select count(*) from public.declared_skills where student_id = v_uid) >= 3,
      'applied', exists(select 1 from public.applications where student_id = v_uid),
      'assigned', exists(select 1 from public.assignments where student_id = v_uid and status in ('active','completed')),
      'evidence', exists(select 1 from public.evidence where student_id = v_uid and status <> 'draft'),
      'hours_verified', exists(select 1 from public.vath_entries where student_id = v_uid and status in ('verified','adjusted')),
      'competency_verified', exists(select 1 from public.student_verified_competencies where student_id = v_uid),
      'credential', exists(select 1 from public.credentials where student_id = v_uid and status = 'active'),
      'public', pr.skillpass_public) from public.profiles pr where pr.id = v_uid),
    'notifications', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
      select id, kind, params, link, read_at, created_at from public.notifications where user_id = v_uid order by created_at desc limit 5) x));
end $$;

-- ---------------------------------------------------------------------------
-- Challenges
-- ---------------------------------------------------------------------------
create function public.sp_challenges(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); v_scope text := coalesce(nullif(p->>'scope', ''), 'discover');
  v_q text := nullif(btrim(coalesce(p->>'q', '')), ''); v_industry text := nullif(p->>'industry', '');
  v_modality text := nullif(p->>'modality', ''); v_comp uuid := nullif(p->>'competency_id', '')::uuid;
  v_status text := nullif(p->>'status', ''); v_student boolean := public.sp_current_role() = 'student';
begin
  if v_uid is null then return null; end if;
  return jsonb_build_object('items', (select coalesce(jsonb_agg(x order by x.sort_key, x.created_at desc), '[]'::jsonb) from (
    select c.id, c.title, c.summary, c.industry, c.modality, c.location, c.duration_weeks, c.start_date, c.end_date, c.max_participants,
      c.estimated_vath, c.status, c.compensation_type, c.tags, c.created_at, c.is_demo,
      jsonb_build_object('id', o.id, 'name', o.name, 'verification_status', o.verification_status) as organization,
      (select coalesce(jsonb_agg(public.sp_competency_json(k) || jsonb_build_object('required_level', cc.required_level) order by k.name_en), '[]'::jsonb)
        from public.challenge_competencies cc join public.competencies k on k.id = cc.competency_id where cc.challenge_id = c.id) as competencies,
      public.sp_challenge_counts(c.id) as counts,
      case when v_student then public.sp_match_score(v_uid, c.id) end as match,
      (select ap.status from public.applications ap where ap.challenge_id = c.id and ap.student_id = v_uid) as my_application,
      (select a.status from public.assignments a where a.challenge_id = c.id and a.student_id = v_uid) as my_assignment,
      (select count(*) from public.validation_requests r where r.challenge_id = c.id and r.status = 'pending') as pending_validations,
      (select count(*) from public.applications ap where ap.challenge_id = c.id and ap.status in ('submitted','shortlisted')) as pending_applications,
      case c.status when 'recruiting' then 0 when 'published' then 1 when 'active' then 2 when 'draft' then 3 else 4 end as sort_key
    from public.challenges c join public.organizations o on o.id = c.organization_id
    where (
        (v_scope = 'discover' and c.status in ('published','recruiting'))
        or (v_scope = 'mine' and public.sp_is_org_member(c.organization_id))
        or (v_scope = 'participating' and exists(select 1 from public.assignments a where a.challenge_id = c.id and a.student_id = v_uid))
        or (v_scope = 'all' and public.sp_is_admin()))
      and (v_status is null or c.status = v_status)
      and (v_q is null or c.title ilike '%' || v_q || '%' or c.summary ilike '%' || v_q || '%' or o.name ilike '%' || v_q || '%')
      and (v_industry is null or c.industry = v_industry)
      and (v_modality is null or c.modality = v_modality)
      and (v_comp is null or exists(select 1 from public.challenge_competencies cc where cc.challenge_id = c.id and cc.competency_id = v_comp))
    limit 200) x));
end $$;

create function public.sp_challenge(p jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); c public.challenges; v_manage boolean; v_review boolean;
begin
  select * into c from public.challenges where id = nullif(p->>'id', '')::uuid;
  if not found then return null; end if;
  v_manage := public.sp_can_manage_challenge(c.id);
  v_review := public.sp_can_review_challenge(c.id);
  return jsonb_build_object(
    'challenge', to_jsonb(c) || jsonb_build_object(
      'organization', (select jsonb_build_object('id', o.id, 'name', o.name, 'industry', o.industry, 'location', o.location, 'website', o.website,
        'description', o.description, 'verification_status', o.verification_status) from public.organizations o where o.id = c.organization_id),
      'supervisor', (select jsonb_build_object('id', pr.id, 'full_name', pr.full_name, 'headline', pr.headline) from public.profiles pr where pr.id = c.supervisor_id)),
    'competencies', (select coalesce(jsonb_agg(public.sp_competency_json(k) || jsonb_build_object('required_level', cc.required_level) order by k.name_en), '[]'::jsonb)
      from public.challenge_competencies cc join public.competencies k on k.id = cc.competency_id where cc.challenge_id = c.id),
    'deliverables', (select coalesce(jsonb_agg(to_jsonb(d) order by d.sort_order), '[]'::jsonb) from public.challenge_deliverables d where d.challenge_id = c.id),
    'counts', public.sp_challenge_counts(c.id),
    'can_manage', v_manage,
    'can_review', v_review,
    'my_application', (select to_jsonb(ap) from public.applications ap where ap.challenge_id = c.id and ap.student_id = v_uid),
    'my_assignment', (select to_jsonb(a) from public.assignments a where a.challenge_id = c.id and a.student_id = v_uid),
    'match', case when public.sp_current_role() = 'student' then public.sp_match_score(v_uid, c.id) end,
    'participants', (select coalesce(jsonb_agg(jsonb_build_object('assignment_id', a.id, 'student_id', a.student_id, 'status', a.status,
        'team_role', a.team_role, 'full_name', pr.full_name, 'career', pr.career) order by pr.full_name), '[]'::jsonb)
      from public.assignments a join public.profiles pr on pr.id = a.student_id
      where a.challenge_id = c.id and a.status in ('active','completed')),
    'applications', case when v_review then (select coalesce(jsonb_agg(x order by x.status_order, x.score desc nulls last, x.created_at), '[]'::jsonb) from (
      select ap.id, ap.status, ap.motivation, ap.availability_note, ap.created_at, ap.decided_at, ap.decision_note,
        coalesce((public.sp_match_score(ap.student_id, c.id)->>'score')::int, ap.match_score) as score,
        coalesce(public.sp_match_score(ap.student_id, c.id), ap.match_breakdown) as match,
        jsonb_build_object('id', pr.id, 'full_name', pr.full_name, 'headline', pr.headline, 'career', pr.career, 'semester', pr.semester,
          'availability', pr.availability, 'hours_per_week', pr.hours_per_week,
          'university', (select name from public.organizations u where u.id = pr.university_id)) as student,
        case ap.status when 'submitted' then 0 when 'shortlisted' then 1 when 'accepted' then 2 when 'rejected' then 3 else 4 end as status_order
      from public.applications ap join public.profiles pr on pr.id = ap.student_id
      where ap.challenge_id = c.id and ap.status <> 'withdrawn') x) else '[]'::jsonb end,
    'decision_history', case when v_manage then (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
      select l.action, l.created_at, l.before, l.after, actor.full_name as actor_name, subj.full_name as subject_name
      from public.audit_logs l left join public.profiles actor on actor.id = l.actor_id left join public.profiles subj on subj.id = l.subject_id
      where l.challenge_id = c.id and l.action in ('application_decided','application_submitted','challenge_status_changed','assignment_ended')
      order by l.created_at desc limit 40) x) else '[]'::jsonb end,
    'org_members', case when v_manage then (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'full_name', pr.full_name,
        'member_role', m.member_role, 'headline', pr.headline) order by pr.full_name), '[]'::jsonb)
      from public.organization_members m join public.profiles pr on pr.id = m.user_id
      where m.organization_id = c.organization_id and m.member_role in ('owner','manager','supervisor')) else '[]'::jsonb end);
end $$;

-- ---------------------------------------------------------------------------
-- Workspace
-- ---------------------------------------------------------------------------
create function public.sp_workspace(p jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); c public.challenges; v_review boolean; v_asg public.assignments;
begin
  select * into c from public.challenges where id = nullif(p->>'challenge_id', '')::uuid;
  if not found then return null; end if;
  v_review := public.sp_can_review_challenge(c.id);
  select * into v_asg from public.assignments where challenge_id = c.id and student_id = v_uid;
  if not v_review and (v_asg.id is null or v_asg.status = 'withdrawn') then
    return jsonb_build_object('forbidden', true);
  end if;
  return jsonb_build_object(
    'role_view', case when v_review then 'reviewer' else 'participant' end,
    'challenge', to_jsonb(c) || jsonb_build_object(
      'organization', (select jsonb_build_object('id', o.id, 'name', o.name, 'verification_status', o.verification_status) from public.organizations o where o.id = c.organization_id),
      'supervisor', (select jsonb_build_object('id', pr.id, 'full_name', pr.full_name, 'headline', pr.headline) from public.profiles pr where pr.id = c.supervisor_id)),
    'competencies', (select coalesce(jsonb_agg(public.sp_competency_json(k) || jsonb_build_object('required_level', cc.required_level) order by k.name_en), '[]'::jsonb)
      from public.challenge_competencies cc join public.competencies k on k.id = cc.competency_id where cc.challenge_id = c.id),
    'deliverables', (select coalesce(jsonb_agg(to_jsonb(d) || jsonb_build_object(
        'evidence_total', (select count(*) from public.evidence e where e.deliverable_id = d.id and (v_review or e.student_id = v_uid or e.status <> 'draft')),
        'evidence_approved', (select count(*) from public.evidence e where e.deliverable_id = d.id and e.status = 'approved')) order by d.sort_order), '[]'::jsonb)
      from public.challenge_deliverables d where d.challenge_id = c.id),
    'tasks', (select coalesce(jsonb_agg(to_jsonb(t) || jsonb_build_object('assignee_name', pr.full_name) order by t.status = 'done', t.due_date nulls last, t.sort_order), '[]'::jsonb)
      from public.tasks t left join public.profiles pr on pr.id = t.assignee_id where t.challenge_id = c.id),
    'team', (select coalesce(jsonb_agg(jsonb_build_object('assignment_id', a.id, 'student_id', a.student_id, 'full_name', pr.full_name, 'career', pr.career,
        'team_role', a.team_role, 'status', a.status, 'is_me', a.student_id = v_uid,
        'verified_hours', case when v_review or a.student_id = v_uid then (select coalesce(sum(verified_hours), 0) from public.vath_entries v
          where v.assignment_id = a.id and v.status in ('verified','adjusted')) end,
        'pending_hours', case when v_review or a.student_id = v_uid then (select coalesce(sum(submitted_hours), 0) from public.vath_entries v
          where v.assignment_id = a.id and v.status = 'submitted') end,
        'credential_code', (select code from public.credentials cr where cr.assignment_id = a.id and cr.status = 'active')) order by pr.full_name), '[]'::jsonb)
      from public.assignments a join public.profiles pr on pr.id = a.student_id where a.challenge_id = c.id and a.status in ('active','completed')),
    'my_assignment', to_jsonb(v_asg),
    'evidence', (select coalesce(jsonb_agg(to_jsonb(e) - 'storage_path' || jsonb_build_object(
        'student_name', pr.full_name, 'is_mine', e.student_id = v_uid, 'has_file', e.storage_path is not null,
        'competency_ids', (select coalesce(jsonb_agg(ec.competency_id), '[]'::jsonb) from public.evidence_competencies ec where ec.evidence_id = e.id))
        order by e.created_at desc), '[]'::jsonb)
      from public.evidence e join public.profiles pr on pr.id = e.student_id where e.challenge_id = c.id),
    'vath', (select coalesce(jsonb_agg(to_jsonb(v) || jsonb_build_object('student_name', pr.full_name, 'is_mine', v.student_id = v_uid,
        'evidence_ids', (select coalesce(jsonb_agg(ve.evidence_id), '[]'::jsonb) from public.vath_entry_evidence ve where ve.vath_entry_id = v.id),
        'validator_name', (select full_name from public.profiles x where x.id = v.validated_by))
        order by v.activity_date desc, v.created_at desc), '[]'::jsonb)
      from public.vath_entries v join public.profiles pr on pr.id = v.student_id where v.challenge_id = c.id),
    'requests', (select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object('student_name', pr.full_name,
        'completed_by_name', (select full_name from public.profiles x where x.id = r.completed_by),
        'items', (select count(*) from public.validation_request_items i where i.request_id = r.id),
        'credential_code', (select code from public.credentials cr where cr.id = r.issued_credential_id)) order by r.created_at desc), '[]'::jsonb)
      from public.validation_requests r join public.profiles pr on pr.id = r.student_id where r.challenge_id = c.id),
    'assessments', (select coalesce(jsonb_agg(jsonb_build_object('id', ca.id, 'competency_id', ca.competency_id, 'level', ca.level, 'comment', ca.comment,
        'created_at', ca.created_at, 'student_id', ca.student_id, 'assessor_name', pr.full_name) order by ca.created_at desc), '[]'::jsonb)
      from public.competency_assessments ca left join public.profiles pr on pr.id = ca.assessor_id where ca.challenge_id = c.id),
    'credential', (select jsonb_build_object('id', cr.id, 'code', cr.code, 'status', cr.status, 'issued_at', cr.issued_at)
      from public.credentials cr where cr.assignment_id = v_asg.id),
    'activity', public.sp_activity_feed(c.id));
end $$;

-- ---------------------------------------------------------------------------
-- Validation
-- ---------------------------------------------------------------------------
create function public.sp_validation_queue(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then return null; end if;
  return jsonb_build_object(
    'pending', (select coalesce(jsonb_agg(x order by x.created_at), '[]'::jsonb) from (
      select r.id, r.created_at, r.student_note, r.challenge_id, c.title as challenge_title,
        jsonb_build_object('id', pr.id, 'full_name', pr.full_name, 'career', pr.career,
          'university', (select name from public.organizations u where u.id = pr.university_id)) as student,
        (select count(*) from public.validation_request_items i where i.request_id = r.id and i.item_type = 'vath') as vath_count,
        (select count(*) from public.validation_request_items i where i.request_id = r.id and i.item_type = 'evidence') as evidence_count,
        (select coalesce(sum(v.submitted_hours), 0) from public.validation_request_items i join public.vath_entries v on v.id = i.item_id
          where i.request_id = r.id and i.item_type = 'vath') as hours
      from public.validation_requests r join public.challenges c on c.id = r.challenge_id join public.profiles pr on pr.id = r.student_id
      where r.status = 'pending' and r.student_id <> auth.uid() and public.sp_can_review_challenge(r.challenge_id)) x),
    'completed', (select coalesce(jsonb_agg(x order by x.completed_at desc), '[]'::jsonb) from (
      select r.id, r.completed_at, r.outcome, c.title as challenge_title, pr.full_name as student_name,
        (select full_name from public.profiles x where x.id = r.completed_by) as completed_by_name,
        (select code from public.credentials cr where cr.id = r.issued_credential_id) as credential_code
      from public.validation_requests r join public.challenges c on c.id = r.challenge_id join public.profiles pr on pr.id = r.student_id
      where r.status = 'completed' and r.student_id <> auth.uid() and public.sp_can_review_challenge(r.challenge_id)
      order by r.completed_at desc limit 15) x));
end $$;

create function public.sp_validation(p jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare r public.validation_requests; c public.challenges;
begin
  select * into r from public.validation_requests where id = nullif(p->>'id', '')::uuid;
  if not found then return null; end if;
  select * into c from public.challenges where id = r.challenge_id;
  return jsonb_build_object(
    'request', to_jsonb(r) || jsonb_build_object('completed_by_name', (select full_name from public.profiles x where x.id = r.completed_by),
      'credential_code', (select code from public.credentials cr where cr.id = r.issued_credential_id)),
    'can_decide', r.status = 'pending' and r.student_id <> auth.uid() and public.sp_can_review_challenge(r.challenge_id),
    'challenge', jsonb_build_object('id', c.id, 'title', c.title, 'summary', c.summary, 'objective', c.objective, 'status', c.status,
      'start_date', c.start_date, 'end_date', c.end_date, 'estimated_vath', c.estimated_vath,
      'organization_name', (select name from public.organizations o where o.id = c.organization_id),
      'supervisor_name', (select full_name from public.profiles x where x.id = c.supervisor_id)),
    'student', (select jsonb_build_object('id', pr.id, 'full_name', pr.full_name, 'career', pr.career, 'semester', pr.semester, 'headline', pr.headline,
      'university', (select name from public.organizations u where u.id = pr.university_id)) from public.profiles pr where pr.id = r.student_id),
    'assignment', (select jsonb_build_object('id', a.id, 'status', a.status, 'started_at', a.started_at,
        'verified_hours', (select coalesce(sum(verified_hours), 0) from public.vath_entries v where v.assignment_id = a.id and v.status in ('verified','adjusted')),
        'assessed_competencies', (select count(distinct competency_id) from public.competency_assessments ca where ca.assignment_id = a.id),
        'credential_code', (select code from public.credentials cr where cr.assignment_id = a.id))
      from public.assignments a where a.id = r.assignment_id),
    'competencies', (select coalesce(jsonb_agg(public.sp_competency_json(k) || jsonb_build_object('required_level', cc.required_level,
        'previous_level', (select max(level) from public.competency_assessments ca where ca.assignment_id = r.assignment_id and ca.competency_id = k.id and ca.request_id <> r.id),
        'assessed_level', (select level from public.competency_assessments ca where ca.request_id = r.id and ca.competency_id = k.id),
        'assessed_comment', (select comment from public.competency_assessments ca where ca.request_id = r.id and ca.competency_id = k.id))
        order by k.name_en), '[]'::jsonb)
      from public.challenge_competencies cc join public.competencies k on k.id = cc.competency_id where cc.challenge_id = c.id),
    'vath', (select coalesce(jsonb_agg(to_jsonb(v) || jsonb_build_object(
        'evidence_ids', (select coalesce(jsonb_agg(ve.evidence_id), '[]'::jsonb) from public.vath_entry_evidence ve where ve.vath_entry_id = v.id),
        'task_title', (select title from public.tasks t where t.id = v.task_id)) order by v.activity_date), '[]'::jsonb)
      from public.validation_request_items i join public.vath_entries v on v.id = i.item_id where i.request_id = r.id and i.item_type = 'vath'),
    'evidence', (select coalesce(jsonb_agg(to_jsonb(e) - 'storage_path' || jsonb_build_object('has_file', e.storage_path is not null,
        'in_request', exists(select 1 from public.validation_request_items i where i.request_id = r.id and i.item_type = 'evidence' and i.item_id = e.id),
        'deliverable_title', (select title from public.challenge_deliverables d where d.id = e.deliverable_id),
        'competency_ids', (select coalesce(jsonb_agg(ec.competency_id), '[]'::jsonb) from public.evidence_competencies ec where ec.evidence_id = e.id))
        order by e.created_at), '[]'::jsonb)
      from public.evidence e
      where e.id in (select i.item_id from public.validation_request_items i where i.request_id = r.id and i.item_type = 'evidence'
                     union select ve.evidence_id from public.validation_request_items i join public.vath_entry_evidence ve on ve.vath_entry_id = i.item_id
                     where i.request_id = r.id and i.item_type = 'vath')),
    'decisions', (select coalesce(jsonb_agg(to_jsonb(d) || jsonb_build_object('decided_by_name', pr.full_name) order by d.decided_at), '[]'::jsonb)
      from public.validation_decisions d left join public.profiles pr on pr.id = d.decided_by where d.request_id = r.id));
end $$;

-- ---------------------------------------------------------------------------
-- SkillPass (private view), talent, company and university dashboards
-- ---------------------------------------------------------------------------
create function public.sp_credential_public_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  -- Masks challenge/company names when the challenge is confidential; lists only evidence the
  -- student made public and the challenge allows publishing. Returns null unless the credential
  -- is publicly verifiable or the caller may already read it.
  select jsonb_build_object(
    'code', cr.code, 'status', cr.status, 'issued_at', cr.issued_at, 'revoked_at', cr.revoked_at, 'is_demo', cr.is_demo,
    'confidential', cr.snapshot->>'publication_policy' = 'confidential',
    'challenge_title', case when cr.snapshot->>'publication_policy' = 'confidential' then null else cr.snapshot->>'challenge_title' end,
    'organization_name', case when cr.snapshot->>'publication_policy' = 'confidential' then null else cr.snapshot->>'organization_name' end,
    'industry', cr.snapshot->>'industry', 'modality', cr.snapshot->>'modality',
    'start_date', cr.snapshot->>'start_date', 'end_date', cr.snapshot->>'end_date',
    'verified_hours', (cr.snapshot->>'verified_hours')::numeric,
    'competencies', coalesce(cr.snapshot->'competencies', '[]'::jsonb),
    'supervisor_name', cr.snapshot->>'supervisor_name', 'supervisor_title', cr.snapshot->>'supervisor_title',
    'evidence_approved', (cr.snapshot->>'evidence_approved')::int,
    'issuer', cr.snapshot->>'issuer',
    'public_evidence', case when cr.snapshot->>'publication_policy' = 'public_allowed' then (
      select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'kind', e.kind, 'url', e.url,
        'has_file', e.storage_path is not null, 'file_name', e.file_name) order by e.created_at), '[]'::jsonb)
      from public.evidence e where e.assignment_id = cr.assignment_id and e.is_public and e.status = 'approved') else '[]'::jsonb end)
  from public.credentials cr
  where cr.id = p_id and (
    cr.verification_enabled or cr.student_id = auth.uid() or public.sp_is_admin()
    or public.sp_can_manage_challenge(cr.challenge_id) or public.sp_is_university_staff_for(cr.student_id))
$$;

create function public.sp_skillpass_me(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); pr public.profiles;
begin
  select * into pr from public.profiles where id = v_uid and role = 'student';
  if not found then return null; end if;
  return jsonb_build_object(
    'profile', to_jsonb(pr) || jsonb_build_object('university', (select name from public.organizations o where o.id = pr.university_id)),
    'credentials', (select coalesce(jsonb_agg(public.sp_credential_public_json(cr.id) || jsonb_build_object('id', cr.id,
        'verification_enabled', cr.verification_enabled, 'challenge_id', cr.challenge_id,
        'real_challenge_title', cr.snapshot->>'challenge_title', 'real_organization_name', cr.snapshot->>'organization_name',
        'publication_policy', cr.snapshot->>'publication_policy') order by cr.issued_at desc), '[]'::jsonb)
      from public.credentials cr where cr.student_id = v_uid),
    'verified_competencies', (select coalesce(jsonb_agg(public.sp_competency_json(k) || jsonb_build_object('level', vc.level,
        'challenges', vc.challenges, 'last_assessed_at', vc.last_assessed_at,
        'credentialed', exists(select 1 from public.competency_assessments ca join public.credentials cr on cr.assignment_id = ca.assignment_id
          where ca.student_id = v_uid and ca.competency_id = k.id and ca.level >= 3 and cr.status = 'active')) order by vc.level desc, k.name_en), '[]'::jsonb)
      from public.student_verified_competencies vc join public.competencies k on k.id = vc.competency_id where vc.student_id = v_uid),
    'developing', (select coalesce(jsonb_agg(public.sp_competency_json(k) || jsonb_build_object('level', x.level) order by k.name_en), '[]'::jsonb)
      from (select competency_id, max(level) as level from public.competency_assessments where student_id = v_uid group by competency_id having max(level) < 3) x
      join public.competencies k on k.id = x.competency_id),
    'in_progress', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select a.challenge_id, c.title, o.name as organization_name,
        (select coalesce(sum(verified_hours), 0) from public.vath_entries v where v.assignment_id = a.id and v.status in ('verified','adjusted')) as verified_hours,
        (select coalesce(sum(submitted_hours), 0) from public.vath_entries v where v.assignment_id = a.id and v.status = 'submitted') as pending_hours
      from public.assignments a join public.challenges c on c.id = a.challenge_id join public.organizations o on o.id = c.organization_id
      where a.student_id = v_uid and a.status = 'active') x),
    'declared_skills', (select coalesce(jsonb_agg(public.sp_competency_json(k) order by k.name_en), '[]'::jsonb)
      from public.declared_skills ds join public.competencies k on k.id = ds.competency_id where ds.student_id = v_uid),
    'totals', jsonb_build_object(
      'credentialed_vath', (select coalesce(sum((snapshot->>'verified_hours')::numeric), 0) from public.credentials where student_id = v_uid and status = 'active'),
      'verified_vath', (select coalesce(sum(v.verified_hours), 0) from public.vath_entries v where v.student_id = v_uid and v.status in ('verified','adjusted')
        and not exists(select 1 from public.credentials c where c.assignment_id = v.assignment_id and c.status = 'revoked')),
      'verified_projects', (select count(*) from public.credentials where student_id = v_uid and status = 'active'),
      'verified_competencies', (select count(*) from public.student_verified_competencies where student_id = v_uid)));
end $$;

-- Talent profile as seen by a permitted viewer (company, university, teammate, admin or self).
create function public.sp_talent_profile(p jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare pr public.profiles;
begin
  select * into pr from public.profiles where id = nullif(p->>'student_id', '')::uuid and role = 'student';
  if not found then return null; end if;
  return jsonb_build_object(
    'profile', jsonb_build_object('id', pr.id, 'full_name', pr.full_name, 'headline', pr.headline, 'bio', pr.bio, 'career', pr.career,
      'semester', pr.semester, 'location', pr.location, 'interests', pr.interests, 'availability', pr.availability,
      'hours_per_week', pr.hours_per_week, 'slug', pr.slug, 'skillpass_public', pr.skillpass_public, 'is_demo', pr.is_demo,
      'open_to_opportunities', pr.open_to_opportunities,
      'university', (select name from public.organizations o where o.id = pr.university_id)),
    'declared_skills', (select coalesce(jsonb_agg(public.sp_competency_json(k) order by k.name_en), '[]'::jsonb)
      from public.declared_skills ds join public.competencies k on k.id = ds.competency_id where ds.student_id = pr.id),
    'credentials', (select coalesce(jsonb_agg(public.sp_credential_public_json(cr.id) order by cr.issued_at desc), '[]'::jsonb)
      from public.credentials cr where cr.student_id = pr.id and cr.status = 'active'),
    'assignments', (select coalesce(jsonb_agg(jsonb_build_object('challenge_id', a.challenge_id, 'title', c.title, 'status', a.status,
        'organization_name', o.name) order by a.started_at desc), '[]'::jsonb)
      from public.assignments a join public.challenges c on c.id = a.challenge_id join public.organizations o on o.id = c.organization_id
      where a.student_id = pr.id and a.status in ('active','completed')),
    'can_invite', exists(select 1 from public.organization_members m join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid() and o.kind = 'company' and m.member_role in ('owner','manager')) and public.sp_in_talent_pool(pr.id),
    'invitable_challenges', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title) order by c.title), '[]'::jsonb)
      from public.challenges c where c.status in ('published','recruiting') and public.sp_can_manage_challenge(c.id)
        and not exists(select 1 from public.applications ap where ap.challenge_id = c.id and ap.student_id = pr.id)));
end $$;

create function public.sp_talent(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  v_q text := nullif(btrim(coalesce(p->>'q', '')), ''); v_comp uuid := nullif(p->>'competency_id', '')::uuid;
  v_verified boolean := coalesce((p->>'verified_only')::boolean, false); v_min numeric := coalesce(nullif(p->>'min_vath', '')::numeric, 0);
  v_career text := nullif(btrim(coalesce(p->>'career', '')), ''); v_uni uuid := nullif(p->>'university_id', '')::uuid;
  v_avail text := nullif(p->>'availability', ''); v_challenge uuid := nullif(p->>'challenge_id', '')::uuid;
  v_sort text := coalesce(nullif(p->>'sort', ''), 'name');
begin
  if not (public.sp_is_admin() or exists(select 1 from public.organization_members m join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid() and o.kind = 'company' and o.verification_status = 'verified')) then
    return jsonb_build_object('items', '[]'::jsonb, 'allowed', false);
  end if;
  return jsonb_build_object('allowed', true, 'items', (select coalesce(jsonb_agg(x order by
      case when v_sort = 'vath' then -x.verified_vath else 0 end, x.full_name), '[]'::jsonb) from (
    select pr.id, pr.full_name, pr.headline, pr.career, pr.semester, pr.availability, pr.hours_per_week, pr.is_demo,
      (select name from public.organizations o where o.id = pr.university_id) as university,
      (select coalesce(sum((cr.snapshot->>'verified_hours')::numeric), 0) from public.credentials cr where cr.student_id = pr.id and cr.status = 'active') as verified_vath,
      (select count(*) from public.credentials cr where cr.student_id = pr.id and cr.status = 'active') as credentials,
      (select coalesce(jsonb_agg(z order by z.level desc, z.name_en), '[]'::jsonb) from (
        select k->>'competency_id' as id, k->>'slug' as slug, k->>'name_es' as name_es, k->>'name_en' as name_en, max((k->>'level')::int) as level
        from public.credentials cr, jsonb_array_elements(cr.snapshot->'competencies') k
        where cr.student_id = pr.id and cr.status = 'active' group by 1, 2, 3, 4) z) as verified_competencies,
      (select coalesce(jsonb_agg(public.sp_competency_json(k) order by k.name_en), '[]'::jsonb)
        from public.declared_skills ds join public.competencies k on k.id = ds.competency_id where ds.student_id = pr.id) as declared_skills
    from public.profiles pr
    where pr.role = 'student' and pr.open_to_opportunities and pr.onboarding_completed
      and (v_q is null or pr.full_name ilike '%' || v_q || '%' or pr.headline ilike '%' || v_q || '%' or pr.career ilike '%' || v_q || '%')
      and (v_career is null or pr.career ilike '%' || v_career || '%')
      and (v_uni is null or pr.university_id = v_uni)
      and (v_avail is null or pr.availability = v_avail)
      and (v_challenge is null or exists(select 1 from public.credentials cr where cr.student_id = pr.id and cr.challenge_id = v_challenge and cr.status = 'active'))
      and (v_comp is null or (
        exists(select 1 from public.credentials cr, jsonb_array_elements(cr.snapshot->'competencies') k
          where cr.student_id = pr.id and cr.status = 'active' and k->>'competency_id' = v_comp::text)
        or (not v_verified and exists(select 1 from public.declared_skills ds where ds.student_id = pr.id and ds.competency_id = v_comp))))
      and (not v_verified or exists(select 1 from public.credentials cr where cr.student_id = pr.id and cr.status = 'active'))
    limit 200) x where x.verified_vath >= v_min));
end $$;

create function public.sp_company_dashboard(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_ids uuid[];
begin
  select m.organization_id into v_org from public.organization_members m join public.organizations o on o.id = m.organization_id
    where m.user_id = v_uid and o.kind = 'company' order by case m.member_role when 'owner' then 0 when 'manager' then 1 else 2 end limit 1;
  if v_org is null then return jsonb_build_object('organization', null); end if;
  select coalesce(array_agg(c.id), '{}') into v_ids from public.challenges c
    where c.organization_id = v_org and (public.sp_can_manage_challenge(c.id) or c.supervisor_id = v_uid);
  return jsonb_build_object(
    'organization', (select to_jsonb(o) from public.organizations o where o.id = v_org),
    'can_manage', public.sp_is_org_manager(v_org),
    'stats', jsonb_build_object(
      'challenges', cardinality(v_ids),
      'active', (select count(*) from public.challenges where id = any(v_ids) and status = 'active'),
      'open', (select count(*) from public.challenges where id = any(v_ids) and status in ('published','recruiting')),
      'completed', (select count(*) from public.challenges where id = any(v_ids) and status = 'completed'),
      'participants', (select count(*) from public.assignments where challenge_id = any(v_ids) and status in ('active','completed')),
      'pending_applications', (select count(*) from public.applications where challenge_id = any(v_ids) and status in ('submitted','shortlisted')),
      'pending_validations', (select count(*) from public.validation_requests where challenge_id = any(v_ids) and status = 'pending'),
      'evidence_pending', (select count(*) from public.evidence where challenge_id = any(v_ids) and status = 'submitted'),
      'credentials', (select count(*) from public.credentials where challenge_id = any(v_ids) and status = 'active'),
      'verified_vath', (select coalesce(sum(verified_hours), 0) from public.vath_entries where challenge_id = any(v_ids) and status in ('verified','adjusted'))),
    'challenges', (select coalesce(jsonb_agg(x order by x.sort_key, x.created_at desc), '[]'::jsonb) from (
      select c.id, c.title, c.status, c.end_date, c.created_at, c.max_participants, c.estimated_vath,
        (select count(*) from public.assignments a where a.challenge_id = c.id and a.status in ('active','completed')) as participants,
        (select count(*) from public.applications ap where ap.challenge_id = c.id and ap.status in ('submitted','shortlisted')) as pending_applications,
        (select count(*) from public.validation_requests r where r.challenge_id = c.id and r.status = 'pending') as pending_validations,
        (select coalesce(sum(verified_hours), 0) from public.vath_entries v where v.challenge_id = c.id and v.status in ('verified','adjusted')) as verified_hours,
        (select count(*) from public.tasks t where t.challenge_id = c.id) as tasks_total,
        (select count(*) from public.tasks t where t.challenge_id = c.id and t.status = 'done') as tasks_done,
        case c.status when 'active' then 0 when 'recruiting' then 1 when 'published' then 2 when 'under_review' then 3 when 'draft' then 4 else 5 end as sort_key
      from public.challenges c where c.id = any(v_ids)) x),
    'pending_validations', (select coalesce(jsonb_agg(x order by x.created_at), '[]'::jsonb) from (
      select r.id, r.created_at, c.title as challenge_title, pr.full_name as student_name,
        (select coalesce(sum(v.submitted_hours), 0) from public.validation_request_items i join public.vath_entries v on v.id = i.item_id
          where i.request_id = r.id and i.item_type = 'vath') as hours,
        (select count(*) from public.validation_request_items i where i.request_id = r.id and i.item_type = 'evidence') as evidence_count
      from public.validation_requests r join public.challenges c on c.id = r.challenge_id join public.profiles pr on pr.id = r.student_id
      where r.challenge_id = any(v_ids) and r.status = 'pending' limit 6) x),
    'recent_applications', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
      select ap.id, ap.created_at, ap.status, ap.match_score, ap.challenge_id, c.title as challenge_title, pr.full_name as student_name, pr.career
      from public.applications ap join public.challenges c on c.id = ap.challenge_id join public.profiles pr on pr.id = ap.student_id
      where ap.challenge_id = any(v_ids) and ap.status in ('submitted','shortlisted') order by ap.created_at desc limit 6) x),
    'observed_talent', (select coalesce(jsonb_agg(x order by x.issued_at desc), '[]'::jsonb) from (
      select cr.code, cr.issued_at, cr.student_id, pr.full_name, pr.career, (cr.snapshot->>'verified_hours')::numeric as verified_hours,
        cr.snapshot->>'challenge_title' as challenge_title, jsonb_array_length(coalesce(cr.snapshot->'competencies', '[]'::jsonb)) as competencies
      from public.credentials cr join public.profiles pr on pr.id = cr.student_id
      where cr.challenge_id = any(v_ids) and cr.status = 'active' order by cr.issued_at desc limit 6) x));
end $$;

-- University analytics: SECURITY DEFINER because it aggregates over affiliated students.
-- Returns aggregates plus a per-student summary (no evidence content, no comments).
create function public.sp_university_dashboard(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare o public.organizations; v_students uuid[];
begin
  select org.* into o from public.organization_members m join public.organizations org on org.id = m.organization_id
    where m.user_id = auth.uid() and org.kind = 'university' limit 1;
  if o.id is null then
    if public.sp_is_admin() and nullif(p->>'organization_id', '') is not null then
      select * into o from public.organizations where id = (p->>'organization_id')::uuid and kind = 'university';
    end if;
    if o.id is null then return jsonb_build_object('organization', null); end if;
  end if;
  if o.verification_status <> 'verified' then
    return jsonb_build_object('organization', to_jsonb(o), 'pending', true);
  end if;
  select coalesce(array_agg(id), '{}') into v_students from public.profiles where university_id = o.id and role = 'student';

  return jsonb_build_object(
    'organization', to_jsonb(o),
    'stats', jsonb_build_object(
      'students', cardinality(v_students),
      'participating', (select count(distinct student_id) from public.assignments where student_id = any(v_students) and status in ('active','completed')),
      'challenges', (select count(distinct challenge_id) from public.assignments where student_id = any(v_students) and status in ('active','completed')),
      'companies', (select count(distinct c.organization_id) from public.assignments a join public.challenges c on c.id = a.challenge_id
        where a.student_id = any(v_students) and a.status in ('active','completed')),
      'verified_vath', (select coalesce(sum(v.verified_hours), 0) from public.vath_entries v where v.student_id = any(v_students)
        and v.status in ('verified','adjusted') and not exists(select 1 from public.credentials c where c.assignment_id = v.assignment_id and c.status = 'revoked')),
      'completed_projects', (select count(*) from public.credentials where student_id = any(v_students) and status = 'active'),
      'verified_competencies', (select count(*) from (select distinct a.student_id, a.competency_id from public.competency_assessments a
        where a.student_id = any(v_students) and a.level >= 3
          and not exists(select 1 from public.credentials c where c.assignment_id = a.assignment_id and c.status = 'revoked')) z),
      'applications', (select count(*) from public.applications where student_id = any(v_students) and status <> 'withdrawn')),
    'vath_by_career', (select coalesce(jsonb_agg(x order by x.hours desc), '[]'::jsonb) from (
      select coalesce(nullif(btrim(pr.career), ''), '—') as career, sum(v.verified_hours) as hours, count(distinct v.student_id) as students
      from public.vath_entries v join public.profiles pr on pr.id = v.student_id
      where v.student_id = any(v_students) and v.status in ('verified','adjusted')
        and not exists(select 1 from public.credentials c where c.assignment_id = v.assignment_id and c.status = 'revoked')
      group by 1 order by 2 desc limit 8) x),
    'participation_by_career', (select coalesce(jsonb_agg(x order by x.students desc), '[]'::jsonb) from (
      select coalesce(nullif(btrim(pr.career), ''), '—') as career, count(*) as students,
        count(*) filter (where exists(select 1 from public.assignments a where a.student_id = pr.id and a.status in ('active','completed'))) as participating
      from public.profiles pr where pr.id = any(v_students) group by 1 order by 2 desc limit 10) x),
    'competencies_top', (select coalesce(jsonb_agg(x order by x.students desc, x.name_en), '[]'::jsonb) from (
      select k.slug, k.name_es, k.name_en, k.category, count(distinct a.student_id) as students
      from public.competency_assessments a join public.competencies k on k.id = a.competency_id
      where a.student_id = any(v_students) and a.level >= 3
        and not exists(select 1 from public.credentials c where c.assignment_id = a.assignment_id and c.status = 'revoked')
      group by k.slug, k.name_es, k.name_en, k.category order by 5 desc, k.name_en limit 8) x),
    'trend', (select coalesce(jsonb_agg(x order by x.month), '[]'::jsonb) from (
      select to_char(m, 'YYYY-MM') as month,
        (select coalesce(sum(v.verified_hours), 0) from public.vath_entries v where v.student_id = any(v_students)
          and v.status in ('verified','adjusted') and date_trunc('month', v.validated_at) = m) as vath,
        (select count(*) from public.credentials cr where cr.student_id = any(v_students) and cr.status = 'active'
          and date_trunc('month', cr.issued_at) = m) as credentials
      from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m) x),
    'companies', (select coalesce(jsonb_agg(x order by x.students desc, x.name), '[]'::jsonb) from (
      select org.name, org.is_demo, count(distinct a.challenge_id) as challenges, count(distinct a.student_id) as students,
        (select coalesce(sum(v.verified_hours), 0) from public.vath_entries v join public.challenges c2 on c2.id = v.challenge_id
          where c2.organization_id = org.id and v.student_id = any(v_students) and v.status in ('verified','adjusted')) as verified_hours
      from public.assignments a join public.challenges c on c.id = a.challenge_id join public.organizations org on org.id = c.organization_id
      where a.student_id = any(v_students) and a.status in ('active','completed') group by org.id, org.name, org.is_demo limit 12) x),
    'students', (select coalesce(jsonb_agg(x order by x.verified_vath desc, x.full_name), '[]'::jsonb) from (
      select pr.id, pr.full_name, pr.career, pr.semester, pr.is_demo,
        (select count(*) from public.assignments a where a.student_id = pr.id and a.status in ('active','completed')) as challenges,
        (select coalesce(sum(v.verified_hours), 0) from public.vath_entries v where v.student_id = pr.id and v.status in ('verified','adjusted')
          and not exists(select 1 from public.credentials c where c.assignment_id = v.assignment_id and c.status = 'revoked')) as verified_vath,
        (select count(distinct a.competency_id) from public.competency_assessments a where a.student_id = pr.id and a.level >= 3) as competencies,
        (select count(*) from public.credentials cr where cr.student_id = pr.id and cr.status = 'active') as credentials,
        exists(select 1 from public.assignments a where a.student_id = pr.id and a.status = 'active') as active
      from public.profiles pr where pr.id = any(v_students) limit 300) x));
end $$;

-- ---------------------------------------------------------------------------
-- AINDEV admin (Talent OS)
-- ---------------------------------------------------------------------------
create function public.sp_admin_overview(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
begin
  if not public.sp_is_admin() then return null; end if;
  return jsonb_build_object(
    'stats', jsonb_build_object(
      'users', (select jsonb_object_agg(role, n) from (select role, count(*) n from public.profiles group by role) x),
      'organizations', (select jsonb_object_agg(kind || ':' || verification_status, n) from (select kind, verification_status, count(*) n from public.organizations group by 1, 2) x),
      'challenges', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.challenges group by status) x),
      'applications', (select count(*) from public.applications),
      'assignments', (select count(*) from public.assignments where status in ('active','completed')),
      'evidence', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.evidence group by status) x),
      'vath_submitted', (select coalesce(sum(submitted_hours), 0) from public.vath_entries where status <> 'draft'),
      'vath_verified', (select coalesce(sum(verified_hours), 0) from public.vath_entries where status in ('verified','adjusted')),
      'validations_pending', (select count(*) from public.validation_requests where status = 'pending'),
      'validations_completed', (select count(*) from public.validation_requests where status = 'completed'),
      'credentials_active', (select count(*) from public.credentials where status = 'active'),
      'credentials_revoked', (select count(*) from public.credentials where status = 'revoked'),
      'verified_competencies', (select count(*) from public.student_verified_competencies),
      'incidents_open', (select count(*) from public.incidents where status in ('open','investigating'))),
    'pending_organizations', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'kind', o.kind, 'created_at', o.created_at,
        'location', o.location, 'website', o.website) order by o.created_at), '[]'::jsonb)
      from public.organizations o where o.verification_status = 'pending'),
    'recent_audit', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
      select l.id, l.action, l.entity_type, l.created_at, actor.full_name as actor_name, subj.full_name as subject_name
      from public.audit_logs l left join public.profiles actor on actor.id = l.actor_id left join public.profiles subj on subj.id = l.subject_id
      order by l.created_at desc limit 15) x),
    'open_incidents', (select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at desc), '[]'::jsonb)
      from public.incidents i where i.status in ('open','investigating')));
end $$;

create function public.sp_admin_list(p jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  v_entity text := coalesce(p->>'entity', ''); v_q text := nullif(btrim(coalesce(p->>'q', '')), '');
  v_limit int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 50), 1), 200);
  v_offset int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0); v_items jsonb; v_total int;
begin
  if not public.sp_is_admin() then return null; end if;
  if v_entity = 'users' then
    select count(*) into v_total from public.profiles pr where v_q is null or pr.full_name ilike '%' || v_q || '%' or pr.role = v_q;
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
      select pr.id, pr.full_name, pr.role, pr.career, pr.onboarding_completed, pr.skillpass_public, pr.is_demo, pr.created_at,
        (select name from public.organizations o where o.id = pr.university_id) as university,
        (select string_agg(o.name, ', ') from public.organization_members m join public.organizations o on o.id = m.organization_id where m.user_id = pr.id) as organizations
      from public.profiles pr where v_q is null or pr.full_name ilike '%' || v_q || '%' or pr.role = v_q
      order by pr.created_at desc limit v_limit offset v_offset) x;
  elsif v_entity = 'organizations' then
    select count(*) into v_total from public.organizations o where v_q is null or o.name ilike '%' || v_q || '%' or o.kind = v_q;
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
      select o.id, o.name, o.kind, o.industry, o.location, o.verification_status, o.is_demo, o.created_at,
        (select count(*) from public.organization_members m where m.organization_id = o.id) as members,
        (select count(*) from public.challenges c where c.organization_id = o.id) as challenges,
        (select count(*) from public.profiles s where s.university_id = o.id) as students
      from public.organizations o where v_q is null or o.name ilike '%' || v_q || '%' or o.kind = v_q
      order by o.created_at desc limit v_limit offset v_offset) x;
  elsif v_entity = 'challenges' then
    select count(*) into v_total from public.challenges c where v_q is null or c.title ilike '%' || v_q || '%' or c.status = v_q;
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
      select c.id, c.title, c.status, c.compensation_type, c.estimated_vath, c.is_demo, c.created_at,
        (select name from public.organizations o where o.id = c.organization_id) as organization,
        (select count(*) from public.applications ap where ap.challenge_id = c.id) as applications,
        (select count(*) from public.assignments a where a.challenge_id = c.id and a.status in ('active','completed')) as participants
      from public.challenges c where v_q is null or c.title ilike '%' || v_q || '%' or c.status = v_q
      order by c.created_at desc limit v_limit offset v_offset) x;
  elsif v_entity = 'applications' then
    select count(*) into v_total from public.applications ap where v_q is null or ap.status = v_q;
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
      select ap.id, ap.status, ap.match_score, ap.created_at, ap.decided_at, c.title as challenge, pr.full_name as student,
        (select full_name from public.profiles d where d.id = ap.decided_by) as decided_by
      from public.applications ap join public.challenges c on c.id = ap.challenge_id join public.profiles pr on pr.id = ap.student_id
      where v_q is null or ap.status = v_q or pr.full_name ilike '%' || v_q || '%'
      order by ap.created_at desc limit v_limit offset v_offset) x;
  elsif v_entity = 'evidence' then
    select count(*) into v_total from public.evidence e where v_q is null or e.status = v_q or e.title ilike '%' || v_q || '%';
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
      select e.id, e.title, e.kind, e.status, e.version, e.is_public, e.created_at, e.url, e.storage_path is not null as has_file,
        c.title as challenge, pr.full_name as student
      from public.evidence e join public.challenges c on c.id = e.challenge_id join public.profiles pr on pr.id = e.student_id
      where v_q is null or e.status = v_q or e.title ilike '%' || v_q || '%'
      order by e.created_at desc limit v_limit offset v_offset) x;
  elsif v_entity = 'vath' then
    select count(*) into v_total from public.vath_entries v where v_q is null or v.status = v_q;
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
      select v.id, v.activity_date, v.activity, v.submitted_hours, v.verified_hours, v.status, v.validated_at,
        c.title as challenge, pr.full_name as student, (select full_name from public.profiles d where d.id = v.validated_by) as validated_by
      from public.vath_entries v join public.challenges c on c.id = v.challenge_id join public.profiles pr on pr.id = v.student_id
      where v_q is null or v.status = v_q or pr.full_name ilike '%' || v_q || '%'
      order by v.activity_date desc limit v_limit offset v_offset) x;
  elsif v_entity = 'validations' then
    select count(*) into v_total from public.validation_requests r where v_q is null or r.status = v_q or r.outcome = v_q;
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
      select r.id, r.status, r.outcome, r.created_at, r.completed_at, c.title as challenge, pr.full_name as student,
        (select full_name from public.profiles d where d.id = r.completed_by) as completed_by,
        (select count(*) from public.validation_decisions d where d.request_id = r.id) as decisions
      from public.validation_requests r join public.challenges c on c.id = r.challenge_id join public.profiles pr on pr.id = r.student_id
      where v_q is null or r.status = v_q or r.outcome = v_q
      order by r.created_at desc limit v_limit offset v_offset) x;
  elsif v_entity = 'competencies' then
    select count(*) into v_total from public.competencies k where v_q is null or k.name_en ilike '%' || v_q || '%' or k.name_es ilike '%' || v_q || '%';
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
      select k.*, (select count(*) from public.competency_assessments a where a.competency_id = k.id) as assessments,
        (select count(*) from public.challenge_competencies cc where cc.competency_id = k.id) as challenges
      from public.competencies k where v_q is null or k.name_en ilike '%' || v_q || '%' or k.name_es ilike '%' || v_q || '%'
      order by k.category, k.name_en limit v_limit offset v_offset) x;
  elsif v_entity = 'credentials' then
    select count(*) into v_total from public.credentials cr where v_q is null or cr.code ilike '%' || v_q || '%' or cr.status = v_q;
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
      select cr.id, cr.code, cr.status, cr.issued_at, cr.revoked_at, cr.revocation_reason, cr.verification_enabled, cr.is_demo,
        pr.full_name as student, cr.snapshot->>'challenge_title' as challenge, (cr.snapshot->>'verified_hours')::numeric as verified_hours,
        (select full_name from public.profiles d where d.id = cr.issued_by) as issued_by
      from public.credentials cr join public.profiles pr on pr.id = cr.student_id
      where v_q is null or cr.code ilike '%' || v_q || '%' or cr.status = v_q
      order by cr.issued_at desc limit v_limit offset v_offset) x;
  elsif v_entity = 'incidents' then
    select count(*) into v_total from public.incidents i where v_q is null or i.status = v_q;
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
      select i.*, (select full_name from public.profiles d where d.id = i.reported_by) as reported_by_name
      from public.incidents i where v_q is null or i.status = v_q order by i.created_at desc limit v_limit offset v_offset) x;
  elsif v_entity = 'audit' then
    select count(*) into v_total from public.audit_logs l where v_q is null or l.action ilike '%' || v_q || '%' or l.entity_type = v_q;
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
      select l.id, l.action, l.entity_type, l.entity_id, l.before, l.after, l.created_at,
        (select full_name from public.profiles d where d.id = l.actor_id) as actor_name,
        (select full_name from public.profiles d where d.id = l.subject_id) as subject_name
      from public.audit_logs l where v_q is null or l.action ilike '%' || v_q || '%' or l.entity_type = v_q
      order by l.created_at desc limit v_limit offset v_offset) x;
  else
    perform public.sp_raise('invalid_field', 'entity');
  end if;
  return jsonb_build_object('items', v_items, 'total', v_total, 'limit', v_limit, 'offset', v_offset);
end $$;

create function public.sp_notifications(p jsonb default '{}'::jsonb) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object('items', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select id, kind, params, link, read_at, created_at from public.notifications where user_id = auth.uid()
    order by created_at desc limit least(greatest(coalesce(nullif(p->>'limit', '')::int, 50), 1), 200)) x))
$$;

-- File access for an evidence row the caller can see (RLS) — used by the download route.
create function public.sp_evidence_file(p jsonb) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object('id', e.id, 'storage_path', e.storage_path, 'file_name', e.file_name, 'mime_type', e.mime_type, 'url', e.url)
  from public.evidence e where e.id = nullif(p->>'evidence_id', '')::uuid
$$;

-- ---------------------------------------------------------------------------
-- Public (anonymous) functions. Only opted-in, narrowed data.
-- ---------------------------------------------------------------------------
create function public.sp_public_skillpass(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare pr public.profiles; v_slug text := lower(btrim(coalesce(p->>'slug', '')));
begin
  if v_slug !~ '^[a-z0-9][a-z0-9-]{2,90}$' then return null; end if;
  select * into pr from public.profiles where slug = v_slug and role = 'student' and skillpass_public;
  if not found then return null; end if;
  return jsonb_build_object(
    'profile', jsonb_build_object('full_name', pr.full_name, 'headline', pr.headline, 'bio', pr.bio, 'slug', pr.slug, 'is_demo', pr.is_demo,
      'member_since', pr.created_at,
      'career', case when pr.public_show_career then nullif(pr.career, '') end,
      'university', case when pr.public_show_university then (select name from public.organizations o where o.id = pr.university_id and o.verification_status = 'verified') end),
    'credentials', (select coalesce(jsonb_agg(public.sp_credential_public_json(cr.id) order by cr.issued_at desc), '[]'::jsonb)
      from public.credentials cr where cr.student_id = pr.id and cr.status = 'active' and cr.verification_enabled),
    'competencies', (select coalesce(jsonb_agg(z order by z.level desc, z.name_en), '[]'::jsonb) from (
      select k->>'slug' as slug, k->>'name_es' as name_es, k->>'name_en' as name_en, k->>'category' as category,
        max((k->>'level')::int) as level, count(*) as projects
      from public.credentials cr, jsonb_array_elements(cr.snapshot->'competencies') k
      where cr.student_id = pr.id and cr.status = 'active' and cr.verification_enabled group by 1, 2, 3, 4) z),
    'summary', jsonb_build_object(
      'verified_vath', (select coalesce(sum((snapshot->>'verified_hours')::numeric), 0) from public.credentials
        where student_id = pr.id and status = 'active' and verification_enabled),
      'verified_projects', (select count(*) from public.credentials where student_id = pr.id and status = 'active' and verification_enabled),
      'validators', (select count(distinct issued_by) from public.credentials where student_id = pr.id and status = 'active' and verification_enabled)));
end $$;

create function public.sp_public_credential(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare cr public.credentials; pr public.profiles; v_code text := upper(btrim(coalesce(p->>'code', '')));
begin
  if v_code !~ '^SKP-[0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$' then return null; end if;
  select * into cr from public.credentials where code = v_code and verification_enabled;
  if not found then return null; end if;
  select * into pr from public.profiles where id = cr.student_id;
  return jsonb_build_object(
    'credential', public.sp_credential_public_json(cr.id),
    'holder', jsonb_build_object('full_name', pr.full_name, 'skillpass_slug', case when pr.skillpass_public then pr.slug end,
      'career', case when pr.public_show_career then nullif(pr.career, '') end,
      'university', case when pr.public_show_university then (select name from public.organizations o where o.id = pr.university_id and o.verification_status = 'verified') end),
    'verification', jsonb_build_object('status', case when cr.status = 'active' then 'valid' else 'revoked' end, 'checked_at', now()));
end $$;

create function public.sp_public_evidence_file(p jsonb) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('storage_path', e.storage_path, 'file_name', e.file_name, 'mime_type', e.mime_type, 'is_demo', cr.is_demo)
  from public.evidence e
  join public.credentials cr on cr.assignment_id = e.assignment_id and cr.status = 'active' and cr.verification_enabled
  where e.id = nullif(p->>'evidence_id', '')::uuid and e.is_public and e.status = 'approved' and e.storage_path is not null
    and cr.snapshot->>'publication_policy' = 'public_allowed'
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'sp\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
  end loop;
end $$;

-- Helpers used inside RLS policies and invoker RPCs.
grant execute on function public.sp_current_role(), public.sp_is_admin(), public.sp_my_university_id(), public.sp_auth_email(),
  public.sp_is_org_member(uuid), public.sp_is_org_manager(uuid), public.sp_can_manage_challenge(uuid), public.sp_can_review_challenge(uuid),
  public.sp_is_participant(uuid), public.sp_can_view_challenge(uuid), public.sp_is_university_staff_for(uuid),
  public.sp_shares_challenge_with(uuid), public.sp_company_sees_student(uuid), public.sp_in_talent_pool(uuid), public.sp_can_view_profile(uuid),
  public.sp_match_score(uuid, uuid), public.sp_challenge_counts(uuid), public.sp_competency_json(public.competencies),
  public.sp_activity_feed(uuid), public.sp_credential_public_json(uuid), public.sp_raise(text, text)
  to authenticated;

-- API surface for signed-in users.
grant execute on function public.sp_me(jsonb), public.sp_lookups(jsonb), public.sp_org_overview(jsonb), public.sp_student_dashboard(jsonb),
  public.sp_challenges(jsonb), public.sp_challenge(jsonb), public.sp_workspace(jsonb), public.sp_validation_queue(jsonb),
  public.sp_validation(jsonb), public.sp_skillpass_me(jsonb), public.sp_talent_profile(jsonb), public.sp_talent(jsonb),
  public.sp_company_dashboard(jsonb), public.sp_university_dashboard(jsonb), public.sp_admin_overview(jsonb), public.sp_admin_list(jsonb),
  public.sp_notifications(jsonb), public.sp_evidence_file(jsonb),
  public.sp_accept_invitations(jsonb), public.sp_complete_onboarding(jsonb), public.sp_update_profile(jsonb), public.sp_update_privacy(jsonb),
  public.sp_update_organization(jsonb), public.sp_invite_member(jsonb), public.sp_revoke_invitation(jsonb), public.sp_remove_member(jsonb),
  public.sp_save_challenge(jsonb), public.sp_set_challenge_status(jsonb), public.sp_apply(jsonb), public.sp_withdraw_application(jsonb),
  public.sp_decide_application(jsonb), public.sp_end_assignment(jsonb), public.sp_invite_to_challenge(jsonb),
  public.sp_save_task(jsonb), public.sp_set_task_status(jsonb), public.sp_delete_task(jsonb),
  public.sp_add_evidence(jsonb), public.sp_update_evidence(jsonb), public.sp_delete_evidence(jsonb), public.sp_set_evidence_visibility(jsonb),
  public.sp_save_vath(jsonb), public.sp_delete_vath(jsonb), public.sp_submit_for_validation(jsonb), public.sp_complete_validation(jsonb),
  public.sp_set_credential_verification(jsonb), public.sp_revoke_credential(jsonb),
  public.sp_admin_set_org_status(jsonb), public.sp_admin_set_user_role(jsonb), public.sp_admin_set_member(jsonb),
  public.sp_admin_save_competency(jsonb), public.sp_report_incident(jsonb), public.sp_admin_update_incident(jsonb),
  public.sp_mark_notifications_read(jsonb)
  to authenticated;

-- Anonymous verification surface.
grant execute on function public.sp_public_skillpass(jsonb), public.sp_public_credential(jsonb), public.sp_public_evidence_file(jsonb)
  to anon, authenticated;
