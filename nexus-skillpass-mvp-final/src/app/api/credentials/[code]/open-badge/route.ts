import { NextResponse, type NextRequest } from 'next/server';
import { buildOpenBadge } from '@/lib/credentials/open-badge';
import { getLocale } from '@/lib/i18n/server';
import { legalEntity } from '@/lib/legal/config';
import { getMe, getSession, read } from '@/lib/server/backend';
import { AppError } from '@/lib/server/errors';
import { credentialIssuer, signWithIssuer } from '@/lib/server/open-badges';
import { LIMITS, limitAttempts } from '@/lib/server/rate-limit';
import { publicUrl, siteOrigin } from '@/lib/server/urls';
import type { SkillPassMe } from '@/lib/types';

export const dynamic = 'force-dynamic';

const CODE = /^SKP-\d{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * The signed Open Badges 3.0 version of one of the signed-in student's credentials, as a file. Only for the
 * holder, only for active credentials with public verification on (otherwise nobody could check its status).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code).toUpperCase();
  const origin = await siteOrigin();
  const issuer = credentialIssuer(origin);
  if (!issuer) return fail(404, 'not_found');
  if (!CODE.test(code)) return fail(404, 'not_found');
  const session = await getSession();
  const me = await getMe();
  if (!session || !me) return fail(401, 'auth_required');
  if (me.profile.role !== 'student' || !session.email) return fail(403, 'forbidden');
  try {
    await limitAttempts([{ rule: LIMITS.openBadge, id: session.userId }]);
  } catch {
    return fail(429, 'rate_limited');
  }

  try {
    const data = await read<SkillPassMe>('sp_skillpass_me');
    const credential = data?.credentials.find((c) => c.code === code);
    if (!credential) return fail(404, 'not_found');
    if (credential.status !== 'active') return fail(409, 'credential_not_active');
    if (!credential.verification_enabled) return fail(409, 'verification_disabled');

    // The organization's identifier only travels with challenges that are not confidential.
    let organization: { id: string } | null = null;
    if (!credential.confidential) {
      const challenge = await read<{ organization?: { id: string } } | null>('sp_challenge', { id: credential.challenge_id }).catch(() => null);
      if (challenge?.organization?.id) organization = { id: challenge.organization.id };
    }
    const demo = me.mode === 'demo' ? me.demoId : null;
    const image = `${origin}/brand/skillpass-mark.png`;
    const unsigned = buildOpenBadge({
      locale: await getLocale(),
      credential,
      holder: { name: me.profile.full_name, email: session.email },
      issuer: { id: issuer.did, name: credential.issuer || 'SkillPass by AINDEV NEXUS', url: origin, image, email: legalEntity()?.email ?? null },
      organization,
      urls: {
        verify: await publicUrl(`/verify/${code}`, demo),
        status: await publicUrl(`/credentials/status/${code}`, demo),
        framework: `${origin}/competencies`,
        image,
        evidenceFile: (id) => `${origin}/api/public/evidence/${id}${demo ? `?demo=${demo}` : ''}`,
      },
    });
    const signed = await signWithIssuer(unsigned, issuer);
    return new NextResponse(`${JSON.stringify(signed, null, 2)}\n`, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="SkillPass-${code}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof AppError) return fail(error.status, error.key);
    console.error('[skillpass] open badge failed:', error instanceof Error ? error.message : error);
    return fail(500, 'generic');
  }
}
