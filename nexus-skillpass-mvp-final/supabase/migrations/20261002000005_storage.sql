-- SkillPass — Supabase Storage for evidence files.
--
-- Private bucket. Object path: "<student uuid>/<challenge uuid>/<random>-<file name>".
-- The application server uploads with the signed-in user's JWT, so these policies
-- are the enforcement point; downloads are served through short-lived signed URLs
-- after an RLS-checked lookup (sp_evidence_file / sp_public_evidence_file).
--
-- Skipped automatically where the storage schema does not exist (local PGlite DEMO).

-- True only for files of evidence the student published, the challenge allows publishing,
-- and whose credential is active and publicly verifiable. Lets anonymous visitors of a
-- public SkillPass open those files without a service-role key in the application.
create function public.sp_is_public_evidence_object(p_name text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(
    select 1 from public.evidence e
    join public.credentials cr on cr.assignment_id = e.assignment_id and cr.status = 'active' and cr.verification_enabled
    where e.storage_path = p_name and e.is_public and e.status = 'approved'
      and cr.snapshot->>'publication_policy' = 'public_allowed')
$$;
revoke all on function public.sp_is_public_evidence_object(text) from public, anon, authenticated;
grant execute on function public.sp_is_public_evidence_object(text) to anon, authenticated;

do $outer$
begin
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present; skipping evidence bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('evidence', 'evidence', false, 10485760, array[
    'application/pdf','image/png','image/jpeg','image/webp','image/gif','text/plain','text/csv','application/zip',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword','application/vnd.ms-powerpoint','application/vnd.ms-excel'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  -- Students upload only into their own folder and only for a challenge they actively work on.
  execute $p$
    create policy evidence_insert_own on storage.objects for insert to authenticated
    with check (
      bucket_id = 'evidence'
      and (storage.foldername(name))[1] = auth.uid()::text
      and exists(select 1 from public.assignments a
                 where a.student_id = auth.uid() and a.status = 'active'
                   and a.challenge_id::text = (storage.foldername(name))[2]))
  $p$;

  -- Read access mirrors evidence visibility (owner, reviewers of the challenge for non-draft
  -- evidence, admin). Owners always see their own folder: Storage returns the inserted row on
  -- upload and needs SELECT visibility to delete, before an evidence row references the file.
  execute $p$
    create policy evidence_select_visible on storage.objects for select to authenticated
    using (
      bucket_id = 'evidence'
      and ((storage.foldername(name))[1] = auth.uid()::text
           or exists(select 1 from public.evidence e where e.storage_path = name)))
  $p$;

  -- Anonymous (and any signed-in) visitors may read files of explicitly public evidence.
  execute $p$
    create policy evidence_select_public on storage.objects for select to anon, authenticated
    using (bucket_id = 'evidence' and public.sp_is_public_evidence_object(name))
  $p$;

  -- Owners may remove a file only while its evidence row is still a draft (or was never registered).
  execute $p$
    create policy evidence_delete_own_draft on storage.objects for delete to authenticated
    using (
      bucket_id = 'evidence'
      and (storage.foldername(name))[1] = auth.uid()::text
      and not exists(select 1 from public.evidence e where e.storage_path = name and e.status <> 'draft'))
  $p$;
end
$outer$;
