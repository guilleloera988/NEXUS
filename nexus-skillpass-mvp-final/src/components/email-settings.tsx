'use client';

import { Mail } from 'lucide-react';
import { setEmailSettings } from '@/actions/email';
import { ActionForm, Checkbox, Field, SubmitButton } from '@/components/ui/form';
import { Card } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n/client';

/** On/off and language of the e-mail notices (shown only where the deployment sends e-mail). */
export function EmailSettingsCard({ settings }: { settings: { enabled: boolean; locale: 'es' | 'en' | null } }) {
  const { t } = useI18n();
  const E = t.email.settings;
  return (
    <Card id="email-settings" className="mt-6" title={<span className="inline-flex items-center gap-2"><Mail className="size-4 text-gold-700" aria-hidden /> {E.title}</span>}>
      <p className="mb-4 text-sm text-ink-600">{E.text}</p>
      <ActionForm action={setEmailSettings} success={E.saved} className="space-y-4">
        <Checkbox name="enabled" label={E.enabled} defaultChecked={settings.enabled} />
        <Field as="select" name="locale" label={E.language} className="max-w-xs" defaultValue={settings.locale ?? ''}
          options={[{ value: '', label: E.auto }, { value: 'es', label: 'Español' }, { value: 'en', label: 'English' }]} />
        <SubmitButton className="btn-outline" pendingLabel={E.saving}>{E.save}</SubmitButton>
      </ActionForm>
    </Card>
  );
}
