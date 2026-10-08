import type { EmailOtpType } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { relativeRedirect } from '@/lib/redirect';
import { SIGNUP_EMAIL_COOKIE } from '@/lib/server/auth-cookies';
import { supabaseServer } from '@/lib/server/supabase';
import { supabaseConfig } from '@/lib/server/env';
import { safeNextPath } from '@/lib/safety';

const OTP_TYPES = new Set<EmailOtpType>(['email', 'signup', 'recovery', 'email_change']);
const isOtpType = (value: string | null): value is EmailOtpType => OTP_TYPES.has(value as EmailOtpType);

/**
 * Landing for Supabase e-mail links (confirmation, password recovery). Two formats:
 * - `token_hash` + `type` (our e-mail templates): verified here, so the link works on any device;
 * - `code` (Supabase's default PKCE link): needs the verifier cookie of the browser that asked for it.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = safeNextPath(url.searchParams.get('next'));
  if (supabaseConfig() && (code || (tokenHash && isOtpType(type)))) {
    const supabase = await supabaseServer();
    const { error } = tokenHash && isOtpType(type)
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : await supabase.auth.exchangeCodeForSession(code ?? '');
    if (!error) {
      await supabase.rpc('sp_accept_invitations', { p: {} });
      (await cookies()).delete(SIGNUP_EMAIL_COOKIE);
      return relativeRedirect(next);
    }
    console.error('[skillpass] e-mail link rejected by Supabase Auth', error.status ?? '', error.code ?? '');
    // A second click (or a mail scanner that opened the link first) while already signed in.
    const { data } = await supabase.auth.getUser();
    if (data.user) return relativeRedirect(next);
  }
  // Expired, already used, or opened in another browser (code flow): say so on the login page.
  return relativeRedirect('/login?notice=link_invalid');
}
