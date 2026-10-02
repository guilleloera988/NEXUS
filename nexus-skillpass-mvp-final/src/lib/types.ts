// Shapes returned by the database RPCs (see supabase/migrations/*_read_rpcs.sql).

export type Role = 'student' | 'company' | 'supervisor' | 'university' | 'admin';
export type ChallengeStatus = 'draft' | 'published' | 'recruiting' | 'active' | 'under_review' | 'completed' | 'archived';
export type EvidenceStatus = 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected';
export type EvidenceKind = 'file' | 'image' | 'pdf' | 'document' | 'presentation' | 'link' | 'repository' | 'video';
export type VathStatus = 'draft' | 'submitted' | 'verified' | 'adjusted' | 'rejected';
export type ApplicationStatus = 'submitted' | 'shortlisted' | 'accepted' | 'rejected' | 'withdrawn';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type Outcome = 'approved' | 'partially_approved' | 'changes_requested' | 'rejected';
export type CompetencyCategory = 'technical' | 'digital' | 'business' | 'human';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  slug: string;
  headline: string;
  bio: string;
  location: string;
  university_id: string | null;
  career: string;
  semester: number | null;
  interests: string[];
  availability: string;
  hours_per_week: number | null;
  onboarding_completed: boolean;
  skillpass_public: boolean;
  open_to_opportunities: boolean;
  public_show_university: boolean;
  public_show_career: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface OrganizationRef {
  id: string;
  name: string;
  kind: 'company' | 'university' | 'aindev';
  slug: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  is_demo: boolean;
}

export interface Me {
  profile: Profile;
  memberships: { organization_id: string; member_role: string; organization: OrganizationRef }[];
  university: { id: string; name: string; verification_status: string } | null;
  unread_notifications: number;
  pending_validations: number;
  pending_invitations: number;
  mode: 'demo' | 'supabase';
  demoId: string | null;
}

export interface Competency {
  id: string;
  slug: string;
  name_es: string;
  name_en: string;
  category: CompetencyCategory;
  required_level?: number;
}

export interface Lookups {
  competencies: Competency[];
  universities: { id: string; name: string; campus: string; is_demo: boolean }[];
}

export interface MatchCompetency extends Competency {
  competency_id: string;
  source: 'verified' | 'declared' | 'missing';
}

export interface Match {
  score: number;
  skills: number;
  interests: number;
  career: number;
  availability: number;
  weekly_hours: number;
  competencies: MatchCompetency[];
}

export interface Challenge {
  id: string;
  organization_id: string;
  title: string;
  summary: string;
  description: string;
  problem: string;
  objective: string;
  industry: string;
  tags: string[];
  target_careers: string[];
  modality: 'remote' | 'hybrid' | 'onsite';
  location: string;
  duration_weeks: number;
  start_date: string | null;
  end_date: string | null;
  max_participants: number;
  estimated_vath: number;
  supervisor_id: string | null;
  conditions: string;
  compensation_type: 'paid' | 'stipend' | 'prize' | 'in_kind' | 'none';
  compensation_details: string;
  ip_policy: 'student_owns' | 'shared' | 'company_license' | 'company_owns' | 'to_be_agreed';
  ip_details: string;
  confidentiality: 'public' | 'confidential' | 'nda_required';
  publication_policy: 'public_allowed' | 'summary_only' | 'confidential';
  status: ChallengeStatus;
  is_demo: boolean;
  created_at: string;
  organization?: { id: string; name: string; verification_status: string; industry?: string; location?: string; website?: string; description?: string };
  supervisor?: { id: string; full_name: string; headline: string } | null;
}

export interface ChallengeCard extends Pick<Challenge, 'id' | 'title' | 'summary' | 'industry' | 'modality' | 'location' | 'duration_weeks' | 'start_date' | 'end_date' | 'max_participants' | 'estimated_vath' | 'status' | 'compensation_type' | 'tags' | 'created_at' | 'is_demo'> {
  organization: { id: string; name: string; verification_status: string };
  competencies: Competency[];
  counts: { participants: number; applications: number } | null;
  match: Match | null;
  my_application: ApplicationStatus | null;
  my_assignment: 'active' | 'completed' | 'withdrawn' | null;
  pending_validations: number;
  pending_applications: number;
}

export interface Deliverable {
  id: string;
  challenge_id: string;
  title: string;
  description: string;
  due_date: string | null;
  sort_order: number;
  evidence_total?: number;
  evidence_approved?: number;
}

export interface Application {
  id: string;
  challenge_id: string;
  student_id: string;
  status: ApplicationStatus;
  motivation: string;
  availability_note: string;
  match_score: number | null;
  decision_note: string;
  created_at: string;
  decided_at: string | null;
}

export interface Assignment {
  id: string;
  challenge_id: string;
  student_id: string;
  status: 'active' | 'completed' | 'withdrawn';
  team_role: string;
  started_at: string;
  completed_at: string | null;
}

export interface CandidateApplication {
  id: string;
  status: ApplicationStatus;
  motivation: string;
  availability_note: string;
  created_at: string;
  decided_at: string | null;
  decision_note: string;
  score: number | null;
  match: Match | null;
  student: { id: string; full_name: string; headline: string; career: string; semester: number | null; availability: string; hours_per_week: number | null; university: string | null };
}

export interface AuditEntry {
  action: string;
  created_at: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  actor_name: string | null;
  subject_name: string | null;
}

export interface ChallengeDetail {
  challenge: Challenge;
  competencies: Competency[];
  deliverables: Deliverable[];
  counts: { participants: number; applications: number } | null;
  can_manage: boolean;
  can_review: boolean;
  my_application: Application | null;
  my_assignment: Assignment | null;
  match: Match | null;
  participants: { assignment_id: string; student_id: string; status: string; team_role: string; full_name: string; career: string }[];
  applications: CandidateApplication[];
  decision_history: AuditEntry[];
  org_members: { user_id: string; full_name: string; member_role: string; headline: string }[];
}

