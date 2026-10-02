import { NextResponse } from 'next/server';
import { demoMode, supabaseConfig } from '@/lib/server/env';

/** Deployment check: reports configuration presence only (never values or secrets). */
export function GET() {
  return NextResponse.json(
    { status: 'ok', supabase: Boolean(supabaseConfig()), demoMode: demoMode(), time: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
