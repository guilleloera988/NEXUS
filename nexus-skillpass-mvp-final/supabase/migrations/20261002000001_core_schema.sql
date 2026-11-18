-- SkillPass by AINDEV NEXUS — core schema (v2, challenge-centric).
--
-- Flow modelled here:
--   industry challenge -> application -> assignment -> evidence + VATH entries
--   -> validation request -> supervisor decisions + competency assessments
--   -> credential (SkillPass) -> public verification.
--
-- Security model (see 0002 and docs/SECURITY.md):
--   * anon/authenticated never receive INSERT/UPDATE/DELETE on these tables.
--   * authenticated receives SELECT, filtered by row level security.
--   * every mutation goes through a SECURITY DEFINER RPC with explicit checks.

-- ---------------------------------------------------------------------------
-- Organizations and people
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('company','university','aindev')),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,90}$'),
  industry text not null default '' check (char_length(industry) <= 60),
  size text not null default '' check (size in ('','1-10','11-50','51-200','201-1000','1000+')),
  location text not null default '' check (char_length(location) <= 120),
  website text not null default '' check (website = '' or (website ~ '^https://[^[:space:]@]+$' and char_length(website) <= 300)),
  description text not null default '' check (char_length(description) <= 1500),
  campus text not null default '' check (char_length(campus) <= 120),
  programs text[] not null default '{}' check (cardinality(programs) <= 60),
  needs text not null default '' check (char_length(needs) <= 1500),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student','company','supervisor','university','admin')),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,90}$'),
  headline text not null default '' check (char_length(headline) <= 160),
  bio text not null default '' check (char_length(bio) <= 1200),
  location text not null default '' check (char_length(location) <= 120),
  university_id uuid references public.organizations(id) on delete set null,
  career text not null default '' check (char_length(career) <= 160),
  semester smallint check (semester between 1 and 20),
  interests text[] not null default '{}' check (cardinality(interests) <= 12),
  availability text not null default 'part_time' check (availability in ('full_time','part_time','weekends','flexible','not_available')),
  hours_per_week smallint check (hours_per_week between 1 and 60),
  onboarding_completed boolean not null default false,
  -- Privacy controls. Everything public is opt-in.
  skillpass_public boolean not null default false,
  open_to_opportunities boolean not null default false,
  public_show_university boolean not null default true,
  public_show_career boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_university_idx on public.profiles(university_id);
