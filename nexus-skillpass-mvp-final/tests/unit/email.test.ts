import { execFileSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dictionaries } from '@/lib/i18n';
import { noticeText, renderEmail, type EmailBatch } from '@/lib/email/render';

/*
 * E-mail notices (migration 20261114000001): templates, the dispatcher and the preferences. The provider
 * (fetch), the Supabase client and the RPC layer are fakes; the queue itself is covered in database.test.ts.
 */
const SECRET = 'email-gate-secret-for-unit-tests-0123456789abcdef';
const KEY = 're_test_0123456789';
const gate = createHmac('sha256', SECRET).update('skillpass-email-gate').digest('hex');
const ORIGIN = 'https://skillpass.test';

type Rpc = { fn: string; p: Record<string, unknown> };
let rpcCalls: Rpc[] = [];
let queue: EmailBatch[] = [];
let claimError: string | null = null;
let doneError: string | null = null;
let requests: { url: string; init: RequestInit; body: Record<string, unknown> }[] = [];
let provider: (n: number) => Response | Promise<Response> = () => new Response('{"id":"x"}', { status: 200 });
let me: { mode: 'supabase' | 'demo'; profile: { is_demo: boolean } } | null = { mode: 'supabase', profile: { is_demo: false } };
let settingsAnswer: unknown = { enabled: true, locale: null };
const writes: { fn: string; payload: Record<string, unknown> }[] = [];
const scheduled: (() => unknown)[] = [];
let afterThrows = false;

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('next/navigation', () => ({ redirect: () => undefined, unstable_rethrow: () => undefined }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }) }));
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (task: () => unknown) => { if (afterThrows) throw new Error('`after` was called outside a request scope'); scheduled.push(task); },
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: (fn: string, args: { p: Record<string, unknown> }) => ({
      abortSignal: async (signal: AbortSignal) => {
        expect(signal).toBeInstanceOf(AbortSignal);
        rpcCalls.push({ fn, p: args.p });
        if (fn === 'sp_email_claim') return claimError ? { data: null, error: { message: claimError } } : { data: queue.splice(0, Number(args.p.limit)), error: null };
        if (fn === 'sp_email_done') return doneError ? { data: null, error: { message: doneError } } : { data: { sent: 0, failed: 0 }, error: null };
        return { data: null, error: null }; // sp_rate_limit and anything else: not this suite's subject
      },
    }),
  }),
}));
vi.mock('@/lib/server/backend', () => ({
  getMe: async () => me,
  read: async (fn: string) => { if (settingsAnswer instanceof Error) throw settingsAnswer; expect(fn).toBe('sp_email_settings'); return settingsAnswer; },
  write: async (fn: string, payload: Record<string, unknown>) => { writes.push({ fn, payload }); return {}; },
}));

const env = { ...process.env };
beforeEach(() => {
  rpcCalls = []; queue = []; claimError = null; doneError = null; requests = []; writes.length = 0; scheduled.length = 0; afterThrows = false;
  provider = () => new Response('{"id":"x"}', { status: 200 });
  me = { mode: 'supabase', profile: { is_demo: false } }; settingsAnswer = { enabled: true, locale: null };
  for (const key of ['RESEND_API_URL', 'EMAIL_FROM', 'EMAIL_COOLDOWN_SECONDS', 'CRON_SECRET', 'RATE_LIMIT_SECRET']) delete process.env[key];
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key', NEXT_PUBLIC_APP_URL: `${ORIGIN}/`,
    RESEND_API_KEY: KEY, EMAIL_GATE_SECRET: SECRET,
  });
  vi.resetModules();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    requests.push({ url: String(url), init, body: JSON.parse(String(init.body)) });
    return provider(requests.length);
  });
});
afterEach(() => { process.env = { ...env }; vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

const item = (kind: string, params: Record<string, unknown>, link = '/notifications', n = 1) => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, kind, params, link, created_at: '2026-11-14T12:00:00Z' });
const batch = (over: Partial<EmailBatch> = {}): EmailBatch => ({
  batch_id: '11111111-1111-4111-8111-111111111111', to: 'ana@example.com', name: 'Ana María Pruebas', locale: 'es',
  items: [item('challenge_assigned', { challenge: 'Línea 3 sin paros' }, '/workspace/abc')], ...over,
});
const headers = (init: RequestInit) => init.headers as Record<string, string>;

