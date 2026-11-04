-- Antivirus for evidence files (pilot readiness).
--
-- The app server scans every upload with ClamAV (scanner/) before storing it; an infected file is never stored.
-- When it stores a clean file it attests the scan to sp_add_evidence with a token derived from SCANNER_TOKEN,
-- whose SHA-256 is kept in platform_settings ('scan_gate'), so nobody can mark a file as scanned from outside.
-- evidence.scanned_at records the scan. With platform_settings.scan_required = true (production, once the scanner
-- runs) a file without that attestation is refused, and a file that was never scanned (stored before) stays in
-- quarantine: only its owner can open it. The setting starts off everywhere: local DEMO, the demo project and
-- new databases behave as before until an operator stores the gate and turns it on.

alter table public.evidence
  add column scanned_at timestamptz,
  add column scan_engine text check (scan_engine is null or char_length(scan_engine) <= 120),
  add constraint evidence_scan_file_only check (scanned_at is null or storage_path is not null),
  add constraint evidence_scan_engine_pair check ((scanned_at is null) = (scan_engine is null));

insert into public.platform_settings(key, value) values ('scan_required', 'false'::jsonb);

create function public.sp_scan_required() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select value = 'true'::jsonb from public.platform_settings where key = 'scan_required'), false)
$$;