create index profiles_role_idx on public.profiles(role);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null check (member_role in ('owner','manager','supervisor','staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and char_length(email) <= 254),
  member_role text not null check (member_role in ('manager','supervisor','staff')),
  invited_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index invitations_one_pending on public.invitations(organization_id, email) where status = 'pending';
create index invitations_email_idx on public.invitations(email) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Competency catalog (bilingual) and declared skills
-- ---------------------------------------------------------------------------
create table public.competencies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  name_es text not null check (char_length(btrim(name_es)) between 2 and 80),
  name_en text not null check (char_length(btrim(name_en)) between 2 and 80),
  category text not null check (category in ('technical','digital','business','human')),
  description_es text not null default '' check (char_length(description_es) <= 400),
  description_en text not null default '' check (char_length(description_en) <= 400),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Self-reported. Never shown as verified; verification only comes from competency_assessments.
create table public.declared_skills (
  student_id uuid not null references public.profiles(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, competency_id)
);

-- ---------------------------------------------------------------------------
-- Industry challenges
-- ---------------------------------------------------------------------------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  summary text not null default '' check (char_length(summary) <= 400),
  description text not null default '' check (char_length(description) <= 4000),
  problem text not null default '' check (char_length(problem) <= 3000),
  objective text not null default '' check (char_length(objective) <= 2000),
  industry text not null default '' check (char_length(industry) <= 60),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  target_careers text[] not null default '{}' check (cardinality(target_careers) <= 12),
  modality text not null default 'hybrid' check (modality in ('remote','hybrid','onsite')),
  location text not null default '' check (char_length(location) <= 120),
  duration_weeks smallint not null default 6 check (duration_weeks between 1 and 52),
  start_date date,
  end_date date,
  max_participants smallint not null default 3 check (max_participants between 1 and 50),
  estimated_vath numeric(6,1) not null default 40 check (estimated_vath > 0 and estimated_vath <= 1000),
  supervisor_id uuid references public.profiles(id),
  conditions text not null default '' check (char_length(conditions) <= 2000),
  -- Fair-work guardrail: compensation is always declared (see sp_save_challenge).
  compensation_type text not null default 'none' check (compensation_type in ('paid','stipend','prize','in_kind','none')),
  compensation_details text not null default '' check (char_length(compensation_details) <= 600),
  -- IP and confidentiality are defined per challenge; nothing is assumed to belong to AINDEV.
  ip_policy text not null default 'to_be_agreed' check (ip_policy in ('student_owns','shared','company_license','company_owns','to_be_agreed')),
  ip_details text not null default '' check (char_length(ip_details) <= 1500),
  confidentiality text not null default 'public' check (confidentiality in ('public','confidential','nda_required')),
  publication_policy text not null default 'public_allowed' check (publication_policy in ('public_allowed','summary_only','confidential')),
  status text not null default 'draft' check (status in ('draft','published','recruiting','active','under_review','completed','archived')),
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index challenges_org_idx on public.challenges(organization_id);
create index challenges_status_idx on public.challenges(status);
create index challenges_supervisor_idx on public.challenges(supervisor_id);

create table public.challenge_competencies (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  competency_id uuid not null references public.competencies(id),
  required_level smallint not null default 3 check (required_level between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (challenge_id, competency_id)
);

create table public.challenge_deliverables (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  due_date date,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index challenge_deliverables_challenge_idx on public.challenge_deliverables(challenge_id);

-- ---------------------------------------------------------------------------
-- Matching and assignment
-- ---------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  motivation text not null check (char_length(btrim(motivation)) between 20 and 2000),
  availability_note text not null default '' check (char_length(availability_note) <= 400),
  status text not null default 'submitted' check (status in ('submitted','shortlisted','accepted','rejected','withdrawn')),
  match_score smallint check (match_score between 0 and 100),
  match_breakdown jsonb not null default '{}'::jsonb,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_note text not null default '' check (char_length(decision_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, student_id)
);
create index applications_student_idx on public.applications(student_id);

-- Team = all active/completed assignments of the same challenge.
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  application_id uuid references public.applications(id) on delete set null,
  assigned_by uuid references public.profiles(id),
  team_role text not null default '' check (char_length(team_role) <= 80),
  status text not null default 'active' check (status in ('active','completed','withdrawn')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, student_id)
);
create index assignments_student_idx on public.assignments(student_id);

-- ---------------------------------------------------------------------------
-- Workspace: tasks, evidence, VATH
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  deliverable_id uuid references public.challenge_deliverables(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null default '' check (char_length(description) <= 1500),
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  sort_order smallint not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_challenge_idx on public.tasks(challenge_id);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id),
  assignment_id uuid not null references public.assignments(id),
  student_id uuid not null references public.profiles(id),
  deliverable_id uuid references public.challenge_deliverables(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  kind text not null check (kind in ('file','image','pdf','document','presentation','link','repository','video')),
  url text check (url is null or (url ~ '^https://[^[:space:]@]+$' and char_length(url) <= 2048)),
  storage_path text check (storage_path is null or (char_length(storage_path) <= 400 and storage_path !~ '\.\.')),
  file_name text check (file_name is null or char_length(file_name) <= 200),
  mime_type text check (mime_type is null or char_length(mime_type) <= 120),
  size_bytes integer check (size_bytes is null or size_bytes between 1 and 10485760),
  version smallint not null default 1 check (version between 1 and 100),
  previous_id uuid references public.evidence(id),
  status text not null default 'draft' check (status in ('draft','submitted','reviewed','approved','rejected')),
  is_public boolean not null default false,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_comment text not null default '' check (char_length(review_comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((url is null) <> (storage_path is null))
);
create index evidence_challenge_idx on public.evidence(challenge_id);
create index evidence_student_idx on public.evidence(student_id);

create table public.evidence_competencies (
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  competency_id uuid not null references public.competencies(id),
  primary key (evidence_id, competency_id)
);

-- VATH = Verified Applied Talent Hours. submitted_hours (declared by the student) and
-- verified_hours (decided by a reviewer) are always stored separately.
create table public.vath_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id),
  assignment_id uuid not null references public.assignments(id),
  student_id uuid not null references public.profiles(id),
  task_id uuid references public.tasks(id) on delete set null,
  activity_date date not null,
  activity text not null check (char_length(btrim(activity)) between 3 and 160),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  submitted_hours numeric(5,2) not null check (submitted_hours >= 0.25 and submitted_hours <= 16),
  verified_hours numeric(5,2) check (verified_hours is null or (verified_hours >= 0 and verified_hours <= submitted_hours)),
  status text not null default 'draft' check (status in ('draft','submitted','verified','adjusted','rejected')),
  submitted_at timestamptz,
  validated_by uuid references public.profiles(id),
  validated_at timestamptz,
  validation_comment text not null default '' check (char_length(validation_comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status in ('draft','submitted') and verified_hours is null)
    or (status = 'verified' and verified_hours = submitted_hours)
    or (status = 'adjusted' and verified_hours < submitted_hours)
    or (status = 'rejected' and verified_hours = 0)
  )
);
create index vath_entries_challenge_idx on public.vath_entries(challenge_id);
create index vath_entries_student_idx on public.vath_entries(student_id);
-- Obvious duplicates: same assignment, same day, same activity title.
create unique index vath_entries_no_duplicates on public.vath_entries(assignment_id, activity_date, lower(btrim(activity))) where status <> 'rejected';

create table public.vath_entry_evidence (
  vath_entry_id uuid not null references public.vath_entries(id) on delete cascade,
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  primary key (vath_entry_id, evidence_id)
);

-- ---------------------------------------------------------------------------
-- Validation, rubric and credentials
-- ---------------------------------------------------------------------------
create table public.validation_requests (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id),
  assignment_id uuid not null references public.assignments(id),
  student_id uuid not null references public.profiles(id),
  supervisor_id uuid references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  student_note text not null default '' check (char_length(student_note) <= 1000),
  outcome text check (outcome in ('approved','partially_approved','changes_requested','rejected')),
  summary_comment text not null default '' check (char_length(summary_comment) <= 2000),
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  issued_credential_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'completed') = (outcome is not null and completed_by is not null and completed_at is not null))
);
create unique index validation_requests_one_pending on public.validation_requests(assignment_id) where status = 'pending';
create index validation_requests_challenge_idx on public.validation_requests(challenge_id);

