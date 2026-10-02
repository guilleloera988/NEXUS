'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Building2, GraduationCap, UserRound } from 'lucide-react';
import { forgotPassword, login, resetPassword, signup } from '@/actions/auth';
import { Field, FormFeedback, SubmitButton } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';
import { IDLE } from '@/lib/action-state';
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

export function LoginForm({ next, configured }: { next: string; configured: boolean }) {
  const { t } = useI18n();
  const [state, action] = useActionState(login, IDLE);
  return (
    <>
      <h1 className="text-2xl font-extrabold">{t.auth.loginTitle}</h1>
      <p className="mt-1 text-ink-500">{t.auth.loginSubtitle}</p>
      <div className="mt-6">
        {!configured && <NotConfigured />}
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
  if (state.ok && state.message === 'checkEmail') {
    return (
      <div>
        <h1 className="text-2xl font-extrabold">{t.auth.signupTitle}</h1>
        <Alert tone="success" className="mt-6">{t.auth.checkEmail}</Alert>
        <Link href="/login" className="btn-primary mt-6 w-full">{t.auth.signIn}</Link>
      </div>
    );
  }
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
