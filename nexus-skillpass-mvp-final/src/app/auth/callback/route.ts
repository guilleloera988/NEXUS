import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/server/supabase';
import { supabaseConfig } from '@/lib/server/env';
import { safeNextPath } from '@/lib/safety';

/** Supabase e-mail confirmation / password recovery landing: exchanges the code for a session. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const next = safeNextPath(url.searchParams.get('next'));
  if (code && supabaseConfig()) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await supabase.rpc('sp_accept_invitations', { p: {} });
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL('/login', url.origin));
}
