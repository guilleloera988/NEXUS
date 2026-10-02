-- SkillPass — authorization helpers, row level security and grants.
--
-- Helpers are SECURITY DEFINER so policies can consult other tables without
-- recursive RLS evaluation. They only ever answer questions about auth.uid().

create function public.sp_current_role() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.sp_is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create function public.sp_my_university_id() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select university_id from public.profiles where id = auth.uid()
$$;

-- auth.users is not readable by API roles; expose only the caller's own e-mail.
create function public.sp_auth_email() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select lower(email) from auth.users where id = auth.uid()
$$;

create function public.sp_is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.organization_members where organization_id = p_org and user_id = auth.uid())
$$;

create function public.sp_is_org_manager(p_org uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.sp_is_admin() or exists(
    select 1 from public.organization_members
    where organization_id = p_org and user_id = auth.uid() and member_role in ('owner','manager'))
$$;

-- Company owners/managers of the challenge organization, or AINDEV admin.
create function public.sp_can_manage_challenge(p_challenge uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.sp_is_admin() or exists(
    select 1 from public.challenges c
    join public.organization_members m on m.organization_id = c.organization_id
    where c.id = p_challenge and m.user_id = auth.uid() and m.member_role in ('owner','manager'))
$$;

-- Managers plus the challenge supervisor (who must still belong to the organization).
create function public.sp_can_review_challenge(p_challenge uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.sp_can_manage_challenge(p_challenge) or exists(
    select 1 from public.challenges c
    join public.organization_members m on m.organization_id = c.organization_id and m.user_id = c.supervisor_id
    where c.id = p_challenge and c.supervisor_id = auth.uid())
$$;

create function public.sp_is_participant(p_challenge uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.assignments
    where challenge_id = p_challenge and student_id = auth.uid() and status in ('active','completed'))
$$;

create function public.sp_can_view_challenge(p_challenge uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(
    select 1 from public.challenges c
    where c.id = p_challenge and (
      c.status in ('published','recruiting','active','under_review','completed')
      or public.sp_is_admin()
      or public.sp_is_org_member(c.organization_id)
      or exists(select 1 from public.applications a where a.challenge_id = c.id and a.student_id = auth.uid())
      or public.sp_is_participant(c.id)))
$$;

-- Staff of the (verified) university the student affiliated with during onboarding.
create function public.sp_is_university_staff_for(p_student uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(
    select 1 from public.profiles s
    join public.organizations o on o.id = s.university_id and o.kind = 'university' and o.verification_status = 'verified'
    join public.organization_members m on m.organization_id = o.id and m.user_id = auth.uid()
    where s.id = p_student and s.role = 'student')
$$;

create function public.sp_shares_challenge_with(p_student uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(
    select 1 from public.assignments mine
    join public.assignments theirs on theirs.challenge_id = mine.challenge_id
    where mine.student_id = auth.uid() and theirs.student_id = p_student
      and mine.status in ('active','completed') and theirs.status in ('active','completed'))
$$;

-- A company sees students who applied to, or work on, challenges it can review.
create function public.sp_company_sees_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.applications a where a.student_id = p_student and public.sp_can_review_challenge(a.challenge_id))
      or exists(select 1 from public.assignments a where a.student_id = p_student and public.sp_can_review_challenge(a.challenge_id))
$$;

-- Verified Talent: only students who explicitly opted in, only for verified companies or admin.
create function public.sp_in_talent_pool(p_student uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.profiles s
      where s.id = p_student and s.role = 'student' and s.open_to_opportunities and s.onboarding_completed)
    and (public.sp_is_admin() or exists(
      select 1 from public.organization_members m join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid() and o.kind = 'company' and o.verification_status = 'verified'))
$$;

create function public.sp_can_view_profile(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_id = auth.uid() or public.sp_is_admin() or exists(
    select 1 from public.profiles t where t.id = p_id and (
      (t.role = 'student' and (public.sp_shares_challenge_with(p_id) or public.sp_company_sees_student(p_id)
        or public.sp_is_university_staff_for(p_id) or public.sp_in_talent_pool(p_id)))
      or (t.role <> 'student' and (
        exists(select 1 from public.organization_members a join public.organization_members b on b.organization_id = a.organization_id
               where a.user_id = auth.uid() and b.user_id = p_id)
        or exists(select 1 from public.challenges c where c.supervisor_id = p_id and public.sp_can_view_challenge(c.id))
        or exists(select 1 from public.organization_members m join public.challenges c on c.organization_id = m.organization_id
               where m.user_id = p_id and (public.sp_is_participant(c.id)
                 or exists(select 1 from public.applications a where a.challenge_id = c.id and a.student_id = auth.uid())))))))
$$;

-- ---------------------------------------------------------------------------
-- Row level security: enabled on every table, SELECT policies only.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['organizations','profiles','organization_members','invitations','competencies','declared_skills',
    'challenges','challenge_competencies','challenge_deliverables','applications','assignments','tasks','evidence',
    'evidence_competencies','vath_entries','vath_entry_evidence','validation_requests','validation_request_items',
    'validation_decisions','competency_assessments','credentials','notifications','audit_logs','incidents'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy organizations_select on public.organizations for select to authenticated
  using (verification_status = 'verified' or public.sp_is_org_member(id) or public.sp_is_admin()
         or id = public.sp_my_university_id());

create policy profiles_select on public.profiles for select to authenticated
  using (public.sp_can_view_profile(id));

create policy organization_members_select on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.sp_is_org_member(organization_id) or public.sp_is_admin());

create policy invitations_select on public.invitations for select to authenticated
  using (public.sp_is_org_manager(organization_id)
         or email = public.sp_auth_email());

create policy competencies_select on public.competencies for select to authenticated using (true);

create policy declared_skills_select on public.declared_skills for select to authenticated
  using (public.sp_can_view_profile(student_id));

create policy challenges_select on public.challenges for select to authenticated
  using (public.sp_can_view_challenge(id));

create policy challenge_competencies_select on public.challenge_competencies for select to authenticated
  using (public.sp_can_view_challenge(challenge_id));

create policy challenge_deliverables_select on public.challenge_deliverables for select to authenticated
  using (public.sp_can_view_challenge(challenge_id));

create policy applications_select on public.applications for select to authenticated
  using (student_id = auth.uid() or public.sp_can_review_challenge(challenge_id));

create policy assignments_select on public.assignments for select to authenticated
  using (student_id = auth.uid() or public.sp_is_participant(challenge_id)
         or public.sp_can_review_challenge(challenge_id) or public.sp_is_university_staff_for(student_id));

create policy tasks_select on public.tasks for select to authenticated
  using (public.sp_is_participant(challenge_id) or public.sp_can_review_challenge(challenge_id));

-- Drafts stay private to their author (and admin). Teammates and reviewers see submitted work.
-- University staff never see evidence content.
create policy evidence_select on public.evidence for select to authenticated
  using (student_id = auth.uid() or public.sp_is_admin()
         or (status <> 'draft' and (public.sp_can_review_challenge(challenge_id) or public.sp_is_participant(challenge_id))));

create policy evidence_competencies_select on public.evidence_competencies for select to authenticated
  using (exists(select 1 from public.evidence e where e.id = evidence_id));

-- Hours are personal: owner, reviewers (once submitted) and admin.
create policy vath_entries_select on public.vath_entries for select to authenticated
  using (student_id = auth.uid() or public.sp_is_admin()
         or (status <> 'draft' and public.sp_can_review_challenge(challenge_id)));

create policy vath_entry_evidence_select on public.vath_entry_evidence for select to authenticated
  using (exists(select 1 from public.vath_entries v where v.id = vath_entry_id));

create policy validation_requests_select on public.validation_requests for select to authenticated
  using (student_id = auth.uid() or public.sp_can_review_challenge(challenge_id));

create policy validation_request_items_select on public.validation_request_items for select to authenticated
  using (exists(select 1 from public.validation_requests r where r.id = request_id));

create policy validation_decisions_select on public.validation_decisions for select to authenticated
  using (exists(select 1 from public.validation_requests r where r.id = request_id));

create policy competency_assessments_select on public.competency_assessments for select to authenticated
  using (student_id = auth.uid() or public.sp_can_review_challenge(challenge_id) or public.sp_is_university_staff_for(student_id));

create policy credentials_select on public.credentials for select to authenticated
  using (student_id = auth.uid() or public.sp_can_manage_challenge(challenge_id) or public.sp_is_university_staff_for(student_id)
         or (status = 'active' and public.sp_in_talent_pool(student_id)));

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.sp_is_admin() or subject_id = auth.uid() or actor_id = auth.uid()
         or (challenge_id is not null and public.sp_can_manage_challenge(challenge_id))
         or (organization_id is not null and public.sp_is_org_manager(organization_id)));

create policy incidents_select on public.incidents for select to authenticated
  using (reported_by = auth.uid() or public.sp_is_admin());

-- ---------------------------------------------------------------------------
-- Grants. Explicit table list so unrelated tables in the project are untouched.
-- ---------------------------------------------------------------------------
revoke all on public.organizations, public.profiles, public.organization_members, public.invitations, public.competencies,
  public.declared_skills, public.challenges, public.challenge_competencies, public.challenge_deliverables, public.applications,
  public.assignments, public.tasks, public.evidence, public.evidence_competencies, public.vath_entries, public.vath_entry_evidence,
  public.validation_requests, public.validation_request_items, public.validation_decisions, public.competency_assessments,
  public.credentials, public.notifications, public.audit_logs, public.incidents, public.student_verified_competencies
  from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.organizations, public.profiles, public.organization_members, public.invitations, public.competencies,
  public.declared_skills, public.challenges, public.challenge_competencies, public.challenge_deliverables, public.applications,
  public.assignments, public.tasks, public.evidence, public.evidence_competencies, public.vath_entries, public.vath_entry_evidence,
  public.validation_requests, public.validation_request_items, public.validation_decisions, public.competency_assessments,
  public.credentials, public.notifications, public.audit_logs, public.incidents, public.student_verified_competencies
  to authenticated;
