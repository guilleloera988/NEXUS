-- SkillPass — talent-pool viewers read credentials only through masked output (security review H-6,
-- docs/SECURITY.md §6).
--
-- credentials_select let any member of any verified company SELECT the full credentials row of a
-- student in the talent pool, including the immutable snapshot (organization, challenge title,
-- supervisor) of CONFIDENTIAL credentials, plus challenge_id / organization_id. The public and
-- talent RPCs already mask those fields; only the raw table leaked them.
--
-- 1. The talent-pool branch is removed from credentials_select: the raw row stays readable by its
--    holder, the managers of its challenge (and admin) and the holder's university staff.
-- 2. sp_visible_credentials_json(student) returns the masked public JSON of the active credentials
--    the caller could read before (same four rules, talent pool included). sp_talent_profile uses it.
-- 3. sp_talent becomes SECURITY DEFINER. It already admits only admin or members of a verified
--    company and already restricts rows to the talent-pool cohort (opted-in, onboarded students),
--    which is exactly what RLS granted those callers. Its university name now requires a verified
--    university (as organizations_select did), and the challenge filter ignores confidential
--    credentials unless the caller manages that challenge, so it no longer reveals who completed a
--    confidential challenge of another company.
-- CREATE OR REPLACE keeps the owner and EXECUTE grants of the existing functions.

alter policy credentials_select on public.credentials
  using (student_id = (select auth.uid()) or public.sp_can_manage_challenge(challenge_id)
         or public.sp_is_university_staff_for(student_id));

create function public.sp_visible_credentials_json(p_student uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(x.j order by x.issued_at desc), '[]'::jsonb) from (
    select cr.issued_at, public.sp_credential_public_json(cr.id) as j
    from public.credentials cr
    where cr.student_id = p_student and cr.status = 'active'
      and (cr.student_id = auth.uid() or public.sp_can_manage_challenge(cr.challenge_id)
           or public.sp_is_university_staff_for(cr.student_id) or public.sp_in_talent_pool(cr.student_id))) x
  where x.j is not null
$$;
revoke all on function public.sp_visible_credentials_json(uuid) from public, anon;
grant execute on function public.sp_visible_credentials_json(uuid) to authenticated;

create or replace function public.sp_talent_profile(p jsonb) returns jsonb
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
    'credentials', public.sp_visible_credentials_json(pr.id),
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

create or replace function public.sp_talent(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_q text := nullif(btrim(coalesce(p->>'q', '')), ''); v_comp uuid := nullif(p->>'competency_id', '')::uuid;
  v_verified boolean := coalesce((p->>'verified_only')::boolean, false); v_min numeric := coalesce(nullif(p->>'min_vath', '')::numeric, 0);
  v_career text := nullif(btrim(coalesce(p->>'career', '')), ''); v_uni uuid := nullif(p->>'university_id', '')::uuid;
  v_avail text := nullif(p->>'availability', ''); v_challenge uuid := nullif(p->>'challenge_id', '')::uuid;
  v_sort text := coalesce(nullif(p->>'sort', ''), 'name');
  v_challenge_visible boolean;
begin
  if not (public.sp_is_admin() or exists(select 1 from public.organization_members m join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid() and o.kind = 'company' and o.verification_status = 'verified')) then
    return jsonb_build_object('items', '[]'::jsonb, 'allowed', false);
  end if;
  v_challenge_visible := v_challenge is not null and public.sp_can_manage_challenge(v_challenge);
  return jsonb_build_object('allowed', true, 'items', (select coalesce(jsonb_agg(x order by
      case when v_sort = 'vath' then -x.verified_vath else 0 end, x.full_name), '[]'::jsonb) from (
    select pr.id, pr.full_name, pr.headline, pr.career, pr.semester, pr.availability, pr.hours_per_week, pr.is_demo,
      (select name from public.organizations o where o.id = pr.university_id and o.verification_status = 'verified') as university,
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
      and (v_challenge is null or exists(select 1 from public.credentials cr where cr.student_id = pr.id and cr.challenge_id = v_challenge
        and cr.status = 'active' and (v_challenge_visible or cr.snapshot->>'publication_policy' <> 'confidential')))
      and (v_comp is null or (
        exists(select 1 from public.credentials cr, jsonb_array_elements(cr.snapshot->'competencies') k
          where cr.student_id = pr.id and cr.status = 'active' and k->>'competency_id' = v_comp::text)
        or (not v_verified and exists(select 1 from public.declared_skills ds where ds.student_id = pr.id and ds.competency_id = v_comp))))
      and (not v_verified or exists(select 1 from public.credentials cr where cr.student_id = pr.id and cr.status = 'active'))
    limit 200) x where x.verified_vath >= v_min));
end $$;