export interface Task {
  id: string;
  challenge_id: string;
  deliverable_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  created_by: string | null;
}

export interface Evidence {
  id: string;
  challenge_id: string;
  assignment_id: string;
  student_id: string;
  student_name: string;
  deliverable_id: string | null;
  task_id: string | null;
  title: string;
  description: string;
  kind: EvidenceKind;
  url: string | null;
  has_file: boolean;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  version: number;
  previous_id: string | null;
  status: EvidenceStatus;
  is_public: boolean;
  is_mine?: boolean;
  in_request?: boolean;
  deliverable_title?: string | null;
  review_comment: string;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  competency_ids: string[];
}

export interface VathEntry {
  id: string;
  challenge_id: string;
  assignment_id: string;
  student_id: string;
  student_name?: string;
  task_id: string | null;
  task_title?: string | null;
  activity_date: string;
  activity: string;
  description: string;
  submitted_hours: number;
  verified_hours: number | null;
  status: VathStatus;
  validation_comment: string;
  validator_name?: string | null;
  validated_at: string | null;
  evidence_ids: string[];
  is_mine?: boolean;
  created_at: string;
}

export interface ValidationRequest {
  id: string;
  challenge_id: string;
  assignment_id: string;
  student_id: string;
  student_name?: string;
  status: 'pending' | 'completed' | 'cancelled';
  student_note: string;
  outcome: Outcome | null;
  summary_comment: string;
  completed_by_name: string | null;
  completed_at: string | null;
  credential_code: string | null;
  items?: number;
  created_at: string;
}

export interface Assessment {
  id: string;
  competency_id: string;
  level: number;
  comment: string;
  created_at: string;
  student_id: string;
  assessor_name: string | null;
}

export interface Workspace {
  forbidden?: boolean;
  role_view: 'reviewer' | 'participant';
  challenge: Challenge;
  competencies: Competency[];
  deliverables: Deliverable[];
  tasks: Task[];
  team: { assignment_id: string; student_id: string; full_name: string; career: string; team_role: string; status: string; is_me: boolean; verified_hours: number | null; pending_hours: number | null; credential_code: string | null }[];
  my_assignment: Assignment | null;
  evidence: Evidence[];
  vath: VathEntry[];
  requests: ValidationRequest[];
  assessments: Assessment[];
  credential: { id: string; code: string; status: string; issued_at: string } | null;
  activity: { action: string; created_at: string; actor_name: string | null; details: Record<string, string> }[];
}

export interface ValidationDetail {
  request: ValidationRequest;
  can_decide: boolean;
  challenge: { id: string; title: string; summary: string; objective: string; status: string; start_date: string | null; end_date: string | null; estimated_vath: number; organization_name: string; supervisor_name: string | null };
  student: { id: string; full_name: string; career: string; semester: number | null; headline: string; university: string | null };
  assignment: { id: string; status: string; started_at: string; verified_hours: number; assessed_competencies: number; credential_code: string | null };
  competencies: (Competency & { previous_level: number | null; assessed_level: number | null; assessed_comment: string | null })[];
  vath: VathEntry[];
  evidence: Evidence[];
  decisions: { id: string; item_type: string; item_id: string; decision: string; previous_value: Record<string, unknown>; new_value: Record<string, unknown>; comment: string; decided_by_name: string | null; decided_at: string }[];
}

export interface PublicCredential {
  code: string;
  status: 'active' | 'revoked';
  issued_at: string;
  revoked_at: string | null;
  is_demo: boolean;
  confidential: boolean;
  challenge_title: string | null;
  organization_name: string | null;
  industry: string;
  modality: string;
  start_date: string | null;
  end_date: string | null;
  verified_hours: number;
  competencies: { competency_id: string; slug: string; name_es: string; name_en: string; category: CompetencyCategory; level: number }[];
  supervisor_name: string;
  supervisor_title: string;
  evidence_approved: number;
  issuer: string;
  public_evidence: { id: string; title: string; kind: EvidenceKind; url: string | null; has_file: boolean; file_name: string | null }[];
}

export interface OwnCredential extends PublicCredential {
  id: string;
  verification_enabled: boolean;
  challenge_id: string;
  real_challenge_title: string;
  real_organization_name: string;
  publication_policy: string;
}

export interface SkillPassMe {
  profile: Profile & { university: string | null };
  credentials: OwnCredential[];
  verified_competencies: (Competency & { level: number; challenges: number; last_assessed_at: string; credentialed: boolean })[];
  developing: (Competency & { level: number })[];
  in_progress: { challenge_id: string; title: string; organization_name: string; verified_hours: number; pending_hours: number }[];
  declared_skills: Competency[];
  totals: { credentialed_vath: number; verified_vath: number; verified_projects: number; verified_competencies: number };
}

export interface PublicSkillPass {
  profile: { full_name: string; headline: string; bio: string; slug: string; is_demo: boolean; member_since: string; career: string | null; university: string | null };
  credentials: PublicCredential[];
  competencies: { slug: string; name_es: string; name_en: string; category: CompetencyCategory; level: number; projects: number }[];
  summary: { verified_vath: number; verified_projects: number; validators: number };
}

export interface PublicVerification {
  credential: PublicCredential;
  holder: { full_name: string; skillpass_slug: string | null; career: string | null; university: string | null };
  verification: { status: 'valid' | 'revoked'; checked_at: string };
}

export interface NotificationItem {
  id: string;
  kind: string;
  params: Record<string, string | number>;
  link: string;
  read_at: string | null;
  created_at: string;
}
