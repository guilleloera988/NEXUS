import { describe, expect, it } from 'vitest';
import {
  challengeSchema, linkEvidenceSchema, resetSchema, revokeSchema, signupSchema, userRoleSchema, validationSchema, vathSchema,
} from '@/lib/schemas';

const ID = '40000000-0000-4000-8000-000000000001';
const COMP = '30000000-0000-4000-8000-000000000005';
const issues = (result: { success: boolean; error?: { issues: { message: string; path: PropertyKey[] }[] } }) =>
  result.success ? [] : result.error!.issues.map((i) => `${i.path.join('.')}:${i.message}`);

const challenge = (overrides: Record<string, unknown> = {}) => ({
  title: 'Reto de prueba', problem: 'Un problema real y acotado.', objective: 'Un objetivo verificable.',
  modality: 'remote', duration_weeks: '6', max_participants: '3', estimated_vath: '40',
  compensation_type: 'stipend', ip_policy: 'shared', confidentiality: 'public', publication_policy: 'public_allowed',
  competencies: [{ competency_id: COMP, required_level: '3' }], deliverables: [{ title: 'Prototipo' }],
  ...overrides,
});

describe('challengeSchema', () => {
  it('accepts a complete challenge and coerces form numbers', () => {
    const parsed = challengeSchema.parse(challenge());
    expect(parsed.duration_weeks).toBe(6);
    expect(parsed.competencies[0].required_level).toBe(3);
    expect(parsed.deliverables[0].due_date).toBeNull();
  });
  it('enforces the fair-work limit for unpaid challenges', () => {
    expect(issues(challengeSchema.safeParse(challenge({ compensation_type: 'none', estimated_vath: '61' })))).toContain('estimated_vath:fair_work_unpaid_limit');
    expect(challengeSchema.safeParse(challenge({ compensation_type: 'none', estimated_vath: '60' })).success).toBe(true);
  });
  it('rejects an end date before the start date', () => {
    expect(issues(challengeSchema.safeParse(challenge({ start_date: '2026-10-10', end_date: '2026-10-01' })))).toContain('end_date:invalid_dates');
  });
  it('rejects unknown enums and oversized lists', () => {
    expect(challengeSchema.safeParse(challenge({ ip_policy: 'company_takes_all' })).success).toBe(false);
    expect(challengeSchema.safeParse(challenge({ competencies: Array.from({ length: 11 }, () => ({ competency_id: COMP, required_level: 3 })) })).success).toBe(false);
  });
});

describe('evidence and VATH inputs', () => {
  const link = (url: string) => linkEvidenceSchema.safeParse({ challenge_id: ID, title: 'Repositorio', kind: 'repository', url });
  it('only accepts https links without embedded credentials', () => {
    expect(link('https://github.com/demo/repo').success).toBe(true);
    expect(link('http://example.com').success).toBe(false);
    expect(link('javascript:alert(1)').success).toBe(false);
    expect(link('https://user:pass@example.com').success).toBe(false);
    expect(link('data:text/html,<script>').success).toBe(false);
  });
  it('bounds VATH hours between a quarter hour and one day of work', () => {
    const base = { challenge_id: ID, activity_date: '2026-09-30', activity: 'Entrevistas', description: 'Entrevistas con el equipo de ventas.' };
    expect(vathSchema.safeParse({ ...base, hours: '0.25' }).success).toBe(true);
    expect(vathSchema.safeParse({ ...base, hours: '16' }).success).toBe(true);
    expect(vathSchema.safeParse({ ...base, hours: '0.1' }).success).toBe(false);
    expect(vathSchema.safeParse({ ...base, hours: '24' }).success).toBe(false);
    expect(vathSchema.safeParse({ ...base, hours: '4', activity_date: '30/09/2026' }).success).toBe(false);
  });
});

describe('validation and administration inputs', () => {
  it('limits rubric levels to 1-5', () => {
    const base = { request_id: ID, vath: [], evidence: [] };
    expect(validationSchema.safeParse({ ...base, competencies: [{ competency_id: COMP, level: '5' }] }).success).toBe(true);
    expect(validationSchema.safeParse({ ...base, competencies: [{ competency_id: COMP, level: '6' }] }).success).toBe(false);
    expect(validationSchema.safeParse({ ...base, competencies: [{ competency_id: COMP, level: '0' }] }).success).toBe(false);
  });
  it('never lets an action assign the admin role', () => {
    expect(userRoleSchema.safeParse({ user_id: ID, role: 'admin' }).success).toBe(false);
  });
  it('requires a reason to revoke a credential', () => {
    expect(revokeSchema.safeParse({ credential_id: ID, reason: '' }).success).toBe(false);
    expect(revokeSchema.safeParse({ credential_id: ID, reason: 'Evidencia duplicada' }).success).toBe(true);
  });
  it('requires strong, matching passwords on reset', () => {
    expect(resetSchema.safeParse({ password: 'short', confirm: 'short' }).success).toBe(false);
    expect(resetSchema.safeParse({ password: 'una-clave-larga', confirm: 'otra-clave-larga' }).success).toBe(false);
    expect(resetSchema.safeParse({ password: 'una-clave-larga', confirm: 'una-clave-larga' }).success).toBe(true);
  });
  it('self-signup cannot request admin or supervisor accounts', () => {
    const base = { full_name: 'Nueva Persona', email: 'nueva@example.com', password: 'una-clave-larga', accept_terms: true };
    expect(signupSchema.safeParse({ ...base, account_type: 'admin' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, account_type: 'supervisor' }).success).toBe(false);
  });
});