describe('templates', () => {
  it('one notice: its sentence is the subject and the button opens it in the platform', () => {
    const mail = renderEmail(batch(), `${ORIGIN}/`);
    expect(mail.subject).toBe('Fuiste asignado al reto «Línea 3 sin paros»');
    expect(mail.text).toContain('Hola, Ana:');
    expect(mail.text).toContain('Fuiste asignado al reto «Línea 3 sin paros».');
    expect(mail.text).toContain(`Abrir en SkillPass: ${ORIGIN}/workspace/abc`);
    expect(mail.text).toContain(dictionaries.es.email.footer);
    expect(mail.html).toContain(`href="${ORIGIN}/workspace/abc"`);
    expect(mail.html).toContain('<html lang="es">');
    expect(mail.html).toContain('Fuiste asignado al reto «Línea 3 sin paros».');
    expect(mail.text).not.toContain('/legal/privacy');
    expect(mail.html).not.toContain('/legal/privacy');
  });

  it('links to the privacy notice where the deployment publishes it', () => {
    const mail = renderEmail(batch({ locale: 'en' }), ORIGIN, { privacy: true });
    expect(mail.text.trimEnd().split('\n').pop()).toBe(`Privacy notice: ${ORIGIN}/legal/privacy`);
    expect(mail.html).toContain(`<a href="${ORIGIN}/legal/privacy"`);
  });

  it('several notices become one message that lists them, in the reader\'s language', () => {
    const mail = renderEmail(batch({ locale: 'en', name: null, items: [
      item('validation_completed', { challenge: 'Line 3', outcome: 'partially_approved' }, '/validations', 1),
      item('organization_status', { organization: 'ACME', status: 'verified' }, '/organization', 2),
      item('credential_issued', { code: 'SKP-2026-AAAA-BBBB', challenge: 'Line 3' }, '/my-skillpass', 3),
    ] }), ORIGIN);
    expect(mail.subject).toBe('You have 3 new notices in SkillPass');
    expect(mail.text).toContain('Hello,');
    expect(mail.text).toContain(`- Your validation in “Line 3” finished: ${dictionaries.en.status.outcome.partially_approved}.`);
    expect(mail.text).toContain(`${dictionaries.en.status.organization.verified}`);
    expect(mail.text).toContain(`See my notifications: ${ORIGIN}/notifications`);
    expect(mail.html.match(/<li /g)).toHaveLength(3);
    expect(mail.html).toContain('<html lang="en">');
  });

  it('invitations explain who invites, to what and how to join', () => {
    const invitation = item('invitation', { organization: 'Universidad Demo', organization_id: 'x', member_role: 'supervisor', invited_by: 'Luis Pérez' }, '/signup?type=university');
    const mail = renderEmail(batch({ name: null, to: 'nueva@example.com', items: [invitation] }), ORIGIN);
    expect(mail.subject).toBe('Invitación a Universidad Demo en SkillPass');
    expect(mail.text).toContain('Luis Pérez te invitó a unirte a Universidad Demo en SkillPass como supervisor.');
    expect(mail.text).toContain(dictionaries.es.email.invitationHow);
    expect(mail.text).toContain(`Crear mi cuenta: ${ORIGIN}/signup?type=university`);
    expect(mail.text).toContain('alguien de Universidad Demo escribió tu dirección');
    expect(mail.text).not.toContain(dictionaries.es.email.footer);
    expect(noticeText('en', { kind: 'invitation', params: { organization: 'ACME', member_role: 'unknown' } })).toBe('You were invited to join ACME in SkillPass as team member.');
  });

  it('escapes what users wrote and never links outside the platform', () => {
    const evil = '<img src=x onerror=alert(1)>"\'&';
    const mail = renderEmail(batch({ name: `${evil} X`, items: [item('application_received', { student: evil, challenge: 'Reto\r\nBcc: otro@example.com' }, '//evil.example/x')] }), ORIGIN);
    expect(mail.html).not.toContain('<img');
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;');
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.subject).toContain('Reto Bcc: otro@example.com');
    expect(mail.html).toContain(`href="${ORIGIN}/notifications"`);
    expect(mail.html).not.toContain('evil.example');
    for (const link of ['https://evil.example', 'javascript:alert(1)', '/\\evil.example', '']) {
      expect(renderEmail(batch({ items: [item('challenge_assigned', { challenge: 'X' }, link)] }), ORIGIN).text).toContain(`: ${ORIGIN}/notifications`);
    }
  });

  it('copes with unknown kinds, missing or odd parameters and very long lists', () => {
    expect(noticeText('es', { kind: 'something_new', params: {} })).toBe(dictionaries.es.notifications.kinds.fallback);
    expect(noticeText('es', { kind: 'application_received', params: { challenge: { nested: true }, student: null } })).toBe('… aplicó a «…».');
    expect(noticeText('es', { kind: 'credential_issued', params: { code: 'SKP-1', challenge: 'x'.repeat(500) } }).length).toBeLessThan(300);
    const many = renderEmail(batch({ items: Array.from({ length: 30 }, (_, i) => item('challenge_assigned', { challenge: `Reto ${i}` }, '/x', i)) }), ORIGIN);
    expect(many.html.match(/<li /g)).toHaveLength(20);
    expect(many.subject).toBe('Tienes 20 avisos nuevos en SkillPass');
    expect(renderEmail(batch({ locale: 'fr' as 'es' }), ORIGIN).html).toContain('<html lang="es">');
  });

  it('has a sentence in both languages for every kind the database queues', () => {
    const queued = ['application_received', 'application_shortlisted', 'application_rejected', 'challenge_assigned', 'validation_requested', 'validation_completed',
      'credential_issued', 'credential_revoked', 'challenge_invitation', 'organization_membership', 'organization_status', 'assignment_ended', 'university_request',
      'university_membership_approved', 'university_membership_rejected', 'university_membership_removed'];
    const migration = readFileSync('supabase/migrations/20261114000001_email_outbox.sql', 'utf8');
    for (const kind of queued) {
      expect(migration, kind).toContain(`'${kind}'`);
      for (const locale of ['es', 'en'] as const) expect((dictionaries[locale].notifications.kinds as Record<string, string>)[kind], `${locale} ${kind}`).toBeTruthy();
    }
    expect(Object.keys(dictionaries.es.email)).toEqual(Object.keys(dictionaries.en.email));
  });
});

