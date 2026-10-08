'use client';

import Link from 'next/link';
import { useActionState, useState, useSyncExternalStore } from 'react';
import { Building2, GraduationCap, Inbox, MailCheck, RotateCw, UserRound } from 'lucide-react';
import { forgotPassword, login, resendConfirmation, resetPassword, signup } from '@/actions/auth';
import { Field, FormFeedback, SubmitButton } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';
import { IDLE } from '@/lib/action-state';
import { fmt } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/client';

function NotConfigured() {
  const { t } = useI18n();
  return (
    <Alert tone="gold" className="mb-5">
      <p>{t.auth.notConfigured}</p>
      <Link href="/demo" className="link mt-2 inline-block text-sm">{t.auth.tryDemo}</Link>
    </Alert>
  );
}

export function LoginForm({ next, configured, linkInvalid = false }: { next: string; configured: boolean; linkInvalid?: boolean }) {
  const { t } = useI18n();
  const [state, action] = useActionState(login, IDLE);
  return (
    <>
      <h1 className="text-2xl font-extrabold">{t.auth.loginTitle}</h1>
      <p className="mt-1 text-ink-500">{t.auth.loginSubtitle}</p>
      <div className="mt-6">
        {!configured && <NotConfigured />}
        {linkInvalid && <Alert tone="gold" title={t.auth.linkInvalid.title} className="mb-5">{t.auth.linkInvalid.text}</Alert>}
        <form action={action} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field label={t.auth.email} name="email" type="email" autoComplete="email" required />
          <Field label={t.auth.password} name="password" type="password" autoComplete="current-password" required />
          <div className="flex justify-end"><Link href="/forgot-password" className="text-sm font-semibold text-ink-700 hover:text-ink-950">{t.auth.forgot}</Link></div>
          <SubmitButton className="btn-primary w-full" pendingLabel={t.auth.signingIn}>{t.auth.signIn}</SubmitButton>
          <FormFeedback state={state} t={t} />
        </form>
        <p className="mt-6 text-center text-sm text-ink-500">{t.auth.noAccount} <Link href="/signup" className="link">{t.auth.createAccount}</Link></p>
        <p className="mt-2 text-center text-sm"><Link href="/demo" className="text-ink-600 underline underline-offset-4 hover:text-ink-950">{t.auth.tryDemo}</Link></p>
      </div>
    </>
  );
}

