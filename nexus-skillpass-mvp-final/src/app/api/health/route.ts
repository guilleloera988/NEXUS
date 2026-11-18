import { NextResponse } from 'next/server';
import { emailConfig } from '@/lib/server/email';
import { credentialIssuer } from '@/lib/server/open-badges';
import { siteOrigin } from '@/lib/server/urls';
import { demoMode, supabaseConfig } from '@/lib/server/env';
import { scannerStatus } from '@/lib/server/scanner';

/** Deployment check: reports configuration presence and reachability only (never values or secrets). */
export async function GET() {
  return NextResponse.json(
    { status: 'ok', supabase: Boolean(supabaseConfig()), demoMode: demoMode(), antivirus: await scannerStatus(), email: emailConfig() ? 'on' : 'off',
      openBadges: credentialIssuer(await siteOrigin()) ? 'on' : 'off', time: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