describe('configuration', () => {
  it('needs the provider key and a long gate secret; the gate is derived, never the secret itself', async () => {
    const { emailConfig, emailGate } = await import('@/lib/server/email');
    expect(emailConfig()).toEqual({ apiKey: KEY, secret: SECRET, from: 'SkillPass <noreply@aindev.com.mx>', apiUrl: 'https://api.resend.com' });
    expect(emailGate(SECRET)).toBe(gate);
    process.env.EMAIL_FROM = ' Avisos <avisos@example.org> '; process.env.RESEND_API_URL = 'http://127.0.0.1:9999/';
    expect(emailConfig()).toMatchObject({ from: 'Avisos <avisos@example.org>', apiUrl: 'http://127.0.0.1:9999' });
    process.env.EMAIL_GATE_SECRET = 'short'; expect(emailConfig()).toBeNull();
    process.env.EMAIL_GATE_SECRET = SECRET; delete process.env.RESEND_API_KEY; expect(emailConfig()).toBeNull();
    process.env.RESEND_API_KEY = '  '; expect(emailConfig()).toBeNull();
  });

  it('operator script prints only the hash the database keeps; refuses a short secret', () => {
    const out = execFileSync('node', ['scripts/email-gate.mjs'], { env: { ...process.env, EMAIL_GATE_SECRET: SECRET }, encoding: 'utf8' });
    expect(out).toContain(`('email_gate', '"${createHash('sha256').update(gate).digest('hex')}"'::jsonb)`);
    expect(out).not.toContain(SECRET);
    expect(out).not.toContain(gate);
    expect(() => execFileSync('node', ['scripts/email-gate.mjs'], { env: { ...process.env, EMAIL_GATE_SECRET: 'short' }, stdio: 'pipe' })).toThrow();
  });
});

