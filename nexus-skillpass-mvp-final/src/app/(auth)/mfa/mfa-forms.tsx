'use client';

import { useActionState, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { startMfaEnrollment, verifyMfa } from '@/actions/mfa';
import { Field, FormFeedback, SubmitButton } from '@/components/ui/form';
import { IDLE, type ActionState } from '@/lib/action-state';
import { useI18n } from '@/lib/i18n/client';

function CodeForm({ factorId, next }: { factorId: string; next: string }) {
  const { t } = useI18n();
  const M = t.auth.mfa;
  const [state, action] = useActionState(verifyMfa, IDLE);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="factor_id" value={factorId} />
      <input type="hidden" name="next" value={next} />
      <Field label={M.code} name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={7} pattern="[0-9 ]{6,7}" />
      <SubmitButton className="btn-primary w-full" pendingLabel={M.verifying}>{M.verify}</SubmitButton>
      <FormFeedback state={state} t={t} />
    </form>
  );
}

/** Sign-in step for a user who already has an authenticator app. */
export function MfaChallenge({ factorId, next }: { factorId: string; next: string }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <KeyRound className="size-6 text-gold-600" aria-hidden />
        <h2 className="text-lg font-bold">{t.auth.mfa.challengeTitle}</h2>
      </div>
      <p className="text-sm text-ink-600">{t.auth.mfa.challengeText}</p>
      <CodeForm factorId={factorId} next={next} />
    </div>
  );
}

/** First-time setup: create the factor, show its QR code and secret, then verify one code. */
export function MfaEnroll({ next }: { next: string }) {
  const { t } = useI18n();
  const M = t.auth.mfa;
  const [state, setState] = useState<ActionState>(IDLE);
  const [busy, setBusy] = useState(false);
  const factor = state.ok && state.data ? state.data as { factorId: string; qr: string; secret: string } : null;
  const start = async () => {
    setBusy(true);
    try { setState(await startMfaEnrollment()); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-6 text-gold-600" aria-hidden />
        <h2 className="text-lg font-bold">{M.enrollTitle}</h2>
      </div>
      <p className="text-sm text-ink-600">{M.enrollText}</p>
      {!factor ? (
        <>
          <button type="button" className="btn-primary w-full" onClick={start} disabled={busy} aria-busy={busy}>{M.start}</button>
          <FormFeedback state={state} t={t} />
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-ink-800">{M.scan}</p>
          {/* QR drawn on the server from the otpauth URI (a data: SVG, allowed by the CSP). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={factor.qr} alt={M.scan} width={200} height={200} className="mx-auto rounded-xl border border-ink-200 bg-white p-2" />
          <div>
            <p className="text-sm text-ink-600">{M.secret}</p>
            <p className="mt-1 break-all rounded-lg bg-ink-50 px-3 py-2 font-mono text-sm tracking-wider text-ink-900">{factor.secret}</p>
          </div>
          <CodeForm factorId={factor.factorId} next={next} />
        </>
      )}
    </div>
  );
}
