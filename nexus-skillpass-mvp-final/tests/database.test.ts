import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHALLENGE, COMP, ORGS, USERS, createDatabase, rpc, sql, type TestDb } from './helpers/pg';

type Row = Record<string, unknown>;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let db: TestDb;
const APP_TABLES = 24;

const challengeInput = (overrides: Json = {}) => ({
  organization_id: ORGS.nova,
  title: 'Quality Inspection Digital Checklist',
  summary: 'Digitalizar la lista de verificación de calidad.',
  description: 'Reto de prueba automatizada.',
  problem: 'Las inspecciones se registran en papel y se pierden.',
  objective: 'Entregar un prototipo de checklist digital validado en planta.',
  industry: 'manufacturing',
  tags: ['manufacturing', 'software'],
  target_careers: ['Sistemas'],
  modality: 'hybrid',
  location: 'Aguascalientes, Ags.',
  duration_weeks: 4,
  start_date: '2026-09-01',
  end_date: '2026-12-15',
  max_participants: 2,
  estimated_vath: 40,
  supervisor_id: USERS.carlos,
  conditions: 'Visitas a planta acordadas.',
  compensation_type: 'stipend',
  compensation_details: 'Apoyo económico de prueba.',
  ip_policy: 'shared',
  ip_details: 'Acuerdo de prueba.',
  confidentiality: 'public',
  publication_policy: 'public_allowed',
  competencies: [{ competency_id: COMP(5), required_level: 3 }, { competency_id: COMP(20), required_level: 3 }],
  deliverables: [{ title: 'Prototipo de checklist', description: 'Versión funcional', due_date: '2026-11-30' }],
  ...overrides,
});

const expectError = async (promise: Promise<unknown>, pattern: RegExp) => {
  await expect(promise).rejects.toThrow(pattern);
};

beforeAll(async () => {
  db = await createDatabase({
    extraSql: 'create table public.unrelated_app(value text); grant select on public.unrelated_app to anon;'
      + ' alter default privileges in schema public grant all on tables to anon, authenticated;'
      + ' alter default privileges in schema public grant execute on functions to anon, authenticated;',
  });
});
afterAll(async () => { await db?.close(); });

describe('schema, grants and RLS baseline', () => {
  it('enables RLS on every application table', async () => {
    const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and relname <> 'unrelated_app'");
    expect(rows.rows).toHaveLength(APP_TABLES);
    expect(rows.rows.filter((r) => !r.relrowsecurity)).toEqual([]);
  });

  it('never grants direct write privileges to API roles, even with Supabase-style default privileges', async () => {
    const rows = await db.query<Row>(
      "select table_name, privilege_type, grantee from information_schema.role_table_grants where table_schema = 'public' and table_name <> 'unrelated_app' and grantee in ('anon','authenticated') and privilege_type <> 'SELECT'");
    expect(rows.rows).toEqual([]);
    const anon = await db.query<Row>(
      "select table_name from information_schema.role_table_grants where table_schema = 'public' and table_name <> 'unrelated_app' and grantee = 'anon'");
    expect(anon.rows).toEqual([]);
  });

  it('keeps unrelated tables untouched and exposes only the public verification functions to anon', async () => {
    await expect(sql(db, null, 'select * from public.unrelated_app')).resolves.toEqual([]);
    const fns = await db.query<{ proname: string }>(
      "select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'sp\\_%' and has_function_privilege('anon', p.oid, 'execute') order by 1");
    expect(fns.rows.map((r) => r.proname)).toEqual(['sp_is_public_evidence_object', 'sp_public_credential', 'sp_public_evidence_file', 'sp_public_skillpass']);
  });

  it('blocks anonymous table reads and private RPCs', async () => {
    await expectError(sql(db, null, 'select * from public.profiles'), /permission denied/);
    await expectError(sql(db, null, 'select * from public.evidence'), /permission denied/);
    await expectError(rpc(db, null, 'sp_me'), /permission denied/);
    await expectError(rpc(db, null, 'sp_save_challenge', challengeInput()), /permission denied/);
  });

  it('rejects direct writes from signed-in users (mutations must use RPCs)', async () => {
    for (const q of [
      "update public.profiles set role = 'admin'",
      "update public.vath_entries set status = 'verified', verified_hours = submitted_hours",
      "insert into public.credentials(code) values ('SKP-2026-AAAA-BBBB')",
      'delete from public.audit_logs',
      "insert into public.competency_assessments(level) values (5)",
    ]) {
      await expectError(sql(db, USERS.maria, q), /permission denied/);
    }
  });
});

describe('account creation and roles', () => {
  it('never grants privileged roles from sign-up metadata', async () => {
    await db.query("insert into auth.users(id, email, raw_user_meta_data) values ('10000000-0000-4000-8000-000000000099', 'hostile@test.invalid', '{\"full_name\":\"Hostile\",\"account_type\":\"admin\"}')");
    const [p] = (await db.query<Row>("select role, onboarding_completed from public.profiles where id = '10000000-0000-4000-8000-000000000099'")).rows;
    expect(p).toEqual({ role: 'student', onboarding_completed: false });
  });

  it('grants supervisor only through an invitation from the organization', async () => {
    await expectError(rpc(db, USERS.maria, 'sp_invite_member', { organization_id: ORGS.nova, email: 'nuevo.supervisor@test.invalid', member_role: 'supervisor' }), /forbidden/);
    const result = await rpc<Json>(db, USERS.laura, 'sp_invite_member', { organization_id: ORGS.nova, email: 'nuevo.supervisor@test.invalid', member_role: 'supervisor' });
    expect(result.status).toBe('invited');
    await db.query("insert into auth.users(id, email, raw_user_meta_data) values ('10000000-0000-4000-8000-000000000098', 'nuevo.supervisor@test.invalid', '{\"full_name\":\"Nuevo Supervisor\",\"account_type\":\"company\"}')");
    const [p] = (await db.query<Row>("select p.role, m.member_role from public.profiles p join public.organization_members m on m.user_id = p.id where p.id = '10000000-0000-4000-8000-000000000098'")).rows;
    expect(p).toEqual({ role: 'supervisor', member_role: 'supervisor' });
  });

  it('does not let a user change their own role through profile updates', async () => {
    const hostile = '10000000-0000-4000-8000-000000000099';
    await rpc(db, hostile, 'sp_update_profile', { full_name: 'Hostile', role: 'admin', skill_ids: [COMP(1)] });
    const me = await rpc<Json>(db, hostile, 'sp_me');
    expect(me.profile.role).toBe('student');
    await expectError(rpc(db, hostile, 'sp_admin_set_user_role', { user_id: hostile, role: 'company' }), /admin_only/);
  });
});