describe('dispatcher', () => {
  const load = async () => import('@/lib/server/email');

  it('claims the queue with the gate, sends each batch once through the provider and reports back', async () => {
    queue = [batch(), batch({ batch_id: '22222222-2222-4222-8222-222222222222', to: 'luis@example.com', locale: 'en', name: 'Luis' })];
    const { dispatchEmails } = await load();
    expect(await dispatchEmails()).toEqual({ sent: 2, failed: 0 });
    expect(rpcCalls.map((c) => c.fn)).toEqual(['sp_email_claim', 'sp_email_done']);
    expect(rpcCalls[0].p).toEqual({ gate, limit: 5, cooldown: 900 });
    expect(JSON.stringify(rpcCalls)).not.toContain(SECRET);
    expect(requests.map((r) => r.url)).toEqual(['https://api.resend.com/emails', 'https://api.resend.com/emails']);
    expect(headers(requests[0].init)).toMatchObject({ authorization: `Bearer ${KEY}`, 'idempotency-key': '11111111-1111-4111-8111-111111111111', 'content-type': 'application/json' });
    expect(requests[0].body).toMatchObject({ from: 'SkillPass <noreply@aindev.com.mx>', to: ['ana@example.com'], subject: 'Fuiste asignado al reto «Línea 3 sin paros»' });
    expect(String(requests[0].body.html)).toContain(`${ORIGIN}/workspace/abc`);
    expect(String(requests[0].body.text)).toContain('Hola, Ana:');
    expect(String(requests[0].body.text)).not.toContain('/legal/privacy');
    expect(requests[1].body).toMatchObject({ to: ['luis@example.com'], subject: 'You were assigned to “Línea 3 sin paros”' });
    expect(rpcCalls[1].p).toEqual({ gate, results: [{ batch_id: '11111111-1111-4111-8111-111111111111', ok: true }, { batch_id: '22222222-2222-4222-8222-222222222222', ok: true }] });
  });

  it('adds the privacy notice link once the legal texts are live', async () => {
    Object.assign(process.env, { LEGAL_ENTITY_NAME: 'AINDEV Pruebas, S.A. de C.V.', LEGAL_ENTITY_ADDRESS: 'Calle Falsa 123', LEGAL_CONTACT_EMAIL: 'privacidad@aindev.test', LEGAL_JURISDICTION: 'Aguascalientes' });
    queue = [batch()];
    const { dispatchEmails } = await load();
    await dispatchEmails();
    expect(String(requests[0].body.text)).toContain(`Aviso de privacidad: ${ORIGIN}/legal/privacy`);
  });

  it('gives a refused or unreachable message back to the queue with the reason', async () => {
    queue = [batch(), batch({ batch_id: '22222222-2222-4222-8222-222222222222', to: 'luis@example.com' })];
    provider = (n) => { if (n === 1) return new Response('{"message":"rate limited"}', { status: 429 }); throw new Error('connect ECONNREFUSED'); };
    const { dispatchEmails } = await load();
    expect(await dispatchEmails(2)).toEqual({ sent: 0, failed: 2 });
    expect(rpcCalls[1].p.results).toEqual([
      { batch_id: '11111111-1111-4111-8111-111111111111', ok: false, error: 'HTTP 429' },
      { batch_id: '22222222-2222-4222-8222-222222222222', ok: false, error: 'connect ECONNREFUSED' },
    ]);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(KEY);
  });

  it('with nothing to send it only asks once; the cooldown and limit can be tuned', async () => {
    process.env.EMAIL_COOLDOWN_SECONDS = '60';
    const { dispatchEmails } = await load();
    expect(await dispatchEmails(3)).toEqual({ sent: 0, failed: 0 });
    expect(rpcCalls).toEqual([{ fn: 'sp_email_claim', p: { gate, limit: 3, cooldown: 60 } }]);
    expect(requests).toEqual([]);
    process.env.EMAIL_COOLDOWN_SECONDS = 'abc'; await dispatchEmails();
    process.env.EMAIL_COOLDOWN_SECONDS = '999999999'; await dispatchEmails();
    expect(rpcCalls.slice(1).map((c) => c.p.cooldown)).toEqual([0, 86400]);
  });

  it('does nothing without configuration', async () => {
    delete process.env.RESEND_API_KEY;
    queue = [batch()];
    const { dispatchEmails, scheduleEmailDispatch } = await load();
    expect(await dispatchEmails()).toBeNull();
    scheduleEmailDispatch();
    process.env.RESEND_API_KEY = KEY; delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(await dispatchEmails()).toBeNull();
    scheduleEmailDispatch();
    expect(rpcCalls).toEqual([]); expect(requests).toEqual([]); expect(scheduled).toEqual([]);
  });

  it('where the database has no queue (or refuses the gate) it stops asking for a minute and says so once', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    claimError = 'Could not find the function public.sp_email_claim(p) in the schema cache';
    queue = [batch()];
    const { dispatchEmails } = await load();
    expect(await dispatchEmails()).toBeNull();
    expect(await dispatchEmails()).toBeNull();
    expect(rpcCalls).toHaveLength(1);
    expect(console.error).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 61_000);
    claimError = null;
    expect(await dispatchEmails()).toEqual({ sent: 1, failed: 0 });
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('when the report cannot be saved the messages are not resent by this instance; the provider dedupes the retry by batch', async () => {
    doneError = 'timeout';
    queue = [batch()];
    const { dispatchEmails } = await load();
    expect(await dispatchEmails()).toBeNull();
    expect(requests).toHaveLength(1);
    expect(await dispatchEmails()).toBeNull();
    expect(requests).toHaveLength(1);
  });

  it('never runs twice at once in the same instance', async () => {
    queue = [batch()];
    let release: () => void = () => undefined;
    provider = () => new Promise<Response>((resolve) => { release = () => resolve(new Response('{}', { status: 200 })); });
    const { dispatchEmails } = await load();
    const first = dispatchEmails();
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(await dispatchEmails()).toBeNull();
    release();
    expect(await first).toEqual({ sent: 1, failed: 0 });
    expect(rpcCalls.filter((c) => c.fn === 'sp_email_claim')).toHaveLength(1);
  });
});

