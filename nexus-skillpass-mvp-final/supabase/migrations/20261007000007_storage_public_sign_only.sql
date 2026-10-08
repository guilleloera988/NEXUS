-- SkillPass — public evidence files may be signed/downloaded by exact path, never listed
-- (security review H-5, docs/SECURITY.md §6).
--
-- evidence_select_public (20261002000005_storage.sql) let anon/any signed-in user SELECT every
-- public evidence object, so POST /storage/v1/object/list/evidence enumerated all of them
-- (student uuid / challenge uuid / file name / size / timestamps) without a credential code.
-- Supabase Storage sets the transaction-local GUC `storage.operation` for every request
-- (storage.operation(), storage-api tenant migration 0024); the public download route only
-- needs `storage.object.sign` (createSignedUrl), and signed-URL redemption bypasses RLS.
-- Fails closed when the GUC is absent (direct PostgREST/SQL access, older storage-api).
do $outer$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema not present; skipping';
    return;
  end if;
  execute 'drop policy if exists evidence_select_public on storage.objects';
  execute $p$
    create policy evidence_select_public on storage.objects for select to anon, authenticated
    using (
      bucket_id = 'evidence'
      and coalesce(current_setting('storage.operation', true), '') in ('storage.object.sign', 'storage.object.sign_many')
      and public.sp_is_public_evidence_object(name))
  $p$;
end
$outer$;
