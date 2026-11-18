import { gunzipSync } from 'node:zlib';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { privateKeyFromSeed, rawPublicKey, verifyProof } from '@/lib/credentials/data-integrity';
import { secretKeyMultibase } from '@/lib/credentials/multikey';
import type { OwnCredential } from '@/lib/types';

/*
 * Open Badges routes: the DID document, the status lists and the holder's download. The session, the RPC layer
 * and the attempt limits are fakes; the credential format itself is covered in open-badges.test.ts.
 */
const SEED = new Uint8Array(32).map((_, i) => 200 - i);
const KEY = secretKeyMultibase(SEED);
const PUBLIC = rawPublicKey(privateKeyFromSeed(SEED));
const CODE = 'SKP-2026-4A7C-91D2';

const CREDENTIAL: OwnCredential = {
  id: '80000000-0000-4000-8000-000000000001', code: CODE, status: 'active', issued_at: '2026-08-30T15:04:05Z', revoked_at: null, is_demo: false,
  confidential: false, challenge_title: 'Reducción de paros en Línea 3', organization_name: 'Aceros del Centro', industry: 'manufacturing', modality: 'hybrid',
  start_date: '2026-06-01', end_date: '2026-08-15', verified_hours: 80,
  competencies: [{ competency_id: 'c1', slug: 'data-analysis', name_es: 'Análisis de datos', name_en: 'Data Analysis', category: 'technical', level: 4 }],
  supervisor_name: 'Carlos Méndez', supervisor_title: 'Gerente', evidence_approved: 6, issuer: 'SkillPass by AINDEV NEXUS', public_evidence: [],
  verification_enabled: true, challenge_id: '40000000-0000-4000-8000-000000000002', real_challenge_title: 'Reducción de paros en Línea 3',
  real_organization_name: 'Aceros del Centro', publication_policy: 'public_allowed',
};

let session: { mode: 'supabase' | 'demo'; userId: string; email: string | null } | null;
let me: { mode: 'supabase' | 'demo'; demoId: string | null; profile: { role: string; full_name: string } } | null;
let credentials: OwnCredential[];
let publicAnswer: unknown;
let limited = false;
const reads: { fn: string; payload: unknown }[] = [];
const publicReads: { fn: string; payload: unknown; demoId: unknown }[] = [];

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'skillpass.test', 'x-forwarded-proto': 'https' }),
  cookies: async () => ({ get: () => undefined, has: () => false, set: () => undefined, delete: () => undefined }),
}));
vi.mock('@/lib/i18n/server', () => ({ getLocale: async () => 'es' }));
vi.mock('@/lib/server/rate-limit', () => ({
  LIMITS: new Proxy({}, { get: (_t, name) => ({ name: String(name), limit: 1, windowSeconds: 1 }) }),
  limitAttempts: async () => { if (limited) throw new Error('rate_limited'); },
}));
vi.mock('@/lib/server/backend', () => ({
  getSession: async () => session,
  getMe: async () => me,
  read: async (fn: string, payload: unknown) => {
    reads.push({ fn, payload });
    if (fn === 'sp_skillpass_me') return { credentials };
    if (fn === 'sp_challenge') return { organization: { id: '20000000-0000-4000-8000-000000000001' } };
    throw new Error(`unexpected ${fn}`);
  },
  publicRead: async (fn: string, payload: unknown, demoId: unknown) => { publicReads.push({ fn, payload, demoId }); return publicAnswer; },
}));

const env = { ...process.env };
beforeEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.CREDENTIAL_PREVIOUS_KEYS;
  process.env.CREDENTIAL_SIGNING_KEY = KEY;
  session = { mode: 'supabase', userId: 'u1', email: 'Maria.Torres@Example.com' };
  me = { mode: 'supabase', demoId: null, profile: { role: 'student', full_name: 'María Torres' } };
  credentials = [CREDENTIAL];
  publicAnswer = { credential: { code: CODE }, verification: { status: 'valid' } };
  limited = false;
  reads.length = 0; publicReads.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { process.env = { ...env }; vi.restoreAllMocks(); });

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });

