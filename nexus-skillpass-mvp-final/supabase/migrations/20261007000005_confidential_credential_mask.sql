-- SkillPass — confidential credentials must not reveal the company (security review H-3).
--
-- For publication_policy = 'confidential' the public verification already hid the challenge title
-- and the organization, but still returned
--   * the supervisor's name and free-text title (e.g. "Gerente de Mejora Continua · Nova
--     Manufacturing"), which names the company, and
--   * the exact start/end dates and modality, which together with the industry identify the
--     challenge in the public challenge list.
-- All of them are now null for confidential credentials (industry, hours, competencies and the
-- issue date remain). The public SkillPass summary also stops counting the validators of
-- confidential credentials, so a publicly named validator cannot be matched to them.
-- The snapshot is immutable, so masking happens at read time and covers credentials issued before
-- this migration. CREATE OR REPLACE keeps owners and grants.
create or replace function public.sp_credential_public_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  -- Masks challenge, company, validator and exact dates when the challenge is confidential; lists only
  -- evidence the student made public and the challenge allows publishing. Returns null unless the
  -- credential is publicly verifiable or the caller may already read it.
  select jsonb_build_object(
    'code', cr.code, 'status', cr.status, 'issued_at', cr.issued_at, 'revoked_at', cr.revoked_at, 'is_demo', cr.is_demo,
    'confidential', v.conf,
    'challenge_title', case when v.conf then null else cr.snapshot->>'challenge_title' end,
    'organization_name', case when v.conf then null else cr.snapshot->>'organization_name' end,
    'industry', cr.snapshot->>'industry',
    'modality', case when v.conf then null else cr.snapshot->>'modality' end,
    'start_date', case when v.conf then null else cr.snapshot->>'start_date' end,
    'end_date', case when v.conf then null else cr.snapshot->>'end_date' end,
    'verified_hours', (cr.snapshot->>'verified_hours')::numeric,
    'competencies', coalesce(cr.snapshot->'competencies', '[]'::jsonb),
    'supervisor_name', case when v.conf then null else cr.snapshot->>'supervisor_name' end,
    'supervisor_title', case when v.conf then null else cr.snapshot->>'supervisor_title' end,
    'evidence_approved', (cr.snapshot->>'evidence_approved')::int,
    'issuer', cr.snapshot->>'issuer',
    'public_evidence', case when cr.snapshot->>'publication_policy' = 'public_allowed' then (
      select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'kind', e.kind, 'url', e.url,
        'has_file', e.storage_path is not null, 'file_name', e.file_name) order by e.created_at), '[]'::jsonb)
      from public.evidence e where e.assignment_id = cr.assignment_id and e.is_public and e.status = 'approved') else '[]'::jsonb end)
  from public.credentials cr
  cross join lateral (select cr.snapshot->>'publication_policy' = 'confidential' as conf) v
  where cr.id = p_id and (
    cr.verification_enabled or cr.student_id = auth.uid() or public.sp_is_admin()
    or public.sp_can_manage_challenge(cr.challenge_id) or public.sp_is_university_staff_for(cr.student_id))
$$;

create or replace function public.sp_public_skillpass(p jsonb) returns jsonb
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
      'validators', (select count(distinct issued_by) from public.credentials where student_id = pr.id and status = 'active' and verification_enabled
        and snapshot->>'publication_policy' <> 'confidential')));
end $$;
