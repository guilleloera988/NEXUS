import { z } from 'zod';
import {
  AVAILABILITY, CHALLENGE_STATUSES, COMPENSATION_TYPES, CONFIDENTIALITY, INTERESTS, IP_POLICIES, LINK_KINDS, MODALITIES,
  ORG_SIZES, PUBLICATION_POLICIES, UNPAID_VATH_LIMIT,
} from './constants';

/*
 * Input schemas for Server Actions. They bound shape and size before anything reaches the
 * database; the SQL RPCs remain the authority for business rules and authorization.
 */

const uuid = z.string().uuid();
const text = (max: number, min = 0) => z.string().trim().min(min).max(max);
// `.optional()` before `.transform()` lets the key be absent (zod 4 decides key optionality from the input side).
const optionalUuid = z.union([uuid, z.literal(''), z.null()]).optional().transform((v) => (v ? v : null));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(s)), 'invalid_date');
const optionalDate = z.union([date, z.literal(''), z.null()]).optional().transform((v) => (v ? v : null));
const httpsUrl = z.string().trim().max(2048).url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'https_only');
const optionalHttps = z.union([httpsUrl, z.literal('')]).default('');
const intFromForm = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const optionalInt = (min: number, max: number) => z.union([z.literal(''), z.null(), z.coerce.number().int().min(min).max(max)]).optional()
  .transform((v) => (v === '' || v === null || v === undefined ? null : v));

export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(128) });
export const signupSchema = z.object({
  full_name: text(160, 2),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10, 'weak_password').max(128),
  account_type: z.enum(['student', 'company', 'university']),
});
export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
export const resetSchema = z.object({ password: z.string().min(10, 'weak_password').max(128), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'password_mismatch', path: ['confirm'] });

export const studentProfileSchema = z.object({
  full_name: text(160, 1),
  headline: text(160).default(''),
  bio: text(1200).default(''),
  location: text(120).default(''),
  university_id: optionalUuid,
  career: text(160).default(''),
  semester: optionalInt(1, 20),
  interests: z.array(z.enum(INTERESTS)).max(6).default([]),
  skill_ids: z.array(uuid).max(20).default([]),
  availability: z.enum(AVAILABILITY).default('part_time'),
  hours_per_week: optionalInt(1, 60),
  open_to_opportunities: z.boolean().default(false),
});

export const privacySchema = z.object({
  skillpass_public: z.boolean(),
  open_to_opportunities: z.boolean(),
  public_show_university: z.boolean(),
  public_show_career: z.boolean(),
});

export const staffProfileSchema = z.object({ full_name: text(160, 1), headline: text(160).default(''), bio: text(1200).default('') });

export const organizationOnboardingSchema = z.object({
  full_name: text(160, 1),
  headline: text(160).default(''),
  organization_name: text(160, 2),
  industry: text(60).default(''),
  size: z.union([z.enum(ORG_SIZES), z.literal('')]).default(''),
  location: text(120).default(''),
  website: optionalHttps,
  description: text(1500).default(''),
  needs: text(1500).default(''),
  campus: text(120).default(''),
  programs: z.array(text(120, 1)).max(60).default([]),
});

export const organizationSchema = organizationOnboardingSchema.omit({ full_name: true, headline: true, organization_name: true }).extend({
  organization_id: uuid,
  name: text(160, 2),
});

export const inviteSchema = z.object({ organization_id: uuid, email: z.string().trim().toLowerCase().email().max(254), member_role: z.enum(['manager', 'supervisor', 'staff']) });

export const challengeSchema = z.object({
  id: optionalUuid,
  organization_id: optionalUuid,
  title: text(160, 3),
  summary: text(400).default(''),
  description: text(4000).default(''),
  problem: text(3000, 10),
  objective: text(2000, 10),
  industry: text(60).default(''),
  tags: z.array(z.enum(INTERESTS)).max(8).default([]),
  target_careers: z.array(text(120, 1)).max(12).default([]),
  modality: z.enum(MODALITIES),
  location: text(120).default(''),
  duration_weeks: intFromForm(1, 52),
  start_date: optionalDate,
  end_date: optionalDate,
  max_participants: intFromForm(1, 50),
  estimated_vath: z.coerce.number().min(1).max(1000),
  supervisor_id: optionalUuid,
  conditions: text(2000).default(''),
  compensation_type: z.enum(COMPENSATION_TYPES),
  compensation_details: text(600).default(''),
  ip_policy: z.enum(IP_POLICIES),
  ip_details: text(1500).default(''),
  confidentiality: z.enum(CONFIDENTIALITY),
  publication_policy: z.enum(PUBLICATION_POLICIES),
  competencies: z.array(z.object({ competency_id: uuid, required_level: intFromForm(1, 5) })).max(10).default([]),
  deliverables: z.array(z.object({ id: optionalUuid, title: text(160, 2), description: text(1000).default(''), due_date: optionalDate })).max(12).default([]),
}).superRefine((v, ctx) => {
  if (v.start_date && v.end_date && v.end_date < v.start_date) ctx.addIssue({ code: 'custom', message: 'invalid_dates', path: ['end_date'] });
  if (v.compensation_type === 'none' && v.estimated_vath > UNPAID_VATH_LIMIT) ctx.addIssue({ code: 'custom', message: 'fair_work_unpaid_limit', path: ['estimated_vath'] });
});

