-- SkillPass — the workspace activity feed must not reveal more than row level security does
-- (security review H-4, docs/SECURITY.md §6).
--
-- sp_activity_feed is SECURITY DEFINER and reads audit_logs directly, so it bypassed
--   * evidence_select            (drafts are private to their author, even from reviewers), and
--   * validation_requests_select / applications_select (a student only sees their own requests
--     and applications; reviewers see all of the challenge).
-- Each audit row is now filtered by the same rule as the row it describes. Evidence titles are
-- taken from the current evidence row (not the audit snapshot), so deleted drafts and titles that
-- were renamed before submission never surface.
--
-- The caller's context (uid, admin, reviewer, participant) is evaluated once per call, so hidden
-- rows cost no extra function calls before the 25 visible ones are found.
--
-- CREATE OR REPLACE keeps the existing ACL (execute for authenticated only); a DROP + CREATE would
-- pick up Supabase's default privileges and expose the function to anon.
create or replace function public.sp_activity_feed(p_challenge uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with ctx as materialized (
    select auth.uid() as uid, public.sp_is_admin() as adm, public.sp_can_review_challenge(p_challenge) as rev,
           public.sp_is_participant(p_challenge) as part)
  select case when ctx.part or ctx.rev then (
    select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
      select l.action, l.created_at, pr.full_name as actor_name,
        jsonb_strip_nulls(jsonb_build_object(
          'title', case when l.action = 'evidence_added' then e.title else l.after->>'title' end,
          'status', l.after->>'status', 'outcome', l.after->>'outcome')) as details
      from public.audit_logs l
      left join public.profiles pr on pr.id = l.actor_id
      left join public.evidence e on l.action = 'evidence_added' and e.id = l.entity_id
      where l.challenge_id = p_challenge and l.action in ('task_created','task_status_changed','evidence_added','validation_requested',
        'validation_completed','credential_issued','challenge_status_changed','application_decided')
        and case
          when l.action = 'evidence_added' then
            e.id is not null and (e.student_id = ctx.uid or ctx.adm or e.status <> 'draft')
          when l.action in ('validation_requested','validation_completed','credential_issued','application_decided') then
            l.subject_id = ctx.uid or ctx.rev
          else true end
      order by l.created_at desc limit 25) x)
  else '[]'::jsonb end
  from ctx
$$;
revoke all on function public.sp_activity_feed(uuid) from public, anon;
grant execute on function public.sp_activity_feed(uuid) to authenticated;
