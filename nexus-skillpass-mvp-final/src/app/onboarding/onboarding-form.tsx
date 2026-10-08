'use client';

import { completeOnboarding } from '@/actions/profile';
import { StudentProfileFields } from '@/components/profile-fields';
import { ActionForm, Checkbox, Field, SubmitButton } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';
import { INDUSTRIES, ORG_SIZES } from '@/lib/constants';
import { useI18n } from '@/lib/i18n/client';
import type { Lookups, Profile } from '@/lib/types';

export function OnboardingForm({ profile, lookups, declared, needsOrganization }: {
  profile: Profile; lookups: Lookups; declared: string[]; needsOrganization: boolean;
}) {
  const { t } = useI18n();
  const O = t.onboarding;
  const role = profile.role;
  return (
    <ActionForm action={completeOnboarding} className="space-y-6">
      {role === 'student' && (
        <>
          <Alert tone="info">{O.student.intro}</Alert>
          <StudentProfileFields profile={profile} lookups={lookups} declared={declared} />
          <Checkbox name="open_to_opportunities" label={O.student.openToOpportunities} help={O.student.openHelp} defaultChecked={profile.open_to_opportunities} />
        </>
      )}
      {(role === 'company' || role === 'university') && needsOrganization && (
        <>
          <Alert tone="gold">{role === 'company' ? O.company.intro : O.university.intro}</Alert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.auth.fullName} name="full_name" defaultValue={profile.full_name} required maxLength={160} />
            <Field label={role === 'company' ? O.company.contactTitle : O.university.contactTitle} name="headline" defaultValue={profile.headline} maxLength={160} />
            <Field label={role === 'company' ? O.company.orgName : O.university.orgName} name="organization_name" required maxLength={160} className="sm:col-span-2" />
            {role === 'company' ? (
              <>
                <Field as="select" label={O.company.industry} name="industry" placeholder={t.common.select}
                  options={INDUSTRIES.map((i) => ({ value: i, label: t.enums.industries[i] }))} />
                <Field as="select" label={O.company.size} name="size" placeholder={t.common.select}
                  options={ORG_SIZES.map((s) => ({ value: s, label: t.enums.orgSize[s] }))} />
              </>
            ) : (
              <Field label={O.university.campus} name="campus" maxLength={120} />
            )}
            <Field label={O.company.location} name="location" maxLength={120} />
            <Field label={O.company.website} name="website" type="url" placeholder="https://" maxLength={300} />
            <Field as="textarea" label={O.company.description} name="description" maxLength={1500} rows={3} className="sm:col-span-2" />
            {role === 'company' ? (
              <Field as="textarea" label={O.company.needs} name="needs" maxLength={1500} rows={3} className="sm:col-span-2" />
            ) : (
              <Field as="textarea" label={O.university.programs} name="programs" help={O.university.programsHelp} rows={4} className="sm:col-span-2" />
            )}
          </div>
        </>
      )}
      {(role === 'supervisor' || role === 'admin' || ((role === 'company' || role === 'university') && !needsOrganization)) && (
        <>
          <Alert tone="info">{O.staff.intro}</Alert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.auth.fullName} name="full_name" defaultValue={profile.full_name} required maxLength={160} />
            <Field label={O.staff.title} name="headline" defaultValue={profile.headline} maxLength={160} />
          </div>
        </>
      )}
      <div className="flex justify-end border-t border-ink-100 pt-5">
        <SubmitButton pendingLabel={t.common.saving}>{O.finish}</SubmitButton>
      </div>
    </ActionForm>
  );
}