describe('DID document', () => {
  it('publishes the issuer keys, or nothing without a key', async () => {
    const { GET } = await import('@/app/.well-known/did.json/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const doc = await res.json();
    expect(doc.id).toBe('did:web:skillpass.test');
    expect(doc.assertionMethod).toEqual([doc.verificationMethod[0].id]);
    expect(JSON.stringify(doc)).not.toContain(KEY);
    process.env.CREDENTIAL_SIGNING_KEY = '';
    expect((await GET()).status).toBe(404);
  });
});

describe('status list', () => {
  const get = async (code: string, query = '') => {
    const { GET } = await import('@/app/credentials/status/[code]/route');
    return GET(new NextRequest(`https://skillpass.test/credentials/status/${code}${query}`), ctx(code));
  };
  const bit0 = (list: { credentialSubject: { encodedList: string } }) => gunzipSync(Buffer.from(list.credentialSubject.encodedList.slice(1), 'base64url'))[0] >> 7;

  it('serves a signed list that says whether the credential is revoked', async () => {
    const res = await get(CODE);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age=300');
    const list = await res.json();
    expect(list.id).toBe(`https://skillpass.test/credentials/status/${CODE}`);
    expect(list.issuer).toBe('did:web:skillpass.test');
    expect(await verifyProof(list, PUBLIC)).toBe(true);
    expect(bit0(list)).toBe(0);
    expect(publicReads).toEqual([{ fn: 'sp_public_credential', payload: { code: CODE }, demoId: null }]);
    publicAnswer = { credential: { code: CODE }, verification: { status: 'revoked' } };
    const revoked = await (await get(CODE)).json();
    expect(await verifyProof(revoked, PUBLIC)).toBe(true);
    expect(bit0(revoked)).toBe(1);
  });

  it('answers 404 for hidden or unknown credentials, malformed codes, and without a key', async () => {
    publicAnswer = null;
    expect((await get(CODE)).status).toBe(404);
    publicAnswer = { credential: { code: CODE }, verification: { status: 'valid' } };
    expect((await get('SKP-1')).status).toBe(404);
    process.env.CREDENTIAL_SIGNING_KEY = '';
    expect((await get(CODE)).status).toBe(404);
  });

  it('keeps the scenario of a local DEMO in its address', async () => {
    const demo = '11111111-2222-4333-8444-555555555555';
    const list = await (await get(CODE, `?demo=${demo}`)).json();
    expect(list.id).toBe(`https://skillpass.test/credentials/status/${CODE}?demo=${demo}`);
    expect(publicReads.at(-1)?.demoId).toBe(demo);
    await get(CODE, '?demo=not-a-uuid');
    expect(publicReads.at(-1)?.demoId).toBeNull();
  });
});

describe('download', () => {
  const get = async (code = CODE) => {
    const { GET } = await import('@/app/api/credentials/[code]/open-badge/route');
    return GET(new NextRequest(`https://skillpass.test/api/credentials/${code}/open-badge`), ctx(code));
  };

  it('gives the holder their credential signed, as a file', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe(`attachment; filename="SkillPass-${CODE}.json"`);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const badge = await res.json();
    expect(await verifyProof(badge, PUBLIC)).toBe(true);
    expect(badge.issuer.id).toBe('did:web:skillpass.test');
    expect(badge.proof.verificationMethod).toMatch(/^did:web:skillpass\.test#z6Mk/);
    expect(badge.credentialStatus.statusListCredential).toBe(`https://skillpass.test/credentials/status/${CODE}`);
    expect(badge.evidence[0].id).toBe(`https://skillpass.test/verify/${CODE}`);
    expect(badge.credentialSubject.name).toBe('María Torres');
    expect(badge.credentialSubject.source.id).toBe('urn:uuid:20000000-0000-4000-8000-000000000001');
    expect(reads.map((r) => r.fn)).toEqual(['sp_skillpass_me', 'sp_challenge']);
  });

  it('does not ask for the organization of a confidential challenge', async () => {
    credentials = [{ ...CREDENTIAL, confidential: true, challenge_title: null, organization_name: null }];
    const badge = await (await get()).json();
    expect(reads.map((r) => r.fn)).toEqual(['sp_skillpass_me']);
    expect(JSON.stringify(badge)).not.toContain('Aceros');
  });

  it('refuses everyone else, revoked or hidden credentials, and bursts', async () => {
    session = null; me = null;
    expect((await get()).status).toBe(401);
    session = { mode: 'supabase', userId: 'u2', email: 'empresa@example.com' };
    me = { mode: 'supabase', demoId: null, profile: { role: 'company', full_name: 'Laura' } };
    expect((await get()).status).toBe(403);
    me = { mode: 'supabase', demoId: null, profile: { role: 'student', full_name: 'Otra Persona' } };
    credentials = [];
    expect((await get()).status).toBe(404);
    credentials = [{ ...CREDENTIAL, status: 'revoked', revoked_at: '2026-09-01T00:00:00Z' }];
    expect(await (await get()).json()).toEqual({ error: 'credential_not_active' });
    credentials = [{ ...CREDENTIAL, verification_enabled: false }];
    expect(await (await get()).json()).toEqual({ error: 'verification_disabled' });
    credentials = [CREDENTIAL];
    limited = true;
    expect((await get()).status).toBe(429);
    limited = false;
    expect((await get('SKP-2026-ZZZZ-0000')).status).toBe(404);
    process.env.CREDENTIAL_SIGNING_KEY = '';
    expect((await get()).status).toBe(404);
  });
});
