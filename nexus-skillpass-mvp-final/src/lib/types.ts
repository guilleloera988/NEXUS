export type Role = 'student' | 'supervisor' | 'university' | 'admin';
export type ExperienceStatus = 'declared' | 'pending_validation' | 'changes_requested' | 'rejected' | 'verified' | 'revoked';
export interface BaseRow { id: string; created_at: string; updated_at?: string; is_demo?: boolean }
export interface Profile extends BaseRow { full_name: string; headline: string; location: string; university: string; career: string; semester: number | null; bio: string; interests: string; role: Role; slug: string; is_public: boolean }
export interface Organization extends BaseRow { name: string; type: 'company' | 'university' | 'nonprofit' | 'government' | 'aindev' }
export interface OrganizationMember extends BaseRow { user_id: string; organization_id: string; role: Role }
export interface Skill extends BaseRow { name: string; category: 'technical' | 'business' | 'human' }
export interface Challenge extends BaseRow { organization_id: string; title: string; description: string; problem: string; expected_outcome: string; modality: string; start_date: string; end_date: string; status: string }
export interface ChallengeSkill { challenge_id: string; skill_id: string }
export interface ChallengeParticipant extends BaseRow { challenge_id: string; student_id: string; status?: string }
export interface Experience extends BaseRow { student_id: string; challenge_id: string | null; organization_id: string; title: string; description: string; responsibilities: string; deliverables: string; start_date: string; end_date: string; hours: number; verified_hours?: number; status: ExperienceStatus }
export interface ExperienceSkill { experience_id: string; skill_id: string }
export interface Evidence extends BaseRow { experience_id: string; title: string; description: string; url: string; kind: string; is_public: boolean }
export interface ValidationRequest extends BaseRow { experience_id: string; status: string }
export interface Validation extends BaseRow { experience_id: string; reviewer_id: string; reviewer_name?: string; organization_id?: string; decision: 'approve' | 'request_changes' | 'reject'; comment: string; rating: number; verified_hours: number }
export interface Credential extends BaseRow { student_id: string; experience_id: string; validation_id: string; status: 'active' | 'revoked'; issued_at: string; revoked_at: string | null; revocation_reason?: string }
export interface CredentialSkill { credential_id: string; skill_id: string; level: number }
export interface ActivityEvent extends BaseRow { actor_id: string; action: string; entity_id: string; details?: Record<string, unknown> }
export interface Snapshot { profile: Profile | null; profiles: Profile[]; organizations: Organization[]; organization_members: OrganizationMember[]; skills: Skill[]; challenges: Challenge[]; challenge_skills: ChallengeSkill[]; challenge_participants: ChallengeParticipant[]; experiences: Experience[]; experience_skills: ExperienceSkill[]; evidence: Evidence[]; validation_requests: ValidationRequest[]; validations: Validation[]; credentials: Credential[]; credential_skills: CredentialSkill[]; activity_events: ActivityEvent[]; credential?: Credential | null }
export interface AppState { mode: 'demo' | 'supabase'; snapshot: Snapshot; demoId?: string }
export const DEMO_USERS: Record<Role, string> = { student: '10000000-0000-4000-8000-000000000001', supervisor: '10000000-0000-4000-8000-000000000002', university: '10000000-0000-4000-8000-000000000003', admin: '10000000-0000-4000-8000-000000000004' };