export const challengeStatusSchema = z.object({ challenge_id: uuid, status: z.enum(CHALLENGE_STATUSES) });
export const applySchema = z.object({ challenge_id: uuid, motivation: text(2000, 20), availability_note: text(400).default('') });
export const decisionSchema = z.object({ application_id: uuid, decision: z.enum(['shortlist', 'accept', 'reject']), note: text(1000).default('') });
export const endAssignmentSchema = z.object({ assignment_id: uuid, reason: text(600, 5) });
export const inviteToChallengeSchema = z.object({ challenge_id: uuid, student_id: uuid, message: text(600).default('') });

export const taskSchema = z.object({
  id: optionalUuid,
  challenge_id: uuid,
  title: text(160, 2),
  description: text(1500).default(''),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  assignee_id: optionalUuid,
  deliverable_id: optionalUuid,
  due_date: optionalDate,
});
export const taskStatusSchema = z.object({ task_id: uuid, status: z.enum(['todo', 'in_progress', 'done']) });

export const linkEvidenceSchema = z.object({
  challenge_id: uuid,
  title: text(160, 2),
  description: text(2000).default(''),
  kind: z.enum(LINK_KINDS),
  url: httpsUrl,
  deliverable_id: optionalUuid,
  task_id: optionalUuid,
  competency_ids: z.array(uuid).max(10).default([]),
  is_public: z.boolean().default(false),
  previous_id: optionalUuid,
});
export const fileEvidenceSchema = linkEvidenceSchema.omit({ kind: true, url: true });

export const vathSchema = z.object({
  id: optionalUuid,
  challenge_id: uuid,
  activity_date: date,
  activity: text(160, 3),
  description: text(2000, 10),
  hours: z.coerce.number().min(0.25).max(16),
  task_id: optionalUuid,
  evidence_ids: z.array(uuid).max(10).default([]),
});

export const submitSchema = z.object({ challenge_id: uuid, note: text(1000).default('') });

export const validationSchema = z.object({
  request_id: uuid,
  vath: z.array(z.object({ id: uuid, decision: z.enum(['verify', 'adjust', 'reject']), verified_hours: z.coerce.number().min(0).max(16).optional(), comment: text(2000).default('') })).max(200),
  evidence: z.array(z.object({ id: uuid, decision: z.enum(['approve', 'request_changes', 'reject']), comment: text(2000).default('') })).max(200),
  competencies: z.array(z.object({ competency_id: uuid, level: intFromForm(1, 5), comment: text(1000).default('') })).max(10),
  summary_comment: text(2000).default(''),
  issue_credential: z.boolean().default(false),
});

export const revokeSchema = z.object({ credential_id: uuid, reason: text(1000, 5) });
export const orgStatusSchema = z.object({ organization_id: uuid, status: z.enum(['pending', 'verified', 'rejected']) });
export const userRoleSchema = z.object({ user_id: uuid, role: z.enum(['student', 'company', 'supervisor', 'university']) });
export const competencySchema = z.object({
  id: optionalUuid, slug: text(60, 2), name_es: text(80, 2), name_en: text(80, 2), category: z.enum(['technical', 'digital', 'business', 'human']),
  description_es: text(400).default(''), description_en: text(400).default(''), is_active: z.boolean().default(true),
});
export const incidentSchema = z.object({
  entity_type: z.enum(['credential', 'evidence', 'challenge', 'profile', 'validation', 'other']).default('other'),
  entity_id: optionalUuid,
  category: z.enum(['incorrect_data', 'misconduct', 'privacy', 'suspected_fraud', 'technical', 'other']),
  description: text(2000, 10),
});
export const incidentUpdateSchema = z.object({ incident_id: uuid, status: z.enum(['open', 'investigating', 'resolved', 'dismissed']), resolution: text(2000).default('') });
