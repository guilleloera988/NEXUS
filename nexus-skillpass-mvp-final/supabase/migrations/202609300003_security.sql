-- Scope private project records to owners and actual reviewers. An institutional
-- observer may read the assigned student's experience summary, never private evidence.
create or replace function public.nexus_can_read_experience(p_exp uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.experiences where id=p_exp and (student_id=auth.uid() or public.nexus_can_review(organization_id)))
$$;
alter policy event_read on public.activity_events using(actor_id=auth.uid() or subject_id=auth.uid() or public.nexus_can_review(organization_id));

-- Supabase default privileges can grant directly to anon/authenticated. Revoking
-- PUBLIC alone is not sufficient to remove those inherited creation-time grants.
revoke all on public.student_skills from public,anon,authenticated;
grant select on public.student_skills to authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('nexus_handle_signup','nexus_is_admin','nexus_org_staff','nexus_can_review','nexus_can_read_student','nexus_can_read_experience','nexus_snapshot','nexus_action','nexus_public_skillpass','nexus_public_credential','nexus_academic_observer','nexus_record_registration','nexus_record_credential','nexus_touch') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
grant execute on function public.nexus_is_admin(),public.nexus_org_staff(uuid),public.nexus_can_review(uuid),public.nexus_can_read_student(uuid),public.nexus_can_read_experience(uuid),public.nexus_academic_observer(uuid),public.nexus_snapshot(),public.nexus_action(text,jsonb) to authenticated;
grant execute on function public.nexus_public_skillpass(text),public.nexus_public_credential(uuid) to anon,authenticated;

-- An approval's identity, organization and payload cannot be rewritten after the
-- fact through an accidental future code path. Revocation is the only final transition.
create function public.nexus_guard_experience() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if old.status in ('verified','revoked') and (
  new.student_id is distinct from old.student_id or new.organization_id is distinct from old.organization_id
  or new.challenge_id is distinct from old.challenge_id or new.title is distinct from old.title
  or new.description is distinct from old.description or new.responsibilities is distinct from old.responsibilities
  or new.deliverables is distinct from old.deliverables or new.start_date is distinct from old.start_date
  or new.end_date is distinct from old.end_date or new.hours is distinct from old.hours
  or new.verified_hours is distinct from old.verified_hours or new.is_demo is distinct from old.is_demo
  or not(new.status=old.status or (old.status='verified' and new.status='revoked'))
 ) then raise exception 'Final experience is immutable'; end if;
 return new;
end $$;
create trigger nexus_experience_integrity before update on public.experiences for each row execute function public.nexus_guard_experience();

create function public.nexus_guard_credential() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare e public.experiences; v public.validations;
begin
 if tg_op='INSERT' then
  select * into e from public.experiences where id=new.experience_id;
  select * into v from public.validations where id=new.validation_id;
  if e.id is null or v.id is null or e.student_id<>new.student_id or e.status<>'verified'
   or v.experience_id<>e.id or v.decision<>'approve' or v.reviewer_id<>new.issuer_id
   or v.reviewer_id=e.student_id or v.verified_hours<>e.verified_hours or new.status<>'active'
   then raise exception 'Credential requires matching human approval'; end if;
 else
  if new.experience_id is distinct from old.experience_id or new.student_id is distinct from old.student_id
   or new.issuer_id is distinct from old.issuer_id or new.validation_id is distinct from old.validation_id
   or new.issued_at is distinct from old.issued_at or new.is_demo is distinct from old.is_demo
   or old.status='revoked' and (new.status is distinct from old.status or new.revoked_at is distinct from old.revoked_at or new.revocation_reason is distinct from old.revocation_reason)
   then raise exception 'Credential lineage is immutable'; end if;
 end if;
 return new;
end $$;
create trigger nexus_credential_integrity before insert or update on public.credentials for each row execute function public.nexus_guard_credential();
revoke all on function public.nexus_guard_experience(),public.nexus_guard_credential() from public,anon,authenticated;
