-- Narrow academic observation: a university membership grants experience summary,
-- not access to private evidence or reviewer comments from another organization.
create function public.nexus_academic_observer(p_student uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.organization_members student join public.organization_members staff on staff.organization_id=student.organization_id join public.organizations o on o.id=staff.organization_id where student.user_id=p_student and student.role='student' and staff.user_id=auth.uid() and staff.role='university' and o.type='university')
$$;
revoke all on function public.nexus_academic_observer(uuid) from public;
grant execute on function public.nexus_academic_observer(uuid) to authenticated;
create policy academic_experience_read on public.experiences for select to authenticated using(public.nexus_academic_observer(student_id));
create policy academic_credential_read on public.credentials for select to authenticated using(public.nexus_academic_observer(student_id));
create policy academic_experience_skill_read on public.experience_skills for select to authenticated using(exists(select 1 from public.experiences e where e.id=experience_id and public.nexus_academic_observer(e.student_id)));

create view public.student_skills with (security_invoker=true) as
 select c.student_id,cs.skill_id,max(cs.level) as level,count(*) as verified_experiences
 from public.credentials c join public.credential_skills cs on cs.credential_id=c.id
 join public.experiences e on e.id=c.experience_id
 where c.status='active' and e.status='verified' group by c.student_id,cs.skill_id;
grant select on public.student_skills to authenticated;

create function public.nexus_record_registration() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.activity_events(actor_id,subject_id,action,entity_id,details) values(new.id,new.id,'student_registered',new.id,jsonb_build_object('is_demo',new.is_demo));
 return new;
end $$;
create trigger nexus_registration_event after insert on public.profiles for each row execute function public.nexus_record_registration();
create function public.nexus_record_credential() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; sk uuid;
begin
 select organization_id into org from public.experiences where id=new.experience_id;
 insert into public.activity_events(actor_id,subject_id,organization_id,action,entity_id,details) values(new.issuer_id,new.student_id,org,'credential_created',new.id,jsonb_build_object('is_demo',new.is_demo)),(new.issuer_id,new.student_id,org,'experience_verified',new.experience_id,jsonb_build_object('is_demo',new.is_demo));
 for sk in select skill_id from public.experience_skills where experience_id=new.experience_id loop
  insert into public.activity_events(actor_id,subject_id,organization_id,action,entity_id,details) values(new.issuer_id,new.student_id,org,'skill_verified',sk,jsonb_build_object('credential_id',new.id,'is_demo',new.is_demo));
 end loop;
 return new;
end $$;
create trigger nexus_credential_event after insert on public.credentials for each row execute function public.nexus_record_credential();
revoke all on function public.nexus_record_registration(),public.nexus_record_credential() from public;

-- Uniform record timestamps, including join tables. Join-table composite keys remain deliberate.
do $$ declare t text; begin
 foreach t in array array['organizations','organization_members','skills','challenges','challenge_skills','challenge_participants','experience_skills','evidence','validation_requests','validations','credentials','credential_skills','activity_events'] loop
  execute format('alter table public.%I add column if not exists created_at timestamptz not null default now()',t);
  execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()',t);
 end loop;
end $$;
create function public.nexus_touch() returns trigger language plpgsql set search_path=public,pg_temp as $$begin new.updated_at:=now(); return new; end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','organizations','organization_members','skills','challenges','challenge_skills','challenge_participants','experiences','experience_skills','evidence','validation_requests','validations','credentials','credential_skills','activity_events'] loop
 execute format('create trigger nexus_updated before update on public.%I for each row execute function public.nexus_touch()',t);
 end loop;
end $$;
revoke all on function public.nexus_touch() from public;