describe('after a successful action', () => {
  it('schedules a dispatch after the response, and only for actions that succeeded', async () => {
    const { runAction } = await import('@/lib/server/action');
    queue = [batch()];
    expect(await runAction(async () => ({ message: 'done' }))).toMatchObject({ ok: true, message: 'done' });
    expect(scheduled).toHaveLength(1);
    expect(requests).toEqual([]); // nothing is sent before the response
    await scheduled[0]();
    expect(requests).toHaveLength(1);
    const { AppError } = await import('@/lib/server/errors');
    expect(await runAction(async () => { throw new AppError('forbidden', 403); })).toMatchObject({ ok: false, error: 'forbidden' });
    expect(scheduled).toHaveLength(1);
  });

  it('a failing dispatch never surfaces, and outside a request the action still succeeds', async () => {
    const { runAction } = await import('@/lib/server/action');
    claimError = 'boom';
    await runAction(async () => undefined);
    await expect(scheduled[0]()).resolves.toBeUndefined();
    afterThrows = true;
    expect(await runAction(async () => undefined)).toMatchObject({ ok: true });
  });
});

describe('preferences', () => {
  const form = (values: Record<string, string>) => { const fd = new FormData(); for (const [k, v] of Object.entries(values)) fd.set(k, v); return fd; };

  it('are offered to real accounts where e-mail is set up and the database has the queue', async () => {
    const settings = async () => { vi.resetModules(); return (await import('@/lib/server/email')).emailSettings(); };
    expect(await settings()).toEqual({ enabled: true, locale: null });
    settingsAnswer = { enabled: false, locale: 'en' }; expect(await settings()).toEqual({ enabled: false, locale: 'en' });
    settingsAnswer = { enabled: true, locale: 'fr' }; expect(await settings()).toEqual({ enabled: true, locale: null });
    settingsAnswer = new Error('function public.sp_email_settings(jsonb) does not exist'); expect(await settings()).toBeNull();
    settingsAnswer = null; expect(await settings()).toBeNull();
    settingsAnswer = { enabled: true, locale: null };
    me = { mode: 'demo', profile: { is_demo: true } }; expect(await settings()).toBeNull();
    me = { mode: 'supabase', profile: { is_demo: true } }; expect(await settings()).toBeNull();
    me = null; expect(await settings()).toBeNull();
    me = { mode: 'supabase', profile: { is_demo: false } }; delete process.env.RESEND_API_KEY; expect(await settings()).toBeNull();
  });

  it('saves on/off and the language; an unchecked box turns e-mails off', async () => {
    const { setEmailSettings } = await import('@/actions/email');
    expect(await setEmailSettings({ ok: false }, form({ enabled: 'on', locale: 'en' }))).toMatchObject({ ok: true });
    expect(await setEmailSettings({ ok: false }, form({ locale: '' }))).toMatchObject({ ok: true });
    expect(writes).toEqual([
      { fn: 'sp_set_email_settings', payload: { enabled: true, locale: 'en' } },
      { fn: 'sp_set_email_settings', payload: { enabled: false, locale: null } },
    ]);
    expect(await setEmailSettings({ ok: false }, form({ enabled: 'on', locale: 'fr' }))).toMatchObject({ ok: false, error: 'invalid_field', field: 'locale' });
    expect(writes).toHaveLength(2);
  });
});

