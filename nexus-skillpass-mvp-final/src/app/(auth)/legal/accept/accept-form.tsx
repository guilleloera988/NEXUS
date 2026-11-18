'use client';

import { useActionState } from 'react';
import { acceptLegal } from '@/actions/legal';
import { LegalConsent } from '@/components/legal-consent';
import { FormFeedback, SubmitButton } from '@/components/ui/form';
import { IDLE } from '@/lib/action-state';
import { useI18n } from '@/lib/i18n/client';

export function AcceptLegalForm({ next }: { next: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(acceptLegal, IDLE);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <LegalConsent />
      <SubmitButton className="btn-primary w-full" pendingLabel={t.legal.accepting}>{t.legal.acceptButton}</SubmitButton>
      <FormFeedback state={state} t={t} />
    </form>
  );
}