describe('core workflow — acceptance flows 01 to 10', () => {
  let challengeId = '';
  let applicationId = '';
  let evidenceId = '';
  let vathId = '';
  let requestId = '';
  let credentialCode = '';

  it('FLOW 01 · a company creates and publishes a challenge that persists', async () => {
    const created = await rpc<Json>(db, USERS.laura, 'sp_save_challenge', challengeInput());
    challengeId = created.id;
    const published = await rpc<Json>(db, USERS.laura, 'sp_set_challenge_status', { challenge_id: challengeId, status: 'recruiting' });
    expect(published.status).toBe('recruiting');
    const detail = await rpc<Json>(db, USERS.valeria, 'sp_challenge', { id: challengeId });
    expect(detail.challenge.title).toBe('Quality Inspection Digital Checklist');
    expect(detail.competencies).toHaveLength(2);
    expect(detail.deliverables).toHaveLength(1);
    expect(detail.challenge.compensation_type).toBe('stipend');
  });

  it('FLOW 01 · enforces company authorization, verification and the fair-work guardrail', async () => {
    await expectError(rpc(db, USERS.maria, 'sp_save_challenge', challengeInput()), /forbidden/);
    await expectError(rpc(db, USERS.mariana, 'sp_save_challenge', challengeInput({ id: challengeId })), /forbidden/);
    await expectError(rpc(db, USERS.carlos, 'sp_save_challenge', challengeInput({ id: challengeId })), /forbidden/);
    await expectError(rpc(db, USERS.laura, 'sp_save_challenge', challengeInput({ compensation_type: 'none', estimated_vath: 120 })), /fair_work_unpaid_limit/);
    const pending = await rpc<Json>(db, USERS.ruben, 'sp_save_challenge', challengeInput({ organization_id: ORGS.agroPending, supervisor_id: null }));
    await expectError(rpc(db, USERS.ruben, 'sp_set_challenge_status', { challenge_id: pending.id, status: 'recruiting' }), /organization_not_verified/);
    await expectError(rpc(db, USERS.laura, 'sp_set_challenge_status', { challenge_id: challengeId, status: 'completed' }), /invalid_transition/);
    const draft = await rpc<Json>(db, USERS.valeria, 'sp_challenge', { id: pending.id });
    expect(draft).toBeNull();
  });

  it('FLOW 02 · a student applies with a transparent Skills Match and is assigned', async () => {
    const applied = await rpc<Json>(db, USERS.valeria, 'sp_apply', { challenge_id: challengeId, motivation: 'Quiero digitalizar procesos de calidad en planta con datos reales.' });
    applicationId = applied.id;
    expect(applied.match_score).toBeGreaterThanOrEqual(0);
    await expectError(rpc(db, USERS.valeria, 'sp_apply', { challenge_id: challengeId, motivation: 'Segundo intento de aplicación repetida.' }), /already_applied/);
    await expectError(rpc(db, USERS.laura, 'sp_apply', { challenge_id: challengeId, motivation: 'Una empresa no puede aplicar a retos.' }), /students_only/);

    const asCompany = await rpc<Json>(db, USERS.laura, 'sp_challenge', { id: challengeId });
    const app = asCompany.applications.find((a: Json) => a.id === applicationId);
    expect(app.match.score).toBe(app.score);
    expect(app.match.skills + app.match.interests + app.match.career + app.match.availability).toBeCloseTo(app.score, -0.5);

    await expectError(rpc(db, USERS.hector, 'sp_decide_application', { application_id: applicationId, decision: 'accept' }), /forbidden/);
    await expectError(rpc(db, USERS.valeria, 'sp_decide_application', { application_id: applicationId, decision: 'accept' }), /forbidden/);
    const decided = await rpc<Json>(db, USERS.laura, 'sp_decide_application', { application_id: applicationId, decision: 'accept', note: 'Bienvenida al reto.' });
    expect(decided.status).toBe('accepted');

    const workspace = await rpc<Json>(db, USERS.valeria, 'sp_workspace', { challenge_id: challengeId });
    expect(workspace.role_view).toBe('participant');
    expect(workspace.my_assignment.status).toBe('active');
    const outsider = await rpc<Json>(db, USERS.andres, 'sp_workspace', { challenge_id: challengeId });
    expect(outsider).toEqual({ forbidden: true });
  });

  it('FLOW 02 · records the decision history', async () => {
    const detail = await rpc<Json>(db, USERS.laura, 'sp_challenge', { id: challengeId });
    const actions = detail.decision_history.map((h: Json) => h.action);
    expect(actions).toContain('application_decided');
    const decision = detail.decision_history.find((h: Json) => h.action === 'application_decided');
    expect(decision.before.status).toBe('submitted');
    expect(decision.after.status).toBe('accepted');
  });

  it('FLOW 03 · evidence is attached to the challenge and assignment', async () => {
    const link = await rpc<Json>(db, USERS.valeria, 'sp_add_evidence', {
      challenge_id: challengeId, title: 'Prototipo del checklist', description: 'Enlace al prototipo', kind: 'link',
      url: 'https://example.com/checklist', competency_ids: [COMP(5)],
    });
    evidenceId = link.id;
    const file = await rpc<Json>(db, USERS.valeria, 'sp_add_evidence', {
      challenge_id: challengeId, title: 'Reporte de pruebas', kind: 'pdf', storage_path: `${USERS.valeria}/${challengeId}/abc123-reporte.pdf`,
      file_name: 'reporte.pdf', mime_type: 'application/pdf', size_bytes: 2048,
    });
    expect(file.id).toBeTruthy();
    const [row] = await sql<Row>(db, USERS.valeria, 'select challenge_id, status, student_id from public.evidence where id = $1', [evidenceId]);
    expect(row).toEqual({ challenge_id: challengeId, status: 'draft', student_id: USERS.valeria });

    await expectError(rpc(db, USERS.valeria, 'sp_add_evidence', { challenge_id: challengeId, title: 'Ruta ajena', kind: 'pdf',
      storage_path: `${USERS.maria}/${challengeId}/x.pdf`, file_name: 'x.pdf', mime_type: 'application/pdf', size_bytes: 10 }), /invalid_field/);
    await expectError(rpc(db, USERS.valeria, 'sp_add_evidence', { challenge_id: challengeId, title: 'Ejecutable', kind: 'file',
      storage_path: `${USERS.valeria}/${challengeId}/x.exe`, file_name: 'x.exe', mime_type: 'application/x-msdownload', size_bytes: 10 }), /invalid_file_type/);
    await expectError(rpc(db, USERS.valeria, 'sp_add_evidence', { challenge_id: challengeId, title: 'Inseguro', kind: 'link', url: 'http://example.com' }), /invalid_field/);
    await expectError(rpc(db, USERS.andres, 'sp_add_evidence', { challenge_id: challengeId, title: 'Intruso', kind: 'link', url: 'https://example.com' }), /not_assigned/);
  });

  it('FLOW 03 · drafts stay private to their author', async () => {
    const reviewerView = await sql<Row>(db, USERS.carlos, 'select id from public.evidence where id = $1', [evidenceId]);
    expect(reviewerView).toEqual([]);
  });

  it('FLOW 04 · VATH entries validate hours, dates, duplicates and evidence', async () => {
    const base = { challenge_id: challengeId, activity_date: '2026-09-20', activity: 'Diseño del checklist', description: 'Diseño de los campos de inspección con el equipo de calidad.', hours: 6, evidence_ids: [evidenceId] };
    await expectError(rpc(db, USERS.valeria, 'sp_save_vath', { ...base, hours: -2 }), /invalid_field/);
    await expectError(rpc(db, USERS.valeria, 'sp_save_vath', { ...base, hours: 0 }), /invalid_field/);
    await expectError(rpc(db, USERS.valeria, 'sp_save_vath', { ...base, hours: 20 }), /invalid_field/);
    await expectError(rpc(db, USERS.valeria, 'sp_save_vath', { ...base, activity_date: '2099-01-01' }), /vath_future_date/);
    const saved = await rpc<Json>(db, USERS.valeria, 'sp_save_vath', base);
    vathId = saved.id;
    await expectError(rpc(db, USERS.valeria, 'sp_save_vath', base), /vath_duplicate/);
    await expectError(rpc(db, USERS.valeria, 'sp_save_vath', { ...base, activity: 'Otra actividad del mismo día', hours: 11 }), /vath_daily_limit/);
    const noEvidence = await rpc<Json>(db, USERS.valeria, 'sp_save_vath', { ...base, activity_date: '2026-09-21', activity: 'Pruebas sin evidencia', evidence_ids: [] });
    await expectError(rpc(db, USERS.valeria, 'sp_submit_for_validation', { challenge_id: challengeId }), /vath_requires_evidence/);
    await rpc(db, USERS.valeria, 'sp_delete_vath', { id: noEvidence.id });
  });

  it('FLOW 04 · submitted hours stay pending validation with submitted and verified hours separated', async () => {
    const submitted = await rpc<Json>(db, USERS.valeria, 'sp_submit_for_validation', { challenge_id: challengeId, note: 'Primera entrega.' });
    requestId = submitted.request_id;
    expect(submitted.vath_count).toBe(1);
    expect(submitted.evidence_count).toBe(2);
    const [entry] = await sql<Row>(db, USERS.valeria, 'select status, submitted_hours::float8 as submitted, verified_hours from public.vath_entries where id = $1', [vathId]);
    expect(entry).toEqual({ status: 'submitted', submitted: 6, verified_hours: null });
    await expectError(rpc(db, USERS.valeria, 'sp_save_vath', { id: vathId, challenge_id: challengeId, activity_date: '2026-09-20', activity: 'Cambio tardío', description: 'Intento de editar horas enviadas.', hours: 12 }), /vath_locked/);
  });

  it('FLOW 05 · the supervisor can review hours and evidence; other organizations cannot', async () => {
    const queue = await rpc<Json>(db, USERS.carlos, 'sp_validation_queue');
    expect(queue.pending.map((r: Json) => r.id)).toContain(requestId);
    const detail = await rpc<Json>(db, USERS.carlos, 'sp_validation', { id: requestId });
    expect(detail.can_decide).toBe(true);
    expect(detail.vath).toHaveLength(1);
    expect(detail.evidence.length).toBeGreaterThanOrEqual(2);
    expect(detail.student.full_name).toBe('Valeria Núñez');

    expect(await rpc(db, USERS.hector, 'sp_validation', { id: requestId })).toBeNull();
    expect(await rpc(db, USERS.elena, 'sp_validation', { id: requestId })).toBeNull();
    await expectError(rpc(db, USERS.hector, 'sp_complete_validation', { request_id: requestId }), /forbidden/);
    await expectError(rpc(db, USERS.elena, 'sp_complete_validation', { request_id: requestId }), /forbidden/);
    await expectError(rpc(db, USERS.valeria, 'sp_complete_validation', { request_id: requestId }), /forbidden/);
  });

  it('FLOW 06 · validation requires justified adjustments and stores verified hours, rubric and audit trail', async () => {
    const detail = await rpc<Json>(db, USERS.carlos, 'sp_validation', { id: requestId });
    const evidence = detail.evidence.filter((e: Json) => e.in_request).map((e: Json) => ({ id: e.id, decision: 'approve' }));
    const competencies = [{ competency_id: COMP(5), level: 4, comment: 'Automatización bien resuelta.' }, { competency_id: COMP(20), level: 2 }];

    await expectError(rpc(db, USERS.carlos, 'sp_complete_validation', { request_id: requestId, vath: [], evidence, competencies }), /missing_decision/);
    await expectError(rpc(db, USERS.carlos, 'sp_complete_validation', { request_id: requestId, vath: [{ id: vathId, decision: 'adjust', verified_hours: 5 }], evidence, competencies }), /comment_required/);
    await expectError(rpc(db, USERS.carlos, 'sp_complete_validation', { request_id: requestId, vath: [{ id: vathId, decision: 'adjust', verified_hours: 7, comment: 'Más horas que las declaradas.' }], evidence, competencies }), /adjust_must_reduce/);
    await expectError(rpc(db, USERS.carlos, 'sp_complete_validation', { request_id: requestId, vath: [{ id: vathId, decision: 'verify' }], evidence, competencies: [{ competency_id: COMP(9), level: 4 }] }), /invalid_field/);

    const result = await rpc<Json>(db, USERS.carlos, 'sp_complete_validation', {
      request_id: requestId,
      vath: [{ id: vathId, decision: 'adjust', verified_hours: 5, comment: 'Se reconocen 5 h según la minuta de la sesión.' }],
      evidence, competencies, summary_comment: 'Buen trabajo.', issue_credential: true,
    });
    expect(result.outcome).toBe('approved');
    expect(Number(result.verified_hours)).toBe(5);
    credentialCode = result.credential_code;
    expect(credentialCode).toMatch(/^SKP-\d{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);

    const [entry] = await sql<Row>(db, USERS.valeria, 'select status, submitted_hours::float8 as submitted, verified_hours::float8 as verified, validated_by from public.vath_entries where id = $1', [vathId]);
    expect(entry).toEqual({ status: 'adjusted', submitted: 6, verified: 5, validated_by: USERS.carlos });
    const decisions = await sql<Row>(db, USERS.valeria, "select item_type, decision, previous_value, new_value, decided_by from public.validation_decisions where request_id = $1 and item_type = 'vath'", [requestId]);
    expect(decisions).toEqual([{ item_type: 'vath', decision: 'adjusted', previous_value: { status: 'submitted', submitted_hours: 6 }, new_value: { status: 'adjusted', verified_hours: 5 }, decided_by: USERS.carlos }]);
    const assessments = await sql<Row>(db, USERS.valeria, 'select competency_id, level, assessor_id from public.competency_assessments where request_id = $1 order by level desc', [requestId]);
    expect(assessments).toHaveLength(2);
    await expectError(rpc(db, USERS.carlos, 'sp_complete_validation', { request_id: requestId }), /request_closed/);
  });

  it('FLOW 07 · SkillPass shows the verified project, VATH and only competencies assessed at level 3+', async () => {
    const pass = await rpc<Json>(db, USERS.valeria, 'sp_skillpass_me');
    const credential = pass.credentials.find((c: Json) => c.code === credentialCode);
    expect(credential.challenge_title).toBe('Quality Inspection Digital Checklist');
    expect(Number(credential.verified_hours)).toBe(5);
    expect(credential.competencies.map((c: Json) => c.slug)).toEqual(['process-automation']);
    expect(pass.verified_competencies.map((c: Json) => c.slug)).toContain('process-automation');
    expect(pass.verified_competencies.map((c: Json) => c.slug)).not.toContain('problem-solving');
    expect(pass.developing.map((c: Json) => c.slug)).toContain('problem-solving');
    expect(Number(pass.totals.credentialed_vath)).toBe(26 + 5);
  });

  it('FLOW 08 · anyone can verify the credential without signing in; private data stays out', async () => {
    const pub = await rpc<Json>(db, null, 'sp_public_credential', { code: credentialCode.toLowerCase() });
    expect(pub.verification.status).toBe('valid');
    expect(pub.holder.full_name).toBe('Valeria Núñez');
    expect(pub.credential.organization_name).toBe('Nova Manufacturing (DEMO)');
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toMatch(/@|storage_path|review_comment|validation_comment|motivation/);
    expect(await rpc(db, null, 'sp_public_credential', { code: 'SKP-2026-0000-0000' })).toBeNull();
    expect(await rpc(db, null, 'sp_public_credential', { code: "' or 1=1 --" })).toBeNull();
  });

  it('FLOW 08 · the holder controls publication of the SkillPass and of each credential', async () => {
    const pass = await rpc<Json>(db, null, 'sp_public_skillpass', { slug: 'valeria-nunez-demo' });
    expect(pass.credentials.map((c: Json) => c.code)).toContain(credentialCode);
    await rpc(db, USERS.valeria, 'sp_update_privacy', { skillpass_public: false });
    expect(await rpc(db, null, 'sp_public_skillpass', { slug: 'valeria-nunez-demo' })).toBeNull();
    const own = await rpc<Json>(db, USERS.valeria, 'sp_skillpass_me');
    const credId = own.credentials.find((c: Json) => c.code === credentialCode).id;
    await rpc(db, USERS.valeria, 'sp_set_credential_verification', { credential_id: credId, enabled: false });
    expect(await rpc(db, null, 'sp_public_credential', { code: credentialCode })).toBeNull();
    await rpc(db, USERS.valeria, 'sp_set_credential_verification', { credential_id: credId, enabled: true });
    await rpc(db, USERS.valeria, 'sp_update_privacy', { skillpass_public: true });
    await expectError(rpc(db, USERS.maria, 'sp_set_credential_verification', { credential_id: credId, enabled: false }), /forbidden/);
  });

  it('FLOW 08 · public pages list only evidence the student published and the challenge allows', async () => {
    const pub = await rpc<Json>(db, null, 'sp_public_credential', { code: 'SKP-2026-4A7C-91D2' });
    expect(pub.credential.confidential).toBe(false);
    expect(pub.credential.public_evidence.map((e: Json) => e.title)).toEqual(['Tablero de inventario (captura)']);
    const file = await rpc<Json>(db, null, 'sp_public_evidence_file', { evidence_id: '60000000-0000-4000-8000-000000000005' });
    expect(file.storage_path).toContain('dashboard-inventario.png');
    expect(await rpc(db, null, 'sp_public_evidence_file', { evidence_id: '60000000-0000-4000-8000-000000000006' })).toBeNull();
  });

  it('FLOW 10 · university analytics aggregate real records for their own students only', async () => {
    const before = await rpc<Json>(db, USERS.elena, 'sp_university_dashboard');
    expect(before.stats.completed_projects).toBe(5); // 4 seeded + Valeria's new credential
    expect(Number(before.stats.verified_vath)).toBe(112 + 5);
    expect(before.students.map((s: Json) => s.full_name)).not.toContain('Camila Ortiz');
    const other = await rpc<Json>(db, USERS.luis, 'sp_university_dashboard');
    expect(other.students.map((s: Json) => s.full_name).sort()).toEqual(['Camila Ortiz', 'Ricardo Peña']);
    expect(await rpc<Json>(db, USERS.maria, 'sp_university_dashboard')).toEqual({ organization: null });
  });

  it('revocation is admin-only, final, and removes the credential from public totals', async () => {
    const own = await rpc<Json>(db, USERS.valeria, 'sp_skillpass_me');
    const credId = own.credentials.find((c: Json) => c.code === credentialCode).id;
    await expectError(rpc(db, USERS.laura, 'sp_revoke_credential', { credential_id: credId, reason: 'Intento de empresa.' }), /admin_only/);
    await rpc(db, USERS.admin, 'sp_revoke_credential', { credential_id: credId, reason: 'Prueba automatizada de revocación.' });
    const pub = await rpc<Json>(db, null, 'sp_public_credential', { code: credentialCode });
    expect(pub.verification.status).toBe('revoked');
    const pass = await rpc<Json>(db, null, 'sp_public_skillpass', { slug: 'valeria-nunez-demo' });
    expect(pass.credentials.map((c: Json) => c.code)).not.toContain(credentialCode);
    await expectError(rpc(db, USERS.admin, 'sp_revoke_credential', { credential_id: credId, reason: 'Segunda revocación.' }), /credential_not_active/);
  });
});

describe('row level security isolation', () => {
  it('reviewers of another company cannot read Nova records', async () => {
    const vath = await sql<Row>(db, USERS.hector, "select id from public.vath_entries where challenge_id = $1", [CHALLENGE(1)]);
    const evidence = await sql<Row>(db, USERS.hector, "select id from public.evidence where challenge_id = $1", [CHALLENGE(1)]);
    const applications = await sql<Row>(db, USERS.hector, "select id from public.applications where challenge_id = $1", [CHALLENGE(3)]);
    expect([vath, evidence, applications]).toEqual([[], [], []]);
  });

  it('teammates share the workspace but never each other\'s hours', async () => {
    const hours = await sql<Row>(db, USERS.maria, 'select student_id from public.vath_entries where challenge_id = $1', [CHALLENGE(1)]);
    expect(new Set(hours.map((h) => h.student_id))).toEqual(new Set([USERS.maria]));
    const tasks = await sql<Row>(db, USERS.maria, 'select id from public.tasks where challenge_id = $1', [CHALLENGE(1)]);
    expect(tasks.length).toBeGreaterThan(0);
    const teammateEvidence = await sql<Row>(db, USERS.maria, "select status from public.evidence where student_id = $1", [USERS.diego]);
    expect(teammateEvidence.every((e) => e.status !== 'draft')).toBe(true);
  });

  it('university staff never read evidence content or VATH rows directly', async () => {
    expect(await sql<Row>(db, USERS.elena, 'select id from public.evidence')).toEqual([]);
    expect(await sql<Row>(db, USERS.elena, 'select id from public.vath_entries')).toEqual([]);
    const students = await sql<Row>(db, USERS.elena, "select id from public.profiles where role = 'student'");
    expect(students.length).toBe(6);
  });

  it('a student only sees their own notifications, applications and credentials', async () => {
    const notifications = await sql<Row>(db, USERS.maria, 'select distinct user_id from public.notifications');
    expect(notifications.map((n) => n.user_id)).toEqual([USERS.maria]);
    const apps = await sql<Row>(db, USERS.maria, 'select distinct student_id from public.applications');
    expect(apps.map((a) => a.student_id)).toEqual([USERS.maria]);
    const creds = await sql<Row>(db, USERS.maria, 'select distinct student_id from public.credentials');
    expect(creds.map((c) => c.student_id)).toEqual([USERS.maria]);
  });

  it('Verified Talent lists only opted-in students and only for verified companies', async () => {
    const talent = await rpc<Json>(db, USERS.laura, 'sp_talent');
    const names = talent.items.map((t: Json) => t.full_name);
    expect(names).not.toContain('Jorge Lozano'); // opted out
    expect(names).toContain('María Torres');
    const pending = await rpc<Json>(db, USERS.ruben, 'sp_talent');
    expect(pending.allowed).toBe(false);
    const asStudent = await rpc<Json>(db, USERS.maria, 'sp_talent');
    expect(asStudent.items).toEqual([]);
  });

  it('admin can read across organizations; other roles get nothing from admin RPCs', async () => {
    const overview = await rpc<Json>(db, USERS.admin, 'sp_admin_overview');
    expect(overview.pending_organizations.map((o: Json) => o.name)).toContain('Agroindustrias del Centro (DEMO)');
    expect(await rpc(db, USERS.laura, 'sp_admin_overview')).toBeNull();
    expect(await rpc(db, USERS.laura, 'sp_admin_list', { entity: 'users' })).toBeNull();
    const audit = await rpc<Json>(db, USERS.admin, 'sp_admin_list', { entity: 'audit' });
    expect(audit.total).toBeGreaterThan(10);
  });
});

describe('integrity guards', () => {
  it('credential snapshots and lineage are immutable even for the database owner', async () => {
    await expectError(db.query("update public.credentials set snapshot = '{}'::jsonb where code = 'SKP-2026-4A7C-91D2'"), /credential_immutable/);
    await expectError(db.query("delete from public.credentials where code = 'SKP-2026-4A7C-91D2'"), /credential_immutable/);
  });

  it('decided VATH entries and audit records cannot be rewritten', async () => {
    await expectError(db.query("update public.vath_entries set verified_hours = 8 where id = '61000000-0000-4000-8000-000000000002'"), /vath_immutable/);
    await expectError(db.query('update public.audit_logs set action = action'), /append_only/);
    await expectError(db.query('delete from public.validation_decisions'), /append_only/);
  });

  it('organization verification is controlled by AINDEV admin', async () => {
    await expectError(rpc(db, USERS.ruben, 'sp_admin_set_org_status', { organization_id: ORGS.agroPending, status: 'verified' }), /admin_only/);
    const result = await rpc<Json>(db, USERS.admin, 'sp_admin_set_org_status', { organization_id: ORGS.agroPending, status: 'verified' });
    expect(result.status).toBe('verified');
  });
});

describe('security review regressions (docs/SECURITY.md §6)', () => {
  const signUp = (id: string, email: string, accountType: string, fullName: string) =>
    db.query('insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)',
      [id, email, JSON.stringify({ full_name: fullName, account_type: accountType })]);
  const memberRole = async (org: string, user: string) =>
    (await db.query<Row>('select member_role from public.organization_members where organization_id = $1 and user_id = $2', [org, user])).rows[0]?.member_role ?? null;
  const feed = async (actor: string, challenge: string) =>
    (await sql<{ r: Json[] }>(db, actor, 'select public.sp_activity_feed($1::uuid) as r', [challenge]))[0].r;

  it('H-1 · invitations never change existing members, reveal accounts or override the chosen account type', async () => {
    const manager = '10000000-0000-4000-8000-000000000097';
    await rpc(db, USERS.laura, 'sp_invite_member', { organization_id: ORGS.nova, email: 'gerente.h1@test.invalid', member_role: 'manager' });
    await signUp(manager, 'gerente.h1@test.invalid', 'company', 'Gerente H1');
    expect(await memberRole(ORGS.nova, manager)).toBe('manager');

    // (a) a manager can neither demote the owner through an invitation nor remove them.
    await expectError(rpc(db, manager, 'sp_invite_member', { organization_id: ORGS.nova, email: 'laura.rios@demo.skillpass.invalid', member_role: 'supervisor' }), /already_member/);
    expect(await memberRole(ORGS.nova, USERS.laura)).toBe('owner');
    await expectError(rpc(db, manager, 'sp_remove_member', { organization_id: ORGS.nova, user_id: USERS.laura }), /forbidden/);

    // (b) the same answer for a student, a member of another company and an unknown address; nobody is added.
    for (const email of ['maria.torres@demo.skillpass.invalid', 'hector.aguilar@demo.skillpass.invalid', 'nadie.h1@test.invalid']) {
      expect(await rpc<Json>(db, USERS.laura, 'sp_invite_member', { organization_id: ORGS.nova, email, member_role: 'supervisor' })).toEqual({ status: 'invited' });
    }
    expect(await memberRole(ORGS.nova, USERS.maria)).toBeNull();
    expect(await memberRole(ORGS.nova, USERS.hector)).toBeNull();

    // (c) signing in does not move an established member of another company.
    expect(await rpc<Json>(db, USERS.hector, 'sp_accept_invitations')).toEqual({ accepted: 0 });
    expect(await memberRole(ORGS.nova, USERS.hector)).toBeNull();
    expect(await memberRole(ORGS.bajio, USERS.hector)).toBe('supervisor');

    // (d) a student sign-up stays a student even if someone invited that address beforehand.
    const student = '10000000-0000-4000-8000-000000000096';
    await rpc(db, USERS.laura, 'sp_invite_member', { organization_id: ORGS.nova, email: 'futura.estudiante@test.invalid', member_role: 'supervisor' });
    await signUp(student, 'futura.estudiante@test.invalid', 'student', 'Futura Estudiante');
    const [profile] = (await db.query<Row>('select role from public.profiles where id = $1', [student])).rows;
    expect(profile.role).toBe('student');
    expect(await memberRole(ORGS.nova, student)).toBeNull();
  });

  it('H-1 · removing a manager revokes the invitations they created', async () => {
    const manager = '10000000-0000-4000-8000-000000000097';
    await rpc(db, manager, 'sp_invite_member', { organization_id: ORGS.nova, email: 'alias.h1@test.invalid', member_role: 'manager' });
    await rpc(db, USERS.laura, 'sp_remove_member', { organization_id: ORGS.nova, user_id: manager });
    const [inv] = (await db.query<Row>("select status from public.invitations where email = 'alias.h1@test.invalid'")).rows;
    expect(inv.status).toBe('revoked');
  });

  it('H-1 · only verified organizations invite, and only their invitations attach accounts', async () => {
    const eve = '10000000-0000-4000-8000-000000000094';
    await signUp(eve, 'eve.h1@test.invalid', 'company', 'Eve');
    await rpc(db, eve, 'sp_complete_onboarding', { full_name: 'Eve', organization_name: 'Empresa sin verificar H1' });
    const [{ organization_id: eveOrg }] = (await db.query<Row>('select organization_id from public.organization_members where user_id = $1', [eve])).rows;
    await expectError(rpc(db, eve, 'sp_invite_member', { organization_id: eveOrg, email: 'fundadora.h1@test.invalid', member_role: 'supervisor' }), /organization_not_verified/);

    // Defence in depth: a pending invitation of an organization that is not verified attaches nobody.
    await db.query("insert into public.invitations(organization_id, email, member_role, invited_by) values ($1, 'fundadora.h1@test.invalid', 'supervisor', $2)", [eveOrg, eve]);
    const founder = '10000000-0000-4000-8000-000000000093';
    await signUp(founder, 'fundadora.h1@test.invalid', 'company', 'Fundadora');
    const [profile] = (await db.query<Row>('select role from public.profiles where id = $1', [founder])).rows;
    expect(profile.role).toBe('company');
    expect(await rpc<Json>(db, founder, 'sp_accept_invitations')).toEqual({ accepted: 0 });
    expect(await memberRole(eveOrg as string, founder)).toBeNull();

    await rpc(db, USERS.admin, 'sp_admin_set_org_status', { organization_id: eveOrg, status: 'verified' });
    expect(await rpc<Json>(db, founder, 'sp_accept_invitations')).toEqual({ accepted: 1 });
  });

  it('H-1 · a company account without an organization joins through its invitation on sign-in', async () => {
    const person = '10000000-0000-4000-8000-000000000095';
    await signUp(person, 'sin.org.h1@test.invalid', 'company', 'Sin Organización');
    await rpc(db, USERS.laura, 'sp_invite_member', { organization_id: ORGS.nova, email: 'sin.org.h1@test.invalid', member_role: 'supervisor' });
    expect(await rpc<Json>(db, person, 'sp_accept_invitations')).toEqual({ accepted: 1 });
    expect(await memberRole(ORGS.nova, person)).toBe('supervisor');
  });

  it('H-2 · Skills Match only scores applicants of the reviewer\'s challenge, the student themselves, or for admin', async () => {
    const draft = await rpc<Json>(db, USERS.ruben, 'sp_save_challenge', challengeInput({ organization_id: ORGS.agroPending, supervisor_id: null, title: 'Reto borrador para sondear perfiles' }));
    const score = async (actor: string, student: string, challenge: string) =>
      (await sql<{ r: Json | null }>(db, actor, 'select public.sp_match_score($1::uuid, $2::uuid) as r', [student, challenge]))[0].r;
    expect(await score(USERS.ruben, USERS.maria, draft.id)).toBeNull();
    expect(await score(USERS.ruben, USERS.jorge, draft.id)).toBeNull();
    expect(await score(USERS.laura, USERS.maria, CHALLENGE(1))).toMatchObject({ score: expect.any(Number) });
    expect(await score(USERS.laura, USERS.jorge, CHALLENGE(1))).toBeNull();
    expect(await score(USERS.maria, USERS.maria, CHALLENGE(1))).toMatchObject({ score: expect.any(Number) });
    expect(await score(USERS.maria, USERS.maria, draft.id)).toBeNull();
    expect(await score(USERS.admin, USERS.jorge, draft.id)).toMatchObject({ score: expect.any(Number) });

    // Withdrawing the application ends the reviewer's access to the score.
    const andresApplication = '50000000-0000-4000-8000-000000000005';
    expect(await score(USERS.laura, USERS.andres, CHALLENGE(3))).toMatchObject({ score: expect.any(Number) });
    await rpc(db, USERS.andres, 'sp_withdraw_application', { application_id: andresApplication });
    expect(await score(USERS.laura, USERS.andres, CHALLENGE(3))).toBeNull();
  });

  it('H-3 · confidential credentials hide the validator as well as the company and the challenge', async () => {
    const created = await rpc<Json>(db, USERS.laura, 'sp_save_challenge', challengeInput({ title: 'Reto confidencial de calidad', publication_policy: 'confidential', confidentiality: 'confidential' }));
    await rpc(db, USERS.laura, 'sp_set_challenge_status', { challenge_id: created.id, status: 'recruiting' });
    const application = await rpc<Json>(db, USERS.andres, 'sp_apply', { challenge_id: created.id, motivation: 'Quiero aportar al reto confidencial de calidad.' });
    await rpc(db, USERS.laura, 'sp_decide_application', { application_id: application.id, decision: 'accept' });
    const evidence = await rpc<Json>(db, USERS.andres, 'sp_add_evidence', { challenge_id: created.id, title: 'Minuta de levantamiento', kind: 'link', url: 'https://example.com/minuta' });
    const vath = await rpc<Json>(db, USERS.andres, 'sp_save_vath', { challenge_id: created.id, activity_date: '2026-09-25', activity: 'Levantamiento', description: 'Levantamiento de requerimientos con el equipo de calidad.', hours: 3, evidence_ids: [evidence.id] });
    const request = await rpc<Json>(db, USERS.andres, 'sp_submit_for_validation', { challenge_id: created.id });
    const done = await rpc<Json>(db, USERS.carlos, 'sp_complete_validation', {
      request_id: request.request_id, vath: [{ id: vath.id, decision: 'verify' }], evidence: [{ id: evidence.id, decision: 'approve' }],
      competencies: [{ competency_id: COMP(5), level: 4 }, { competency_id: COMP(20), level: 3 }], issue_credential: true,
    });
    const pub = await rpc<Json>(db, null, 'sp_public_credential', { code: done.credential_code });
    expect(pub.credential.confidential).toBe(true);
    expect(pub.credential).toMatchObject({ challenge_title: null, organization_name: null, supervisor_name: null, supervisor_title: null,
      start_date: null, end_date: null, modality: null });
    expect(JSON.stringify(pub)).not.toMatch(/Nova|Carlos|Mejora Continua|Reto confidencial/);

    // The public summary does not count the validator of a confidential credential.
    const [{ slug }] = (await db.query<Row>('select slug from public.profiles where id = $1', [USERS.andres])).rows;
    await rpc(db, USERS.andres, 'sp_update_privacy', { skillpass_public: true });
    const publicPass = await rpc<Json>(db, null, 'sp_public_skillpass', { slug });
    const confidential = publicPass.credentials.filter((c: Json) => c.confidential).length;
    expect(confidential).toBe(1);
    const [{ n }] = (await db.query<Row>(`select count(distinct issued_by)::int as n from public.credentials
      where student_id = $1 and status = 'active' and verification_enabled and snapshot->>'publication_policy' <> 'confidential'`, [USERS.andres])).rows;
    expect(publicPass.summary.validators).toBe(n);
  });

  it('H-6 · verified companies read talent-pool credentials only through masked output', async () => {
    const [{ code: confidentialCode, challenge_id: confidentialChallenge, request_id: confidentialRequest }] = (await db.query<Row>(
      "select code, challenge_id, request_id from public.credentials where student_id = $1 and snapshot->>'publication_policy' = 'confidential'", [USERS.andres])).rows;

    // Andrés holds the confidential Nova credential issued in H-3. Outside the talent pool, the supervisor
    // who issued it still reads it on the validation pages and the dashboard; another company only sees the
    // credential it issued itself (Bajío's SKP-2026-E05B-3D68).
    await rpc(db, USERS.andres, 'sp_update_privacy', { open_to_opportunities: false });
    expect((await rpc<Json>(db, USERS.carlos, 'sp_validation', { id: confidentialRequest })).request.credential_code).toBe(confidentialCode);
    expect((await rpc<Json>(db, USERS.carlos, 'sp_validation_queue')).completed.find((r: Json) => r.id === confidentialRequest).credential_code).toBe(confidentialCode);
    expect((await rpc<Json>(db, USERS.carlos, 'sp_company_dashboard')).observed_talent.map((t: Json) => t.code)).toContain(confidentialCode);
    const outsidePool = (await sql<{ j: Json }>(db, USERS.mariana, 'select public.sp_visible_credentials_json($1) as j', [USERS.andres]))[0].j;
    expect(outsidePool.map((c: Json) => c.code)).toEqual(['SKP-2026-E05B-3D68']);

    // Andrés opts into the talent pool.
    await rpc(db, USERS.andres, 'sp_update_privacy', { open_to_opportunities: true });
    const [{ n: active }] = (await db.query<Row>("select count(*)::int as n from public.credentials where student_id = $1 and status = 'active'", [USERS.andres])).rows;

    // Mariana (verified Bajío) can no longer read the raw confidential row (snapshot names Nova and its supervisor).
    const raw = await sql<Row>(db, USERS.mariana,
      "select snapshot from public.credentials where student_id = $1 and snapshot->>'publication_policy' = 'confidential'", [USERS.andres]);
    expect(raw).toEqual([]);

    // She still gets the masked credentials and the talent aggregates.
    const profile = await rpc<Json>(db, USERS.mariana, 'sp_talent_profile', { student_id: USERS.andres });
    expect(profile.credentials).toHaveLength(active as number);
    expect(profile.credentials.find((c: Json) => c.confidential)).toMatchObject({ organization_name: null, challenge_title: null, supervisor_name: null });
    expect(JSON.stringify(profile.credentials)).not.toMatch(/Nova|Carlos|Reto confidencial/);
    const listed = (await rpc<Json>(db, USERS.mariana, 'sp_talent')).items.find((t: Json) => t.id === USERS.andres);
    expect(listed.credentials).toBe(active);
    const unverified = '10000000-0000-4000-8000-000000000092';
    await signUp(unverified, 'sin.verificar.h6@test.invalid', 'company', 'Sin Verificar');
    await rpc(db, unverified, 'sp_complete_onboarding', { full_name: 'Sin Verificar', organization_name: 'Empresa sin verificar H6' });
    expect(await rpc<Json>(db, unverified, 'sp_talent')).toEqual({ items: [], allowed: false });

    // sp_talent names a university only once it is verified; the admin also sees pending ones.
    await db.query("update public.organizations set verification_status = 'pending' where id = $1", [ORGS.tecDemo]);
    const university = async (actor: string) => {
      const item = (await rpc<Json>(db, actor, 'sp_talent')).items.find((t: Json) => t.id === USERS.camila);
      expect(item).toBeDefined();
      return item.university;
    };
    expect(await university(USERS.mariana)).toBeNull();
    expect(await university(USERS.admin)).toBe('Instituto Tecnológico Demo');
    await db.query("update public.organizations set verification_status = 'verified' where id = $1", [ORGS.tecDemo]);

    // The challenge filter no longer reveals who completed another company's confidential challenge.
    expect((await rpc<Json>(db, USERS.mariana, 'sp_talent', { challenge_id: confidentialChallenge })).items).toEqual([]);
    for (const reviewer of [USERS.laura, USERS.carlos]) {
      expect((await rpc<Json>(db, reviewer, 'sp_talent', { challenge_id: confidentialChallenge })).items.map((t: Json) => t.id)).toContain(USERS.andres);
    }

    // The holder and the challenge's reviewers (owner, managers, supervisor) keep reading the raw rows.
    for (const reviewer of [USERS.laura, USERS.carlos]) {
      expect(await sql<Row>(db, reviewer, 'select id from public.credentials where challenge_id = $1', [confidentialChallenge])).toHaveLength(1);
    }
    expect(await sql<Row>(db, USERS.andres, "select id from public.credentials where snapshot->>'publication_policy' = 'confidential'")).toHaveLength(1);
  });

  it('H-4 · the activity feed shows teammates and reviewers only what RLS lets them read', async () => {
    await rpc(db, USERS.diego, 'sp_add_evidence', { challenge_id: CHALLENGE(1), title: 'Borrador privado de Diego', kind: 'link', url: 'https://example.com/borrador' });
    const titles = async (actor: string) => (await feed(actor, CHALLENGE(1))).map((x) => x.details?.title);
    expect(await titles(USERS.diego)).toContain('Borrador privado de Diego');
    expect(await titles(USERS.maria)).not.toContain('Borrador privado de Diego');
    expect(await titles(USERS.carlos)).not.toContain('Borrador privado de Diego');

    // A validation outcome is shown to the student it concerns and to reviewers, not to teammates.
    await db.query(`insert into public.audit_logs(actor_id, action, entity_type, entity_id, organization_id, challenge_id, subject_id, after)
      values ($1, 'validation_completed', 'validation_request', gen_random_uuid(), $2, $3, $4, '{"outcome":"rejected","title":"Validación de Diego"}')`,
    [USERS.carlos, ORGS.nova, CHALLENGE(1), USERS.diego]);
    expect(await titles(USERS.diego)).toContain('Validación de Diego');
    expect(await titles(USERS.carlos)).toContain('Validación de Diego');
    expect(await titles(USERS.maria)).not.toContain('Validación de Diego');
  });
});
