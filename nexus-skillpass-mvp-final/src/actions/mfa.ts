'use server';

import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import type { ActionState } from '@/lib/action-state';
import { fdString, rateLimit, runAction } from '@/lib/server/action';
import { requireSession } from '@/lib/server/backend';
import { AppError } from '@/lib/server/errors';
import { supabaseServer } from '@/lib/server/supabase';
import { safeNextPath } from '@/lib/safety';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function supabaseUser() {
  const session = await requireSession();
  if (session.mode !== 'supabase') throw new AppError('forbidden', 403);
  return { session, supabase: await supabaseServer() };
}

/** Creates a TOTP factor (replacing any unfinished one) and returns its QR code and secret. */
export async function startMfaEnrollment(): Promise<ActionState> {
  return runAction(async () => {
    const { session, supabase } = await supabaseUser();
    rateLimit(`mfa-enroll:${session.userId}`, 5);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const factor of factors?.all ?? []) {
      if (factor.factor_type === 'totp' && factor.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'SkillPass' });
    if (error || !data) throw new AppError('mfa_failed', 400);
    // The QR is drawn here from the otpauth URI, so it does not depend on the format Supabase returns.
    const svg = await QRCode.toString(data.totp.uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    return { data: { factorId: data.id, qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, secret: data.totp.secret } };
  }, { revalidate: false });
}

/** Verifies a code for a factor (enrollment or sign-in): the session moves to aal2 and its cookies are renewed. */
export async function verifyMfa(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const next = safeNextPath(fdString(fd, 'next'));
  const result = await runAction(async () => {
    const { session, supabase } = await supabaseUser();
    rateLimit(`mfa-verify:${session.userId}`, 10);
    const code = fdString(fd, 'code').replace(/\s/g, '');
    const factorId = fdString(fd, 'factor_id');
    if (!/^\d{6}$/.test(code)) throw new AppError('mfa_invalid_code', 400, 'code');
    if (!UUID.test(factorId)) throw new AppError('mfa_failed', 400);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw new AppError('mfa_invalid_code', 400, 'code');
  });
  if (result.ok) redirect(next);
  return result;
}