describe('daily safety net', () => {
  const call = async (authorization?: string) => {
    const { GET } = await import('@/app/api/cron/email/route');
    const { NextRequest } = await import('next/server');
    return GET(new NextRequest('https://skillpass.test/api/cron/email', { headers: authorization ? { authorization } : {} }));
  };

  it('sends what is due and says how much, without caching', async () => {
    queue = [batch()];
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ configured: true, sent: 1, failed: 0 });
    // It asked again after a full round and stopped when nothing was left.
    expect(rpcCalls.filter((c) => c.fn === 'sp_email_claim').map((c) => c.p.limit)).toEqual([10, 10]);
  });

  it('stops at the first round with a refusal, and says "skipped" when the queue cannot be reached', async () => {
    queue = [batch(), batch({ batch_id: '22222222-2222-4222-8222-222222222222', to: 'luis@example.com' })];
    provider = (n) => new Response('{}', { status: n === 1 ? 200 : 500 });
    expect(await (await call()).json()).toEqual({ configured: true, sent: 1, failed: 1 });
    expect(rpcCalls.filter((c) => c.fn === 'sp_email_claim')).toHaveLength(1);
    vi.resetModules();
    claimError = 'sp:email_unavailable';
    expect(await (await call()).json()).toEqual({ configured: true, skipped: true });
  });

  it('with CRON_SECRET only the scheduler may call it', async () => {
    process.env.CRON_SECRET = 'cron-secret-0123456789';
    queue = [batch()];
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong-secret-0123456789')).status).toBe(401);
    expect((await call('Bearer cron-secret-012345678')).status).toBe(401);
    expect((await call('Bearer cron-secret-012345678\u00e9')).status).toBe(401);
    expect(requests).toEqual([]);
    expect((await call('Bearer cron-secret-0123456789')).status).toBe(200);
    expect(requests).toHaveLength(1);
    // The scheduler is not rate limited: the secret already says who is calling.
    for (let i = 0; i < 6; i++) expect((await call('Bearer cron-secret-0123456789')).status).toBe(200);
  });

  it('reports "not configured" instead of failing where e-mail is off', async () => {
    delete process.env.EMAIL_GATE_SECRET;
    const res = await call();
    expect(await res.json()).toEqual({ configured: false });
    expect(rpcCalls).toEqual([]);
  });

  it('without CRON_SECRET the route is open, so it answers 429 when called more than a few times a minute', async () => {
    for (let i = 0; i < 4; i++) expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(429);
  });
});
