'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { fdString, rateLimit, runAction } from '@/lib/server/action';
import { DEMO_COOKIE } from '@/lib/server/demo-session';
import { SIGNUP_EMAIL_COOKIE } from '@/lib/server/auth-cookies';
import { appOrigin, supabaseConfig } from '@/lib/server/env';
import { AppError } from '@/lib/server/errors';
import { supabaseServer } from '@/lib/server/supabase';
import { forgotSchema, loginSchema, resetSchema, signupSchema } from '@/lib/schemas';
import { safeNextPath } from '@/lib/safety';

async function clientKey() {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
}

/** Remembers, for the confirmation link's lifetime, which address the check-email page talks about. */
async function rememberSignupEmail(email: string) {
  const h = await headers();
  (await cookies()).set(SIGNUP_EMAIL_COOKIE, email, {
    httpOnly: true, sameSite: 'lax', secure: h.get('x-forwarded-proto') === 'https', path: '/', maxAge: 3600,
  });
}

async function clearAuthCookies() {
  const jar = await cookies();
  for (const name of [DEMO_COOKIE, SIGNUP_EMAIL_COOKIE]) if (jar.has(name)) jar.delete(name);
}

async function origin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return appOrigin(host ? `${proto}://${host}` : null);
}

export async function login(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const next = safeNextPath(fdString(fd, 'next'));
  const result = await runAction(async () => {
    rateLimit(`login:${await clientKey()}`, 10);
    if (!supabaseConfig()) throw new AppError('supabase_not_configured', 503);
    const input = loginSchema.parse({ email: fdString(fd, 'email'), password: fdString(fd, 'password') });
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword(input);
    if (error) {
      // Supabase checks the password before reporting an unconfirmed address, so this reveals nothing
      // to someone guessing accounts; it saves the owner from a misleading "wrong password".
      if (error.code === 'email_not_confirmed') {
        await rememberSignupEmail(input.email);
        redirect('/signup/check-email?pending=1');
      }
      throw new AppError('invalid_credentials', 401);
    }
    await clearAuthCookies();
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
    if (error) {
      // Supabase rolls the sign-up back when the confirmation e-mail can't be sent (SMTP down or
      // misconfigured); say so instead of blaming the visitor's data.
      console.error('[skillpass] sign-up rejected by Supabase Auth', error.status ?? '', error.code ?? '');
      if (/password/i.test(error.message)) throw new AppError('weak_password', 400);
      if (error.code === 'over_email_send_rate_limit' || /rate limit/i.test(error.message)) throw new AppError('email_rate_limited', 429);
      if (/sending .*email|smtp/i.test(error.message) || (error.status ?? 0) >= 500) throw new AppError('email_send_failed', 503);
      throw new AppError('signup_failed', 400);
    }
    if (data.session) {
      await clearAuthCookies();
      redirect('/onboarding');
    }
    // A page of its own (not a message inside the form) survives reloads and works without JavaScript.
    await rememberSignupEmail(input.email);
    redirect('/signup/check-email');
  }, { revalidate: false });
}

export async function resendConfirmation(): Promise<ActionState> {
  return runAction(async () => {
    rateLimit(`resend:${await clientKey()}`, 3);
    if (!supabaseConfig()) throw new AppError('supabase_not_configured', 503);
    const parsed = forgotSchema.safeParse({ email: (await cookies()).get(SIGNUP_EMAIL_COOKIE)?.value ?? '' });
    if (!parsed.success) throw new AppError('signup_email_unknown', 400);
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: parsed.data.email,
      options: { emailRedirectTo: new URL('/auth/callback?next=/onboarding', await origin()).toString() },
    });
    if (error) {
      console.error('[skillpass] confirmation resend rejected by Supabase Auth', error.status ?? '', error.code ?? '');
      if (error.code === 'over_email_send_rate_limit' || error.status === 429) throw new AppError('email_rate_limited', 429);
      if ((error.status ?? 0) >= 500) throw new AppError('email_send_failed_resend', 503);
      // Anything else (already confirmed, unknown address) gets the same answer: no account probing.
    }
    return { message: 'emailResent' };
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
  await clearAuthCookies();
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
