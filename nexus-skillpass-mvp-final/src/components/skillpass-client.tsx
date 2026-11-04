'use client';

import { updatePrivacy } from '@/actions/profile';
import { useI18n } from '@/lib/i18n/client';
import type { Profile } from '@/lib/types';
import { ActionForm, Checkbox, SubmitButton } from './ui/form';

export function PrivacyForm({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const S = t.skillpass;
  return (
    <ActionForm action={updatePrivacy} className="space-y-4" success={t.common.saved}>
      <Checkbox name="skillpass_public" label={S.publicPage} help={S.publicPageHelp} defaultChecked={profile.skillpass_public} />
      <Checkbox name="public_show_university" label={S.showUniversity} defaultChecked={profile.public_show_university} />
      <Checkbox name="public_show_career" label={S.showCareer} defaultChecked={profile.public_show_career} />
      <Checkbox name="open_to_opportunities" label={S.openToOpportunities} help={t.onboarding.student.openHelp} defaultChecked={profile.open_to_opportunities} />
      <p className="rounded-xl bg-ink-50 p-3 text-xs text-ink-600">{S.neverPublic} {S.verificationNote}</p>
      <SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton>
    </ActionForm>
  );
}
