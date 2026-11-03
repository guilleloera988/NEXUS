import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Second factor (migration 20261103000002). There is no Supabase Auth server in the test environment, so the
 * Supabase client is a fake that records calls; the database rules themselves are covered in database.test.ts.
 */
const calls: string[] = [];
const factors = { all: [] as { id: string; factor_type: string; status: string }[], totp: [] as { id: string }[] };
let verifyError: { message: string } | null = null;
let session: { mode: 'supabase' | 'demo'; userId: string } | null = { mode: 'supabase', userId: 'u1' };
let mfaStatus: { required: boolean; aal: string } | Error = { required: true, aal: 'aal1' };

const fakeSupabase = {
  auth: {
    mfa: {
      listFactors: async () => { calls.push('listFactors'); return { data: factors, error: null }; },
      unenroll: async ({ factorId }: { factorId: string }) => { calls.push(`unenroll:${factorId}`); return { data: {}, error: null }; },
      enroll: async (p: { factorType: string; friendlyName: string }) => {
        calls.push(`enroll:${p.factorType}:${p.friendlyName}`);
        return { data: { id: '11111111-2222-4333-8444-555555555555', totp: { uri: 'otpauth://totp/SkillPass:ana?secret=JBSWY3DPEHPK3PXP', secret: 'JBSWY3DPEHPK3PXP', qr_code: '<svg/>' } }, error: null };
      },
      challengeAndVerify: async (p: { factorId: string; code: string }) => { calls.push(`verify:${p.factorId}:${p.code}`); return { data: verifyError ? null : {}, error: verifyError }; },
    },
  },
};

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), { digest: `NEXT_REDIRECT;replace;${url};307;` }); },
  unstable_rethrow: (error: unknown) => { if (error instanceof Error && error.message.startsWith('NEXT_REDIRECT')) throw error; },
}));
vi.mock('@/lib/server/supabase', () => ({ supabaseServer: async () => fakeSupabase }));
vi.mock('@/lib/server/backend', () => ({
  requireSession: async () => { if (!session) throw Object.assign(new Error('auth_required'), { key: 'auth_required' }); return session; },
  getSession: async () => session,
  read: async () => { if (mfaStatus instanceof Error) throw mfaStatus; return mfaStatus; },
}));

const form = (values: Record<string, string>) => { const fd = new FormData(); for (const [k, v] of Object.entries(values)) fd.set(k, v); return fd; };

beforeEach(() => {
  calls.length = 0;
  factors.all = []; factors.totp = [];
  verifyError = null;
  session = { mode: 'supabase', userId: `u-${Math.random()}` };
  mfaStatus = { required: true, aal: 'aal1' };
});

describe('second-factor state', () => {
  it('asks admins and supervisors (and any reviewer at the validation step) only when the database requires it', async () => {
    const { mfaPending } = await import('@/lib/server/mfa');
    const state = { required: true, aal: 'aal1', factorId: null };
    expect(['admin', 'supervisor', 'company', 'student', 'university'].map((r) => mfaPending(state, r as never))).toEqual([true, true, false, false, false]);
    expect(mfaPending(state)).toBe(true);
    expect(mfaPending({ ...state, aal: 'aal2' }, 'admin')).toBe(false);
    expect(mfaPending({ ...state, required: false }, 'admin')).toBe(false);
  });

  it('reads the requirement and the verified factor, and treats a database without the migration as not required', async () => {
    const { getMfaState } = await import('@/lib/server/mfa');
    factors.totp = [{ id: 'f-verified' }];
    expect(await getMfaState()).toEqual({ required: true, aal: 'aal1', factorId: 'f-verified' });
    mfaStatus = new Error('function sp_mfa_status does not exist');
    session = { mode: 'supabase', userId: 'other' };
    expect(await getMfaState()).toEqual({ required: false, aal: 'aal1', factorId: null });
    session = { mode: 'demo', userId: 'demo' };
    expect(await getMfaState()).toEqual({ required: false, aal: 'aal1', factorId: null });
  });
});

describe('second-factor actions', () => {
  it('replaces an unfinished factor and returns a QR drawn from the otpauth URI', async () => {
    const { startMfaEnrollment } = await import('@/actions/mfa');
    factors.all = [{ id: 'old-unverified', factor_type: 'totp', status: 'unverified' }, { id: 'phone', factor_type: 'phone', status: 'unverified' }];
    const result = await startMfaEnrollment();
    expect(result.ok).toBe(true);
    expect(calls).toEqual(['listFactors', 'unenroll:old-unverified', 'enroll:totp:SkillPass']);
    expect(result.data?.factorId).toBe('11111111-2222-4333-8444-555555555555');
    expect(result.data?.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(String(result.data?.qr)).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  });

  it('refuses the demo session', async () => {
    const { startMfaEnrollment } = await import('@/actions/mfa');
    session = { mode: 'demo', userId: 'demo' };
    expect(await startMfaEnrollment()).toMatchObject({ ok: false, error: 'forbidden' });
  });

  it('checks the code format before calling Supabase, and maps a wrong code to a field error', async () => {
    const { verifyMfa } = await import('@/actions/mfa');
    const factorId = '11111111-2222-4333-8444-555555555555';
    expect(await verifyMfa({ ok: false }, form({ factor_id: factorId, code: '12a456', next: '/dashboard' }))).toMatchObject({ ok: false, error: 'mfa_invalid_code', field: 'code' });
    expect(await verifyMfa({ ok: false }, form({ factor_id: 'not-a-uuid', code: '123456', next: '/dashboard' }))).toMatchObject({ ok: false, error: 'mfa_failed' });
    expect(calls).toEqual([]);
    verifyError = { message: 'Invalid TOTP code entered' };
    expect(await verifyMfa({ ok: false }, form({ factor_id: factorId, code: '123 456', next: '/dashboard' }))).toMatchObject({ ok: false, error: 'mfa_invalid_code', field: 'code' });
    expect(calls).toEqual([`verify:${factorId}:123456`]);
  });

  it('redirects to a safe path once the code is accepted', async () => {
    const { verifyMfa } = await import('@/actions/mfa');
    const factorId = '11111111-2222-4333-8444-555555555555';
    await expect(verifyMfa({ ok: false }, form({ factor_id: factorId, code: '654321', next: '/validations/abc' }))).rejects.toThrow('NEXT_REDIRECT:/validations/abc');
    await expect(verifyMfa({ ok: false }, form({ factor_id: factorId, code: '654321', next: '//evil.example' }))).rejects.toThrow('NEXT_REDIRECT:/dashboard');
  });

  it('limits code attempts per user', async () => {
    const { verifyMfa } = await import('@/actions/mfa');
    verifyError = { message: 'Invalid TOTP code entered' };
    const fd = form({ factor_id: '11111111-2222-4333-8444-555555555555', code: '000000', next: '/dashboard' });
    for (let i = 0; i < 10; i++) expect((await verifyMfa({ ok: false }, fd)).error).toBe('mfa_invalid_code');
    expect((await verifyMfa({ ok: false }, fd)).error).toBe('rate_limited');
  });
});