create table public.validation_request_items (
  request_id uuid not null references public.validation_requests(id) on delete cascade,
  item_type text not null check (item_type in ('vath','evidence')),
  item_id uuid not null,
  primary key (request_id, item_type, item_id)
);

-- Append-only audit trail of every reviewer decision: who, when, previous and validated value.
create table public.validation_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.validation_requests(id),
  item_type text not null check (item_type in ('vath','evidence','assignment')),
  item_id uuid not null,
  decision text not null check (decision in ('verified','adjusted','rejected','approved','changes_requested','credential_issued')),
  previous_value jsonb not null default '{}'::jsonb,
  new_value jsonb not null default '{}'::jsonb,
  comment text not null default '' check (char_length(comment) <= 2000),
  decided_by uuid not null references public.profiles(id),
  decided_at timestamptz not null default now()
);
create index validation_decisions_request_idx on public.validation_decisions(request_id);

-- Rubric scale: 1 Needs significant support, 2 Developing, 3 Competent, 4 Advanced, 5 Outstanding.
-- A competency counts as VERIFIED only through an assessment with level >= 3.
create table public.competency_assessments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.validation_requests(id),
  challenge_id uuid not null references public.challenges(id),
  assignment_id uuid not null references public.assignments(id),
  student_id uuid not null references public.profiles(id),
  competency_id uuid not null references public.competencies(id),
  level smallint not null check (level between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  assessor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (request_id, competency_id),
  check (assessor_id <> student_id)
);
create index competency_assessments_student_idx on public.competency_assessments(student_id);

create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^SKP-[0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$'),
  student_id uuid not null references public.profiles(id),
  challenge_id uuid not null references public.challenges(id),
  assignment_id uuid not null unique references public.assignments(id),
  organization_id uuid not null references public.organizations(id),
  request_id uuid not null references public.validation_requests(id),
  issued_by uuid not null references public.profiles(id),
  issued_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','revoked')),
  verification_enabled boolean not null default true,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id),
  revocation_reason text check (revocation_reason is null or char_length(revocation_reason) <= 1000),
  -- Immutable copy of what was verified at issuance time.
  snapshot jsonb not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null)),
  check (issued_by <> student_id)
);
create index credentials_student_idx on public.credentials(student_id);
alter table public.validation_requests add constraint validation_requests_credential_fk foreign key (issued_credential_id) references public.credentials(id);

-- ---------------------------------------------------------------------------
-- Notifications, audit, incidents
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (char_length(kind) <= 60),
  params jsonb not null default '{}'::jsonb,
  link text not null default '' check (link = '' or (link ~ '^/[^/]' and char_length(link) <= 300)),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) <= 60),
  entity_type text not null check (char_length(entity_type) <= 40),
  entity_id uuid,
  organization_id uuid references public.organizations(id) on delete set null,
  challenge_id uuid references public.challenges(id) on delete set null,
  subject_id uuid references public.profiles(id) on delete set null,
  before jsonb not null default '{}'::jsonb,
  after jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
