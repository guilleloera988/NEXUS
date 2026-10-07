-- SkillPass — confidential credentials must not reveal the company (security review H-3).
--
-- For publication_policy = 'confidential' the public verification already hid the challenge title
-- and the organization, but still returned the supervisor's name and free-text title (e.g.
-- "Gerente de Mejora Continua · Nova Manufacturing"), which names the company. Both are now null
-- for confidential credentials. The snapshot is immutable, so masking happens at read time and
-- covers credentials issued before this migration. CREATE OR REPLACE keeps owner and grants.
create or replace function public.sp_credential_public_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  -- Masks challenge, company and validator identity when the challenge is confidential; lists only
  -- evidence the student made public and the challenge allows publishing. Returns null unless the
  -- credential is publicly verifiable or the caller may already read it.
  select jsonb_build_object(
    'code', cr.code, 'status', cr.status, 'issued_at', cr.issued_at, 'revoked_at', cr.revoked_at, 'is_demo', cr.is_demo,
    'confidential', v.conf,
    'challenge_title', case when v.conf then null else cr.snapshot->>'challenge_title' end,
    'organization_name', case when v.conf then null else cr.snapshot->>'organization_name' end,
    'industry', cr.snapshot->>'industry', 'modality', cr.snapshot->>'modality',
    'start_date', cr.snapshot->>'start_date', 'end_date', cr.snapshot->>'end_date',
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
