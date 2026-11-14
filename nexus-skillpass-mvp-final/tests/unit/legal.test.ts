import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGAL_VERSION, legalEntity, legalVersionDate, type LegalDocument } from '@/lib/legal/config';
import { privacyNotice } from '@/lib/legal/privacy';
import { termsOfService } from '@/lib/legal/terms';

/*
 * Terms and privacy notice (migration 20261113000001). The Supabase client and the RPC layer are fakes; the
 * database rules (who accepted which version, the sign-up trigger) are covered in database.test.ts.
 */
const ENTITY = { name: 'AINDEV Pruebas, S.A. de C.V.', address: 'Calle Falsa 123, Aguascalientes, Ags.', email: 'privacidad@aindev.test', jurisdiction: 'Aguascalientes, Aguascalientes' };
const signUps: { email: string; options: { data: Record<string, unknown> } }[] = [];
const writes: { fn: string; payload: Record<string, unknown> }[] = [];
let me: { mode: 'supabase' | 'demo'; profile: { is_demo: boolean } } | null = { mode: 'supabase', profile: { is_demo: false } };
let legalStatus: { accepted: boolean } | Error | null = { accepted: false };
let locale: 'es' | 'en' = 'es';

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), { digest: `NEXT_REDIRECT;replace;${url};307;` }); },
  unstable_rethrow: (error: unknown) => { if (error instanceof Error && error.message.startsWith('NEXT_REDIRECT')) throw error; },
}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'skillpass.test', 'x-forwarded-proto': 'https' }),
  cookies: async () => ({ set: () => undefined, get: () => undefined, has: () => false, delete: () => undefined }),
}));
vi.mock('@/lib/i18n/server', () => ({ getLocale: async () => locale }));
vi.mock('@/lib/server/rate-limit', () => ({
  LIMITS: new Proxy({}, { get: () => ({ name: 'x', limit: 1, windowSeconds: 1 }) }),
  clientNetwork: async () => 'test', emailIdentity: (e: string) => e, limitAttempts: async () => undefined, recordAttempts: async () => undefined,
}));
vi.mock('@/lib/server/supabase', () => ({
  supabaseServer: async () => ({
    auth: { signUp: async (input: { email: string; options: { data: Record<string, unknown> } }) => { signUps.push(input); return { data: { session: null }, error: null }; } },
  }),
}));
vi.mock('@/lib/server/backend', () => ({
  getMe: async () => me,
  read: async () => { if (legalStatus instanceof Error) throw legalStatus; return legalStatus; },
  write: async (fn: string, payload: Record<string, unknown>) => { writes.push({ fn, payload }); return {}; },
}));

const env = { ...process.env };
const configure = (on = true) => {
  for (const key of ['LEGAL_ENTITY_NAME', 'LEGAL_ENTITY_ADDRESS', 'LEGAL_CONTACT_EMAIL', 'LEGAL_JURISDICTION']) delete process.env[key];
  if (on) Object.assign(process.env, { LEGAL_ENTITY_NAME: ENTITY.name, LEGAL_ENTITY_ADDRESS: ENTITY.address, LEGAL_CONTACT_EMAIL: ENTITY.email, LEGAL_JURISDICTION: ENTITY.jurisdiction });
};
beforeEach(() => {
  signUps.length = 0; writes.length = 0; locale = 'es';
  me = { mode: 'supabase', profile: { is_demo: false } }; legalStatus = { accepted: false };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  configure();
  vi.resetModules();
});
afterEach(() => { process.env = { ...env }; });

const form = (values: Record<string, string>) => { const fd = new FormData(); for (const [k, v] of Object.entries(values)) fd.set(k, v); return fd; };
const account = { full_name: 'Ana Pruebas', email: 'ana@example.com', password: 'una-contraseña-larga', account_type: 'student' };