create index audit_logs_challenge_idx on public.audit_logs(challenge_id);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  reported_by uuid references public.profiles(id) on delete set null,
  entity_type text not null check (entity_type in ('credential','evidence','challenge','profile','validation','other')),
  entity_id uuid,
  category text not null check (category in ('incorrect_data','misconduct','privacy','suspected_fraud','technical','other')),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  status text not null default 'open' check (status in ('open','investigating','resolved','dismissed')),
  resolution text not null default '' check (char_length(resolution) <= 2000),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function public.sp_touch() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['organizations','profiles','organization_members','invitations','competencies','challenges',
    'challenge_deliverables','applications','assignments','tasks','evidence','vath_entries','validation_requests',
    'credentials','incidents'] loop
    execute format('create trigger sp_touch_updated_at before update on public.%I for each row execute function public.sp_touch()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Integrity guards (defense in depth beyond the RPC checks)
-- ---------------------------------------------------------------------------
create function public.sp_guard_append_only() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'sp:append_only' using errcode = '42501', detail = tg_table_name;
end $$;
create trigger sp_append_only before update or delete on public.validation_decisions for each row execute function public.sp_guard_append_only();
create trigger sp_append_only before update or delete on public.competency_assessments for each row execute function public.sp_guard_append_only();
create trigger sp_append_only before update or delete on public.audit_logs for each row execute function public.sp_guard_append_only();

-- A decided VATH entry is final.
create function public.sp_guard_vath() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'sp:vath_immutable' using errcode = '42501'; end if;
    return old;
  end if;
  -- task_id may still be cleared when a task is deleted (ON DELETE SET NULL).
  if old.status <> 'draft' and (new.submitted_hours is distinct from old.submitted_hours
     or new.activity is distinct from old.activity or new.activity_date is distinct from old.activity_date
     or new.description is distinct from old.description or new.student_id is distinct from old.student_id
     or new.challenge_id is distinct from old.challenge_id or new.assignment_id is distinct from old.assignment_id) then
    raise exception 'sp:vath_immutable' using errcode = '42501';
  end if;
  if old.status in ('verified','adjusted','rejected') and (new.status is distinct from old.status
     or new.verified_hours is distinct from old.verified_hours or new.validated_by is distinct from old.validated_by) then
    raise exception 'sp:vath_immutable' using errcode = '42501';
  end if;
  if old.status = 'submitted' and new.status not in ('submitted','verified','adjusted','rejected') then
    raise exception 'sp:vath_immutable' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger sp_guard_vath before update or delete on public.vath_entries for each row execute function public.sp_guard_vath();

-- Approved evidence keeps its content; only public visibility can change.
create function public.sp_guard_evidence() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'sp:evidence_immutable' using errcode = '42501'; end if;
    return old;
  end if;
  if old.status in ('approved','rejected','submitted') and (new.url is distinct from old.url
     or new.storage_path is distinct from old.storage_path or new.title is distinct from old.title
     or new.student_id is distinct from old.student_id or new.challenge_id is distinct from old.challenge_id
     or new.version is distinct from old.version) then
    raise exception 'sp:evidence_immutable' using errcode = '42501';
  end if;
  if old.status in ('approved','rejected') and new.status is distinct from old.status then
    raise exception 'sp:evidence_immutable' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger sp_guard_evidence before update or delete on public.evidence for each row execute function public.sp_guard_evidence();

-- A credential's lineage and snapshot never change. Revocation is final.
create function public.sp_guard_credential() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then raise exception 'sp:credential_immutable' using errcode = '42501'; end if;
  if new.code is distinct from old.code or new.student_id is distinct from old.student_id
     or new.challenge_id is distinct from old.challenge_id or new.assignment_id is distinct from old.assignment_id
     or new.organization_id is distinct from old.organization_id or new.request_id is distinct from old.request_id
     or new.issued_by is distinct from old.issued_by or new.issued_at is distinct from old.issued_at
     or new.snapshot is distinct from old.snapshot or new.is_demo is distinct from old.is_demo
     or (old.status = 'revoked' and (new.status is distinct from old.status or new.revoked_at is distinct from old.revoked_at
         or new.revocation_reason is distinct from old.revocation_reason)) then
    raise exception 'sp:credential_immutable' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger sp_guard_credential before update or delete on public.credentials for each row execute function public.sp_guard_credential();

-- Verified competencies: derived, never stored. security_invoker keeps RLS of the caller.
create view public.student_verified_competencies with (security_invoker = true) as
  select a.student_id, a.competency_id, max(a.level)::smallint as level,
         count(distinct a.challenge_id)::int as challenges, max(a.created_at) as last_assessed_at
  from public.competency_assessments a
  where a.level >= 3
    and not exists (select 1 from public.credentials c where c.assignment_id = a.assignment_id and c.status = 'revoked')
  group by a.student_id, a.competency_id;
