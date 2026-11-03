-- SkillPass — second factor (MFA) for privileged actions (pilot readiness, docs/STATUS.md).
--
-- When platform_settings.mfa_required is true (production), a session must have completed a second factor
-- (Supabase Auth TOTP: JWT claim aal = 'aal2') to:
--   * act as AINDEV admin: sp_is_admin() is false at aal1, so every admin RLS branch and RPC is closed;
--   * complete a validation and issue a credential (sp_complete_validation), whoever the reviewer is.
-- Local DEMO and the public demo project keep it off (seed.sql, and the default below for databases that
-- already hold DEMO data); databases without DEMO data start with it on.

create table public.platform_settings (
  key text primary key check (key ~ '^[a-z_]{2,60}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from public, anon, authenticated;
insert into public.platform_settings(key, value)
values ('mfa_required', to_jsonb(not exists(select 1 from public.profiles where is_demo)));

-- The session's authenticator assurance level ('aal1' or 'aal2'), from the JWT that PostgREST exposes.
create function public.sp_current_aal() returns text
language sql stable set search_path = public, pg_temp as $$
  select coalesce(nullif(current_setting('request.jwt.claim.aal', true), ''),
                  nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', 'aal1')
$$;

create function public.sp_mfa_required() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select value = 'true'::jsonb from public.platform_settings where key = 'mfa_required'), false)
$$;

create function public.sp_mfa_satisfied() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select not public.sp_mfa_required() or public.sp_current_aal() = 'aal2'
$$;

create function public.sp_require_mfa() returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.sp_mfa_satisfied() then perform public.sp_raise('mfa_required'); end if;
end $$;

-- What the app needs to decide whether to ask for the second factor.
create function public.sp_mfa_status(p jsonb default '{}'::jsonb) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('required', public.sp_mfa_required(), 'aal', public.sp_current_aal(), 'satisfied', public.sp_mfa_satisfied())
$$;

create or replace function public.sp_is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) and public.sp_mfa_satisfied()
$$;