-- True when p_token is the app server's gate token (its SHA-256 is the stored 'scan_gate').
create function public.sp_scan_gate_ok(p_token text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(p_token is not null and exists(
    select 1 from public.platform_settings
    where key = 'scan_gate' and value #>> '{}' ~ '^[0-9a-f]{64}$'
      and value #>> '{}' = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')), false)
$$;

-- p_scan = {gate, verdict: 'clean', engine}: the server's statement that it scanned the file it is registering.
create function public.sp_scan_attested(p_scan jsonb) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_typeof(p_scan) = 'object' and jsonb_typeof(p_scan -> 'gate') = 'string'
    and p_scan ->> 'verdict' = 'clean' and public.sp_scan_gate_ok(p_scan ->> 'gate'), false)
$$;

-- sp_add_evidence: as in 20261015000001, plus the scan attestation.
create or replace function public.sp_add_evidence(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.profiles := public.sp_actor(); v_asg public.assignments; c public.challenges; v_prev public.evidence; v_id uuid;
  v_kind text := public.sp_choice(p, 'kind', array['file','image','pdf','document','presentation','link','repository','video']);
  v_url text := nullif(public.sp_text(p, 'url', 0, 2048), ''); v_path text := nullif(public.sp_text(p, 'storage_path', 0, 400), '');
  v_mime text := nullif(public.sp_text(p, 'mime_type', 0, 120), ''); v_size int := public.sp_int(p, 'size_bytes', 1, 10485760, false);
  v_file text := nullif(public.sp_text(p, 'file_name', 0, 200), ''); v_comps uuid[] := public.sp_uuid_array(p, 'competency_ids', 10);
  v_deliverable uuid := public.sp_uuid(p, 'deliverable_id', false); v_task uuid := public.sp_uuid(p, 'task_id', false);
  v_previous uuid := public.sp_uuid(p, 'previous_id', false); v_version int := 1;
  v_scanned boolean := false; v_engine text;
begin
  if a.role <> 'student' then perform public.sp_forbidden('students_only'); end if;
  v_asg := public.sp_student_assignment(public.sp_uuid(p, 'challenge_id'));
  select * into c from public.challenges where id = v_asg.challenge_id;

  if (v_url is null) = (v_path is null) then perform public.sp_raise('evidence_source_required', 'url'); end if;
  if v_url is not null then
    if v_url !~ '^https://[^[:space:]@]+$' then perform public.sp_raise('invalid_field', 'url'); end if;
    if v_kind not in ('link','repository','video','presentation','document') then perform public.sp_raise('invalid_field', 'kind'); end if;
    v_mime := null; v_size := null; v_file := null;
  else
    -- Files are uploaded by the server to "<student uuid>/<challenge uuid>/<random>-<name>".
    if v_path !~ ('^' || a.id::text || '/' || c.id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$') then
      perform public.sp_raise('invalid_field', 'storage_path');
    end if;
    if v_kind not in ('file','image','pdf','document','presentation') or v_file is null or v_size is null then
      perform public.sp_raise('invalid_field', 'kind');
    end if;
    if v_mime is null or v_mime not in ('application/pdf','image/png','image/jpeg','image/webp','image/gif','text/plain','text/csv','application/zip',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.ms-powerpoint','application/vnd.ms-excel') then
      perform public.sp_raise('invalid_file_type', 'mime_type');
    end if;
    -- Antivirus (20261105000001): only the app server can attest that it scanned this file and found it clean.
    v_scanned := public.sp_scan_attested(p -> 'scan');
    if not v_scanned and public.sp_scan_required() then perform public.sp_raise('file_not_scanned', 'file'); end if;
    if v_scanned then
      v_engine := coalesce(nullif(left(regexp_replace(coalesce(p #>> '{scan,engine}', ''), '[^[:print:]]', '', 'g'), 120), ''), 'ClamAV');
    end if;
  end if;
  if v_task is null then perform public.sp_raise('field_required', 'task_id'); end if;
  if v_deliverable is null and exists(select 1 from public.challenge_deliverables where challenge_id = c.id) then
    perform public.sp_raise('field_required', 'deliverable_id');
  end if;
  if v_deliverable is not null and not exists(select 1 from public.challenge_deliverables where id = v_deliverable and challenge_id = c.id) then
    perform public.sp_raise('invalid_field', 'deliverable_id');
  end if;
  if v_task is not null and not exists(select 1 from public.tasks where id = v_task and challenge_id = c.id) then
    perform public.sp_raise('invalid_field', 'task_id');
  end if;
  if exists(select 1 from unnest(v_comps) x where not exists(select 1 from public.challenge_competencies cc where cc.challenge_id = c.id and cc.competency_id = x)) then
    perform public.sp_raise('invalid_field', 'competency_ids');
  end if;
  if v_previous is not null then
    select * into v_prev from public.evidence where id = v_previous;
    if not found or v_prev.student_id <> a.id or v_prev.challenge_id <> c.id then perform public.sp_raise('invalid_field', 'previous_id'); end if;
    v_version := v_prev.version + 1;
  end if;

  insert into public.evidence(challenge_id, assignment_id, student_id, deliverable_id, task_id, title, description, kind, url, storage_path,
    file_name, mime_type, size_bytes, version, previous_id, is_public, scanned_at, scan_engine)
  values (c.id, v_asg.id, a.id, v_deliverable, v_task, public.sp_text(p, 'title', 2, 160), public.sp_text(p, 'description', 0, 2000), v_kind,
    v_url, v_path, v_file, v_mime, v_size, v_version, v_previous,
    public.sp_bool(p, 'is_public', false) and c.publication_policy = 'public_allowed',
    case when v_scanned then now() end, v_engine)
  returning id into v_id;
  insert into public.evidence_competencies(evidence_id, competency_id) select v_id, x from unnest(v_comps) x;
  perform public.sp_audit('evidence_added', 'evidence', v_id, c.organization_id, c.id, a.id, '{}'::jsonb,
    jsonb_build_object('title', public.sp_text(p, 'title', 2, 160), 'kind', v_kind, 'version', v_version)
      || case when v_path is not null then jsonb_build_object('scanned', v_scanned) else '{}'::jsonb end);
  return jsonb_build_object('id', v_id);
end $$;

-- The app reports a blocked (infected) upload with the same gate; it lands in the audit log for AINDEV.
create function public.sp_log_blocked_upload(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); c public.challenges;
begin
  if not public.sp_scan_gate_ok(p ->> 'gate') then perform public.sp_forbidden(); end if;
  select * into c from public.challenges where id = public.sp_uuid(p, 'challenge_id', false);
  perform public.sp_audit('evidence_upload_blocked', 'evidence', null, c.organization_id, c.id, a.id, '{}'::jsonb,
    jsonb_build_object('file_name', left(regexp_replace(coalesce(p ->> 'file_name', ''), '[^[:print:]]', '', 'g'), 200),
                       'signature', left(regexp_replace(coalesce(p ->> 'signature', ''), '[^[:print:]]', '', 'g'), 200)));
  return '{}'::jsonb;
end $$;

-- Signed-in download lookup (RLS decides visibility): says when the file is still in quarantine for this caller.
create or replace function public.sp_evidence_file(p jsonb) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object('id', e.id, 'storage_path', e.storage_path, 'file_name', e.file_name, 'mime_type', e.mime_type, 'url', e.url,
    'quarantined', e.storage_path is not null and e.scanned_at is null and e.student_id is distinct from auth.uid() and public.sp_scan_required())
  from public.evidence e where e.id = nullif(p->>'evidence_id', '')::uuid
$$;

create or replace function public.sp_public_evidence_file(p jsonb) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('storage_path', e.storage_path, 'file_name', e.file_name, 'mime_type', e.mime_type, 'is_demo', cr.is_demo)
  from public.evidence e
  join public.credentials cr on cr.assignment_id = e.assignment_id and cr.status = 'active' and cr.verification_enabled
  where e.id = nullif(p->>'evidence_id', '')::uuid and e.is_public and e.status = 'approved' and e.storage_path is not null
    and cr.snapshot->>'publication_policy' = 'public_allowed'
    and (e.scanned_at is not null or not public.sp_scan_required())
$$;

create or replace function public.sp_is_public_evidence_object(p_name text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(
    select 1 from public.evidence e
    join public.credentials cr on cr.assignment_id = e.assignment_id and cr.status = 'active' and cr.verification_enabled
    where e.storage_path = p_name and e.is_public and e.status = 'approved'
      and cr.snapshot->>'publication_policy' = 'public_allowed'
      and (e.scanned_at is not null or not public.sp_scan_required()))
$$;

-- Storage: a file nobody scanned is readable only from its owner's folder while scanning is required.
do $outer$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema not present; skipping';
    return;
  end if;
  execute 'drop policy if exists evidence_select_visible on storage.objects';
  execute $p$
    create policy evidence_select_visible on storage.objects for select to authenticated
    using (
      bucket_id = 'evidence'
      and ((storage.foldername(name))[1] = auth.uid()::text
           or exists(select 1 from public.evidence e where e.storage_path = name
                     and (e.scanned_at is not null or not public.sp_scan_required()))))
  $p$;
end
$outer$;

-- CREATE OR REPLACE keeps the owners and EXECUTE grants of the four functions it replaces.
revoke all on function public.sp_scan_required(), public.sp_scan_gate_ok(text), public.sp_scan_attested(jsonb),
  public.sp_log_blocked_upload(jsonb) from public, anon, authenticated;
-- sp_evidence_file (SECURITY INVOKER) and the evidence_select_visible policy call sp_scan_required as the user.
grant execute on function public.sp_scan_required(), public.sp_log_blocked_upload(jsonb) to authenticated;
