-- SkillPass — scope sp_match_score (security review H-2, docs/SECURITY.md §6).
--
-- Before, any reviewer of ANY challenge (including a self-service, unverified company with a draft
-- challenge) could score ANY student and read verified/declared/missing per competency plus
-- interest, career and availability signals that RLS hides from them. Now:
--   * a reviewer may score a student only for a challenge that student applied to and did not
--     withdraw from (the only reviewer-side use: the candidates list of that challenge);
--   * a student may score themselves only against challenges they can see;
--   * the admin keeps full access.
-- The scoring itself is unchanged. CREATE OR REPLACE keeps the owner and the EXECUTE grant that
-- the SECURITY INVOKER read RPCs (sp_challenges, sp_challenge, sp_student_dashboard) rely on.
create or replace function public.sp_match_score(p_student uuid, p_challenge uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.profiles; c public.challenges; v_total int; v_credit numeric;
  v_skills numeric; v_interests numeric; v_career numeric; v_avail numeric; v_weekly numeric; v_comps jsonb;
begin
  if not ((p_student = auth.uid() and public.sp_can_view_challenge(p_challenge)) or public.sp_is_admin()
          or (public.sp_can_review_challenge(p_challenge)
              and exists(select 1 from public.applications ap where ap.challenge_id = p_challenge and ap.student_id = p_student
                         and ap.status <> 'withdrawn'))) then
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
