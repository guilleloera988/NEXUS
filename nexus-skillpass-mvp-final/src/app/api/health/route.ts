import { NextResponse } from 'next/server';
import { demoMode, supabaseConfig } from '@/lib/server/env';
import { scannerStatus } from '@/lib/server/scanner';

/** Deployment check: reports configuration presence and reachability only (never values or secrets). */
export async function GET() {
  return NextResponse.json(
    { status: 'ok', supabase: Boolean(supabaseConfig()), demoMode: demoMode(), antivirus: await scannerStatus(), time: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