describe('legal configuration', () => {
  it('is live only with the four values and a usable contact address', () => {
    expect(legalEntity()).toEqual(ENTITY);
    process.env.LEGAL_ENTITY_NAME = `  ${ENTITY.name}\n `;
    process.env.LEGAL_CONTACT_EMAIL = 'Privacidad@AINDEV.test';
    expect(legalEntity()).toEqual(ENTITY);
    for (const key of ['LEGAL_ENTITY_NAME', 'LEGAL_ENTITY_ADDRESS', 'LEGAL_CONTACT_EMAIL', 'LEGAL_JURISDICTION']) {
      configure();
      process.env[key] = '  ';
      expect(legalEntity(), key).toBeNull();
    }
    configure();
    process.env.LEGAL_CONTACT_EMAIL = 'sin-arroba';
    expect(legalEntity()).toBeNull();
    configure(false);
    expect(legalEntity()).toBeNull();
  });

  it('versions the texts with a real date that the database accepts (2026 or later, not in the future)', () => {
    expect(LEGAL_VERSION).toMatch(/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
    const date = new Date(`${LEGAL_VERSION}T00:00:00Z`);
    expect(date.toISOString().slice(0, 10)).toBe(LEGAL_VERSION);
    expect(date.getTime()).toBeGreaterThanOrEqual(Date.UTC(2026, 0, 1));
    expect(date.getTime()).toBeLessThanOrEqual(Date.now());
    expect(legalVersionDate('es', '2026-11-13')).toBe('13 de noviembre de 2026');
    expect(legalVersionDate('en', '2026-11-13')).toBe('November 13, 2026');
  });
});

describe('legal texts', () => {
  const text = (doc: LegalDocument) => [doc.title, doc.summary, ...doc.sections.flatMap((s) => [s.title, ...s.blocks.flatMap((b) => (typeof b === 'string' ? [b] : b.list))])];

  it.each([['privacy notice', privacyNotice, 12], ['terms', termsOfService, 14]] as const)('%s: same sections in both languages, complete and naming the entity', (_name, build, count) => {
    const es = build('es', ENTITY); const en = build('en', ENTITY);
    expect(es.sections.map((s) => s.id)).toEqual(en.sections.map((s) => s.id));
    expect(es.sections).toHaveLength(count);
    expect(new Set(es.sections.map((s) => s.id)).size).toBe(count);
    expect(es.sections.map((s) => s.blocks.map((b) => (typeof b === 'string' ? 'p' : b.list.length)))).toEqual(en.sections.map((s) => s.blocks.map((b) => (typeof b === 'string' ? 'p' : b.list.length))));
    for (const doc of [es, en]) {
      const all = text(doc);
      expect(all.every((line) => line.trim().length > 3)).toBe(true);
      expect(all.join('\n')).not.toMatch(/undefined|\[object|\{\w+\}|TODO/);
      expect(all.join('\n')).toContain(ENTITY.name);
      expect(all.join('\n')).toContain(ENTITY.address);
      expect(all.join('\n')).toContain(ENTITY.email);
    }
    expect(es.sections.map((s) => s.title)).toEqual(es.sections.map((s, i) => expect.stringMatching(new RegExp(`^${i + 1}\\. `))));
  });

  it('names the courts only in the terms, and the authority only in the privacy notice', () => {
    expect(JSON.stringify(termsOfService('es', ENTITY))).toContain(ENTITY.jurisdiction);
    expect(JSON.stringify(privacyNotice('es', ENTITY))).not.toContain(ENTITY.jurisdiction);
    expect(JSON.stringify(privacyNotice('es', ENTITY))).toContain('Secretaría Anticorrupción y Buen Gobierno');
  });
});

describe('who is asked to accept', () => {
  const pending = async () => (await import('@/lib/server/legal')).legalPending();

  it('asks real accounts that have not accepted the current version', async () => {
    expect(await pending()).toBe(true);
    legalStatus = { accepted: true }; vi.resetModules();
    expect(await pending()).toBe(false);
  });

  it('never asks DEMO personas, signed-out visitors, deployments without the texts or databases without the migration', async () => {
    me = { mode: 'demo', profile: { is_demo: true } }; expect(await pending()).toBe(false);
    vi.resetModules(); me = { mode: 'supabase', profile: { is_demo: true } }; expect(await pending()).toBe(false);
    vi.resetModules(); me = null; expect(await pending()).toBe(false);
    vi.resetModules(); me = { mode: 'supabase', profile: { is_demo: false } }; configure(false); expect(await pending()).toBe(false);
    vi.resetModules(); configure(); legalStatus = new Error('function public.sp_legal_status(jsonb) does not exist'); expect(await pending()).toBe(false);
    vi.resetModules(); legalStatus = null; expect(await pending()).toBe(false);
  });
});

describe('sign-up', () => {
  it('needs the acceptance and sends its version and language with the account', async () => {
    const { signup } = await import('@/actions/auth');
    expect(await signup({ ok: false }, form(account))).toMatchObject({ ok: false, error: 'legal_required', field: 'legal' });
    expect(signUps).toEqual([]);
    locale = 'en';
    await expect(signup({ ok: false }, form({ ...account, legal: 'on' }))).rejects.toThrow('NEXT_REDIRECT:/signup/check-email');
    expect(signUps).toHaveLength(1);
    expect(signUps[0].options.data).toEqual({ full_name: account.full_name, account_type: 'student', locale: 'en', legal_version: LEGAL_VERSION, legal_locale: 'en' });
  });

  it('works as before where the texts are not live', async () => {
    configure(false);
    const { signup } = await import('@/actions/auth');
    await expect(signup({ ok: false }, form(account))).rejects.toThrow('NEXT_REDIRECT:/signup/check-email');
    expect(signUps[0].options.data).toEqual({ full_name: account.full_name, account_type: 'student', locale: 'es' });
  });
});

describe('accepting later', () => {
  it('records the current version for the signed-in user and goes on to a safe path', async () => {
    const { acceptLegal } = await import('@/actions/legal');
    expect(await acceptLegal({ ok: false }, form({ next: '/dashboard' }))).toMatchObject({ ok: false, error: 'legal_required' });
    expect(writes).toEqual([]);
    await expect(acceptLegal({ ok: false }, form({ legal: 'on', next: '/onboarding' }))).rejects.toThrow('NEXT_REDIRECT:/onboarding');
    expect(writes).toEqual([{ fn: 'sp_accept_legal', payload: { version: LEGAL_VERSION, locale: 'es' } }]);
    await expect(acceptLegal({ ok: false }, form({ legal: 'on', next: '//evil.example' }))).rejects.toThrow('NEXT_REDIRECT:/dashboard');
  });

  it('does nothing where the texts are not live', async () => {
    configure(false);
    const { acceptLegal } = await import('@/actions/legal');
    expect((await acceptLegal({ ok: false }, form({ legal: 'on' }))).ok).toBe(false);
    expect(writes).toEqual([]);
  });
});
