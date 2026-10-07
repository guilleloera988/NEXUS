-- SkillPass — indexes for foreign keys that are real lookup keys (Supabase performance advisor:
-- unindexed_foreign_keys).
--
-- The advisor lists 40 foreign keys without a covering index. Only the ones below are filtered or
-- joined on in RPCs/policies, or are scanned when users delete the referenced row (ON DELETE SET
-- NULL / CASCADE from actions such as deleting a task, an evidence item or a deliverable). The
-- rest are "who did it" columns (decided_by, issued_by, created_by, ...) that are never filtered
-- on and whose referenced rows are never deleted, so an index would only add write cost.
-- Optional links use partial indexes: equality lookups imply NOT NULL, so the planner uses them.

-- Validation review and workspace: assessments per assignment / per challenge.
create index if not exists competency_assessments_assignment_id_idx on public.competency_assessments (assignment_id);
create index if not exists competency_assessments_challenge_id_idx on public.competency_assessments (challenge_id);

-- Company dashboard: credentials issued for the company's challenges.
create index if not exists credentials_challenge_id_idx on public.credentials (challenge_id);

-- Public verification: approved public evidence of the credential's assignment.
create index if not exists evidence_assignment_id_idx on public.evidence (assignment_id);

-- Workspace evidence counts per deliverable; deliverables removed on challenge save (SET NULL).
create index if not exists evidence_deliverable_id_idx on public.evidence (deliverable_id) where deliverable_id is not null;

-- sp_delete_evidence checks for newer versions before deleting (self-reference, NO ACTION).
create index if not exists evidence_previous_id_idx on public.evidence (previous_id) where previous_id is not null;

-- Task deletion clears these links (ON DELETE SET NULL).
create index if not exists evidence_task_id_idx on public.evidence (task_id) where task_id is not null;
create index if not exists vath_entries_task_id_idx on public.vath_entries (task_id) where task_id is not null;
create index if not exists tasks_deliverable_id_idx on public.tasks (deliverable_id) where deliverable_id is not null;

-- Evidence deletion removes its VATH links (CASCADE); the PK leads with vath_entry_id.
create index if not exists vath_entry_evidence_evidence_id_idx on public.vath_entry_evidence (evidence_id);

-- Student dashboard pending validations and the owner branch of the RLS policy.
create index if not exists validation_requests_student_id_idx on public.validation_requests (student_id);

-- Per-reporter rate limit in sp_report_incident (reported_by + last hour) and the RLS owner branch.
create index if not exists incidents_reported_by_idx on public.incidents (reported_by, created_at);
