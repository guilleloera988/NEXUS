import { NextRequest,NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
export async function GET(request:NextRequest) {
  const origin=process.env.NEXT_PUBLIC_APP_URL||request.nextUrl.origin;
  const code=request.nextUrl.searchParams.get('code');
  if(code) {
    try {
      const supabase=await supabaseServer();
      const {error}=await supabase.auth.exchangeCodeForSession(code);
      if(!error) return NextResponse.redirect(new URL('/dashboard',origin));
    } catch { /* Configuration is explained on the login screen. */ }
  }
  return NextResponse.redirect(new URL('/login?error=confirmation',origin));
}
