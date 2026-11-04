-- SkillPass — RLS evaluation cost (Supabase performance advisor: auth_rls_initplan).
--
-- Policies that call auth.uid() or a no-argument helper (sp_is_admin, sp_my_university_id,
-- sp_auth_email) directly re-evaluate it for every row. Wrapping the call in a scalar
-- sub-select turns it into an InitPlan evaluated once per statement. The helpers are STABLE
-- and only depend on the caller, so every policy keeps exactly the same meaning; only the
-- expressions change (roles and commands stay as created in 20261002000002_security_rls.sql).

alter policy organizations_select on public.organizations
  using (verification_status = 'verified' or public.sp_is_org_member(id) or (select public.sp_is_admin())
         or id = (select public.sp_my_university_id()));

alter policy organization_members_select on public.organization_members
  using (user_id = (select auth.uid()) or public.sp_is_org_member(organization_id) or (select public.sp_is_admin()));

alter policy invitations_select on public.invitations
  using (public.sp_is_org_manager(organization_id)
         or email = (select public.sp_auth_email()));

alter policy applications_select on public.applications
  using (student_id = (select auth.uid()) or public.sp_can_review_challenge(challenge_id));

alter policy assignments_select on public.assignments
  using (student_id = (select auth.uid()) or public.sp_is_participant(challenge_id)
         or public.sp_can_review_challenge(challenge_id) or public.sp_is_university_staff_for(student_id));

alter policy evidence_select on public.evidence
  using (student_id = (select auth.uid()) or (select public.sp_is_admin())
         or (status <> 'draft' and (public.sp_can_review_challenge(challenge_id) or public.sp_is_participant(challenge_id))));

alter policy vath_entries_select on public.vath_entries
  using (student_id = (select auth.uid()) or (select public.sp_is_admin())
         or (status <> 'draft' and public.sp_can_review_challenge(challenge_id)));

alter policy validation_requests_select on public.validation_requests
  using (student_id = (select auth.uid()) or public.sp_can_review_challenge(challenge_id));

alter policy competency_assessments_select on public.competency_assessments
  using (student_id = (select auth.uid()) or public.sp_can_review_challenge(challenge_id) or public.sp_is_university_staff_for(student_id));

alter policy credentials_select on public.credentials
  using (student_id = (select auth.uid()) or public.sp_can_manage_challenge(challenge_id) or public.sp_is_university_staff_for(student_id)
         or (status = 'active' and public.sp_in_talent_pool(student_id)));

alter policy notifications_select on public.notifications
  using (user_id = (select auth.uid()));

alter policy audit_logs_select on public.audit_logs
  using ((select public.sp_is_admin()) or subject_id = (select auth.uid()) or actor_id = (select auth.uid())
         or (challenge_id is not null and public.sp_can_manage_challenge(challenge_id))
         or (organization_id is not null and public.sp_is_org_manager(organization_id)));

alter policy incidents_select on public.incidents
  using (reported_by = (select auth.uid()) or (select public.sp_is_admin()));