create or replace function public.sp_complete_validation(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.profiles := public.sp_actor(); r public.validation_requests; c public.challenges; v_asg public.assignments;
  s public.profiles; o public.organizations; v_item record; d jsonb; v_decision text; v_comment text; v_hours numeric; v_status text;
  v_ok int := 0; v_bad int := 0; v_changes int := 0; v_added numeric := 0; v_outcome text; v_comp uuid; v_level int;
  v_issue boolean := public.sp_bool(p, 'issue_credential', false); v_summary text := public.sp_text(p, 'summary_comment', 0, 2000);
  v_total numeric; v_cred uuid; v_code text; v_snapshot jsonb;
begin
  perform public.sp_require_mfa(); -- issuing credentials needs a second factor (20261103000002)
  select * into r from public.validation_requests where id = public.sp_uuid(p, 'request_id') for update;
  if not found then perform public.sp_raise('not_found'); end if;
  if not public.sp_can_review_challenge(r.challenge_id) then perform public.sp_forbidden(); end if;
  if r.student_id = a.id then perform public.sp_forbidden('self_validation'); end if;
  if r.status <> 'pending' then perform public.sp_raise('request_closed'); end if;
  foreach v_decision in array array['vath','evidence','competencies'] loop
    if p ? v_decision and jsonb_typeof(p->v_decision) <> 'array' then perform public.sp_raise('invalid_field', v_decision); end if;
  end loop;
  select * into c from public.challenges where id = r.challenge_id;
  select * into v_asg from public.assignments where id = r.assignment_id for update;
  select * into s from public.profiles where id = r.student_id;
  select * into o from public.organizations where id = c.organization_id;

  -- 1. Hours: verify, adjust (with justification) or reject (with justification).
  for v_item in select v.* from public.vath_entries v join public.validation_request_items i on i.item_id = v.id and i.item_type = 'vath'
                where i.request_id = r.id and v.status = 'submitted' order by v.activity_date loop
    select value into d from jsonb_array_elements(coalesce(p->'vath', '[]'::jsonb)) where value->>'id' = v_item.id::text limit 1;
    if d is null then perform public.sp_raise('missing_decision', v_item.id::text); end if;
    v_decision := public.sp_choice(d, 'decision', array['verify','adjust','reject']);
    v_comment := public.sp_text(d, 'comment', 0, 2000);
    if v_decision = 'verify' then
      v_hours := v_item.submitted_hours; v_status := 'verified'; v_ok := v_ok + 1;
    elsif v_decision = 'adjust' then
      v_hours := public.sp_num(d, 'verified_hours', 0, 16);
      if v_hours >= v_item.submitted_hours then perform public.sp_raise('adjust_must_reduce', v_item.id::text); end if;
      if char_length(v_comment) < 5 then perform public.sp_raise('comment_required', v_item.id::text); end if;
      v_status := 'adjusted'; v_ok := v_ok + 1;
    else
      if char_length(v_comment) < 5 then perform public.sp_raise('comment_required', v_item.id::text); end if;
      v_hours := 0; v_status := 'rejected'; v_bad := v_bad + 1;
    end if;
    v_added := v_added + v_hours;
    update public.vath_entries set status = v_status, verified_hours = v_hours, validated_by = a.id, validated_at = now(),
      validation_comment = v_comment where id = v_item.id;
    insert into public.validation_decisions(request_id, item_type, item_id, decision, previous_value, new_value, comment, decided_by)
    values (r.id, 'vath', v_item.id, v_status, jsonb_build_object('status', 'submitted', 'submitted_hours', v_item.submitted_hours),
      jsonb_build_object('status', v_status, 'verified_hours', v_hours), v_comment, a.id);
  end loop;

  -- 2. Evidence: approve, request changes or reject.
  for v_item in select e.* from public.evidence e join public.validation_request_items i on i.item_id = e.id and i.item_type = 'evidence'
                where i.request_id = r.id and e.status = 'submitted' order by e.created_at loop
    select value into d from jsonb_array_elements(coalesce(p->'evidence', '[]'::jsonb)) where value->>'id' = v_item.id::text limit 1;
    if d is null then perform public.sp_raise('missing_decision', v_item.id::text); end if;
    v_decision := public.sp_choice(d, 'decision', array['approve','request_changes','reject']);
    v_comment := public.sp_text(d, 'comment', 0, 2000);
    if v_decision <> 'approve' and char_length(v_comment) < 5 then perform public.sp_raise('comment_required', v_item.id::text); end if;
    v_status := case v_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'reviewed' end;
    if v_decision = 'approve' then v_ok := v_ok + 1; elsif v_decision = 'reject' then v_bad := v_bad + 1; else v_changes := v_changes + 1; end if;
    update public.evidence set status = v_status, reviewed_by = a.id, reviewed_at = now(), review_comment = v_comment where id = v_item.id;
    insert into public.validation_decisions(request_id, item_type, item_id, decision, previous_value, new_value, comment, decided_by)
    values (r.id, 'evidence', v_item.id, case v_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'changes_requested' end,
      jsonb_build_object('status', 'submitted'), jsonb_build_object('status', v_status), v_comment, a.id);
  end loop;

  -- 3. Competency rubric (1-5). Only competencies defined for the challenge.
  for d in select value from jsonb_array_elements(coalesce(p->'competencies', '[]'::jsonb)) loop
    v_comp := public.sp_uuid(d, 'competency_id');
    v_level := public.sp_int(d, 'level', 1, 5);
    if not exists(select 1 from public.challenge_competencies where challenge_id = c.id and competency_id = v_comp) then
      perform public.sp_raise('invalid_field', 'competencies');
    end if;
    if exists(select 1 from public.competency_assessments where request_id = r.id and competency_id = v_comp) then
      perform public.sp_raise('duplicate_competency', 'competencies');
    end if;
    insert into public.competency_assessments(request_id, challenge_id, assignment_id, student_id, competency_id, level, comment, assessor_id)
    values (r.id, c.id, v_asg.id, r.student_id, v_comp, v_level, public.sp_text(d, 'comment', 0, 1000), a.id);
  end loop;

  v_outcome := case
    when v_ok > 0 and v_bad = 0 and v_changes = 0 then 'approved'
    when v_ok > 0 then 'partially_approved'
    when v_changes > 0 then 'changes_requested'
    else 'rejected' end;
  update public.validation_requests set status = 'completed', outcome = v_outcome, summary_comment = v_summary,
    completed_by = a.id, completed_at = now() where id = r.id;

  -- 4. Optional: confirm the experience and issue the SkillPass credential.
  if v_issue then
    if v_asg.status <> 'active' then perform public.sp_raise('assignment_not_active'); end if;
    select coalesce(sum(verified_hours), 0) into v_total from public.vath_entries where assignment_id = v_asg.id and status in ('verified','adjusted');
    if v_total <= 0 then perform public.sp_raise('credential_requires_hours'); end if;
    if not exists(select 1 from public.competency_assessments where assignment_id = v_asg.id) then
      perform public.sp_raise('credential_requires_assessment');
    end if;
    v_code := public.sp_new_credential_code();
    v_snapshot := public.sp_build_credential_snapshot(v_asg.id, a.id);
    insert into public.credentials(code, student_id, challenge_id, assignment_id, organization_id, request_id, issued_by, snapshot, is_demo)
    values (v_code, r.student_id, c.id, v_asg.id, c.organization_id, r.id, a.id, v_snapshot, c.is_demo or s.is_demo)
    returning id into v_cred;
    update public.assignments set status = 'completed', completed_at = now() where id = v_asg.id;
    update public.validation_requests set issued_credential_id = v_cred where id = r.id;
    insert into public.validation_decisions(request_id, item_type, item_id, decision, previous_value, new_value, comment, decided_by)
    values (r.id, 'assignment', v_asg.id, 'credential_issued', jsonb_build_object('status', 'active'),
      jsonb_build_object('status', 'completed', 'credential_code', v_code, 'verified_hours', v_total), v_summary, a.id);
    perform public.sp_notify(r.student_id, 'credential_issued', jsonb_build_object('challenge', c.title, 'code', v_code), '/my-skillpass');
    perform public.sp_audit('credential_issued', 'credential', v_cred, c.organization_id, c.id, r.student_id, '{}'::jsonb,
      jsonb_build_object('code', v_code, 'verified_hours', v_total));
  end if;

  perform public.sp_notify(r.student_id, 'validation_completed', jsonb_build_object('challenge', c.title, 'outcome', v_outcome, 'hours', v_added),
    '/workspace/' || c.id || '?tab=validation');
  perform public.sp_audit('validation_completed', 'validation_request', r.id, c.organization_id, c.id, r.student_id,
    jsonb_build_object('status', 'pending'), jsonb_build_object('outcome', v_outcome, 'verified_hours', v_added, 'credential', v_code));
  return jsonb_build_object('outcome', v_outcome, 'verified_hours', v_added, 'credential_code', v_code);
end $$;

revoke all on function public.sp_current_aal(), public.sp_mfa_required(), public.sp_mfa_satisfied(), public.sp_require_mfa(),
  public.sp_mfa_status(jsonb) from public, anon, authenticated;
-- The helpers run inside SECURITY DEFINER functions (sp_is_admin, sp_complete_validation); only the status RPC is API surface.
grant execute on function public.sp_mfa_status(jsonb) to authenticated;
