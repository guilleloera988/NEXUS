import { NextResponse } from 'next/server';
import { credentialIssuer, didDocument } from '@/lib/server/open-badges';
import { siteOrigin } from '@/lib/server/urls';

export const dynamic = 'force-dynamic';

/**
 * did:web document of the SkillPass issuer: the public keys that sign Open Badges. Verifiers resolve
 * did:web:<host> to this URL. Without a signing key configured there is no issuer, and no document.
 */
export async function GET() {
  const issuer = credentialIssuer(await siteOrigin());
  if (!issuer) return new NextResponse('Not found', { status: 404 });
  return NextResponse.json(didDocument(issuer), {
    headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
  });
}