export function SignupForm({ configured, initialType }: { configured: boolean; initialType: 'student' | 'company' | 'university' }) {
  const { t } = useI18n();
  const [state, action] = useActionState(signup, IDLE);
  const [type, setType] = useState(initialType);
  const options = [
    { value: 'student' as const, icon: UserRound, ...t.auth.accountTypes.student },
    { value: 'company' as const, icon: Building2, ...t.auth.accountTypes.company },
    { value: 'university' as const, icon: GraduationCap, ...t.auth.accountTypes.university },
  ];
  return (
    <>
      <h1 className="text-2xl font-extrabold">{t.auth.signupTitle}</h1>
      <p className="mt-1 text-ink-500">{t.auth.signupSubtitle}</p>
      <div className="mt-6">
        {!configured && <NotConfigured />}
        <form action={action} className="space-y-4">
          <fieldset>
            <legend className="label">{t.auth.accountType}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {options.map((o) => (
                <label key={o.value} className={`cursor-pointer rounded-xl border p-3 transition ${type === o.value ? 'border-ink-950 bg-ink-950 text-white' : 'border-ink-200 hover:border-ink-400'}`}>
                  <input type="radio" name="account_type" value={o.value} checked={type === o.value} onChange={() => setType(o.value)} className="sr-only" />
                  <o.icon className={`size-5 ${type === o.value ? 'text-gold-300' : 'text-ink-500'}`} aria-hidden />
                  <span className="mt-2 block text-sm font-bold">{o.title}</span>
                  <span className={`mt-0.5 block text-xs ${type === o.value ? 'text-ink-300' : 'text-ink-500'}`}>{o.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={t.auth.fullName} name="full_name" autoComplete="name" required maxLength={160} />
          <Field label={t.auth.email} name="email" type="email" autoComplete="email" required />
          <Field label={t.auth.password} name="password" type="password" autoComplete="new-password" required help={t.auth.passwordHint} />
          <p className="text-xs text-ink-500">{t.auth.terms}</p>
          <SubmitButton className="btn-primary w-full" pendingLabel={t.auth.creating}>{t.auth.createAccount}</SubmitButton>
          <FormFeedback state={state} t={t} />
        </form>
        <p className="mt-4 rounded-xl bg-ink-50 p-3 text-xs text-ink-600">{t.auth.supervisorNote}</p>
        <p className="mt-6 text-center text-sm text-ink-500">{t.auth.haveAccount} <Link href="/login" className="link">{t.auth.signIn}</Link></p>
      </div>
    </>
  );
}

// Supabase refuses a second confirmation e-mail to the same address within 60 s.
const RESEND_COOLDOWN_MS = 60_000;
const subscribeClock = (tick: () => void) => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
};
const clockNow = () => Math.floor(Date.now() / 1000) * 1000;
const noClock = () => null;

/** Shown right after sign-up (and to unconfirmed accounts that try to sign in). */
export function CheckEmailPanel({ email, pending }: { email: string | null; pending: boolean }) {
  const { t } = useI18n();
  const c = t.auth.checkEmail;
  const [state, action] = useActionState(resendConfirmation, IDLE);
  const [openedAt] = useState(() => Date.now());
  const now = useSyncExternalStore(subscribeClock, clockNow, noClock);
  const lastSent = state.at ?? (pending ? null : openedAt);
  const wait = now !== null && lastSent !== null ? Math.max(0, Math.ceil((lastSent + RESEND_COOLDOWN_MS - now) / 1000)) : 0;
  return (
    <div>
      <div className="flex size-14 items-center justify-center rounded-2xl bg-gold-50 ring-1 ring-gold-300">
        <MailCheck className="size-7 text-gold-700" aria-hidden />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold">{c.title}</h1>
      {pending && <Alert tone="gold" className="mt-4">{c.pending}</Alert>}
      <p className="mt-3 text-ink-600" role="status">
        {email ? <>{c.sentTo} <strong className="break-all font-semibold text-ink-950">{email}</strong></> : c.sentGeneric}
      </p>
      <div className="mt-6 rounded-2xl border border-ink-200 p-5">
        <h2 className="text-sm font-bold">{c.stepsTitle}</h2>
        <ol className="mt-3 space-y-3">
          {c.steps.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm text-ink-700">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-gold-300" aria-hidden>{i + 1}</span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-4 flex gap-2 rounded-xl bg-ink-50 p-3 text-xs text-ink-600"><Inbox className="size-4 shrink-0" aria-hidden />{c.spam}</p>
      {email ? (
        <form action={action} className="mt-6">
          <p className="text-sm font-semibold text-ink-700">{c.resendPrompt}</p>
          <SubmitButton className="btn-outline mt-2 w-full" pendingLabel={c.resending} disabled={wait > 0}>
            <RotateCw className="size-4" aria-hidden />{wait > 0 ? fmt(c.resendIn, { seconds: wait }) : c.resend}
          </SubmitButton>
          <FormFeedback state={state} t={t} success={c.resent} />
        </form>
      ) : <p className="mt-6 text-sm text-ink-600">{c.noEmailHint}</p>}
      <Link href="/login" className="btn-primary mt-6 w-full">{c.goToLogin}</Link>
      <p className="mt-4 text-center text-sm text-ink-500">{c.wrongEmail} <Link href="/signup" className="link">{c.signupAgain}</Link></p>
    </div>
  );
}

export function ForgotForm({ configured }: { configured: boolean }) {
  const { t } = useI18n();
  const [state, action] = useActionState(forgotPassword, IDLE);
  return (
    <>
      <h1 className="text-2xl font-extrabold">{t.auth.forgotTitle}</h1>
      <p className="mt-1 text-ink-500">{t.auth.forgotSubtitle}</p>
      <div className="mt-6">
        {!configured && <NotConfigured />}
        <form action={action} className="space-y-4">
          <Field label={t.auth.email} name="email" type="email" autoComplete="email" required />
          <SubmitButton className="btn-primary w-full">{t.auth.sendLink}</SubmitButton>
          <FormFeedback state={state} t={t} success={t.auth.linkSent} />
        </form>
        <p className="mt-6 text-center text-sm"><Link href="/login" className="link">{t.auth.signIn}</Link></p>
      </div>
    </>
  );
}

export function ResetForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(resetPassword, IDLE);
  return (
    <>
      <h1 className="text-2xl font-extrabold">{t.auth.resetTitle}</h1>
      <p className="mt-1 text-ink-500">{t.auth.resetSubtitle}</p>
      <form action={action} className="mt-6 space-y-4">
        <Field label={t.auth.password} name="password" type="password" autoComplete="new-password" required help={t.auth.passwordHint} />
        <Field label={t.common.confirm} name="confirm" type="password" autoComplete="new-password" required />
        <SubmitButton className="btn-primary w-full">{t.auth.updatePassword}</SubmitButton>
        <FormFeedback state={state} t={t} success={t.auth.passwordUpdated} />
      </form>
    </>
  );
}
