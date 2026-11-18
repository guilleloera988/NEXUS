import { NextResponse, type NextRequest } from 'next/server';
import { buildStatusList } from '@/lib/credentials/open-badge';
import { publicRead } from '@/lib/server/backend';
import { isUuid } from '@/lib/server/demo-session';
import { credentialIssuer, signWithIssuer } from '@/lib/server/open-badges';
import { publicUrl, siteOrigin } from '@/lib/server/urls';
import type { PublicVerification } from '@/lib/types';

export const dynamic = 'force-dynamic';

const CODE = /^SKP-\d{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
const headers = (maxAge: number) => ({ 'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`, 'Access-Control-Allow-Origin': '*' });
// Signed lists are kept a minute per instance, so a burst of checks does not mean a burst of signatures.
const recent = new Map<string, { expires: number; body: unknown }>();

/**
 * Revocation status of one credential as a signed W3C Bitstring Status List (index 0), referenced by the
 * credentialStatus of its Open Badge. It answers only while the credential's public verification is on: a
 * credential its holder hid cannot be checked from outside, so verifiers report its status as unavailable.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code).toUpperCase();
  const demoParam = request.nextUrl.searchParams.get('demo');
  const demo = demoParam && isUuid(demoParam) ? demoParam : null;
  const issuer = credentialIssuer(await siteOrigin());
  if (!issuer || !CODE.test(code)) return new NextResponse('Not found', { status: 404, headers: headers(60) });
  const data = await publicRead<PublicVerification>('sp_public_credential', { code }, demo).catch(() => null);
  if (!data) return new NextResponse('Not found', { status: 404, headers: headers(60) });
  const url = await publicUrl(`/credentials/status/${code}`, demo);
  const revoked = data.verification.status !== 'valid';
  const key = `${issuer.verificationMethod} ${url} ${revoked}`;
  let body = recent.get(key);
  if (!body || body.expires < Date.now()) {
    body = { expires: Date.now() + 60_000, body: await signWithIssuer(buildStatusList({ issuer: issuer.did, url, revoked }), issuer) };
    if (recent.size > 500) recent.clear();
    recent.set(key, body);
  }
  return NextResponse.json(body.body, { headers: headers(300) });
}
