'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { fdString, rateLimit, runAction } from '@/lib/server/action';
import { DEMO_COOKIE } from '@/lib/server/demo-session';
import { appOrigin, supabaseConfig } from '@/lib/server/env';
import { AppError } from '@/lib/server/errors';
import { supabaseServer } from '@/lib/server/supabase';
import { forgotSchema, loginSchema, resetSchema, signupSchema } from '@/lib/schemas';

async function clientKey() {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
}

async function origin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return appOrigin(host ? `${proto}://${host}` : null);
}

function safeNext(value: string) {
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/dashboard';
}

export async function login(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const next = safeNext(fdString(fd, 'next'));
  const result = await runAction(async () => {
    rateLimit(`login:${await clientKey()}`, 10);
    if (!supabaseConfig()) throw new AppError('supabase_not_configured', 503);
    const input = loginSchema.parse({ email: fdString(fd, 'email'), password: fdString(fd, 'password') });
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword(input);
    if (error) throw new AppError('invalid_credentials', 401);
    (await cookies()).delete(DEMO_COOKIE);
    await supabase.rpc('sp_accept_invitations', { p: {} });
  });
  if (result.ok) redirect(next);
  return result;
}

export async function signup(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    rateLimit(`signup:${await clientKey()}`, 5);
    if (!supabaseConfig()) throw new AppError('supabase_not_configured', 503);
    const input = signupSchema.parse({
      full_name: fdString(fd, 'full_name'), email: fdString(fd, 'email'), password: fdString(fd, 'password'), account_type: fdString(fd, 'account_type'),
    });
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { full_name: input.full_name, account_type: input.account_type },
        emailRedirectTo: new URL('/auth/callback?next=/onboarding', await origin()).toString(),
      },
    });
    if (error) throw new AppError(/password/i.test(error.message) ? 'weak_password' : 'signup_failed', 400);
    (await cookies()).delete(DEMO_COOKIE);
    if (data.session) redirect('/onboarding');
    return { message: 'checkEmail' };
  }, { revalidate: false });
}

export async function forgotPassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    rateLimit(`forgot:${await clientKey()}`, 5);
    if (!supabaseConfig()) throw new AppError('supabase_not_configured', 503);
    const { email } = forgotSchema.parse({ email: fdString(fd, 'email') });
    const supabase = await supabaseServer();
    // The response is identical whether or not the account exists (no account enumeration).
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL('/auth/callback?next=/reset-password', await origin()).toString() });
    return { message: 'linkSent' };
  }, { revalidate: false });
}

export async function resetPassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const input = resetSchema.parse({ password: fdString(fd, 'password'), confirm: fdString(fd, 'confirm') });
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new AppError('auth_required', 401);
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) throw new AppError('weak_password', 400);
  });
  if (result.ok) redirect('/dashboard');
  return result;
}

export async function logout() {
  const jar = await cookies();
  jar.delete(DEMO_COOKIE);
  if (supabaseConfig()) {
    try {
      const supabase = await supabaseServer();
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      /* already signed out */
    }
  }
  redirect('/');
}
