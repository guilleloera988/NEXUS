'use client';

import { inviteToChallenge } from '@/actions/challenges';
import { inviteMember, reportIncident, updateOrganization, updateProfile } from '@/actions/profile';
import { INDUSTRIES, ORG_SIZES } from '@/lib/constants';
import { useI18n } from '@/lib/i18n/client';
import type { Lookups, Profile } from '@/lib/types';
import { StudentProfileFields } from './profile-fields';
import { ActionForm, Field, SubmitButton } from './ui/form';

export function StudentProfileForm({ profile, lookups, declared }: { profile: Profile; lookups: Lookups; declared: string[] }) {
  const { t } = useI18n();
  return (
    <ActionForm action={updateProfile} className="space-y-6" success={t.common.saved}>
      <StudentProfileFields profile={profile} lookups={lookups} declared={declared} />
      <div className="flex justify-end"><SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton></div>
    </ActionForm>
  );
}

export function StaffProfileForm({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  return (
    <ActionForm action={updateProfile} className="space-y-4" success={t.common.saved}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.auth.fullName} name="full_name" defaultValue={profile.full_name} required maxLength={160} />
        <Field label={t.onboarding.staff.title} name="headline" defaultValue={profile.headline} maxLength={160} />
      </div>
      <Field as="textarea" label={t.profile.bio} name="bio" defaultValue={profile.bio} maxLength={1200} rows={3} />
      <SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton>
    </ActionForm>
  );
}

export function OrganizationForm({ org }: { org: { id: string; kind: string; name: string; industry: string; size: string; location: string; website: string; description: string; needs: string; campus: string; programs: string[]; verification_status: string } }) {
  const { t } = useI18n();
  const O = t.onboarding;
  return (
    <ActionForm action={updateOrganization} className="space-y-4" success={t.common.saved}>
      <input type="hidden" name="organization_id" value={org.id} />
      <Field label={org.kind === 'company' ? O.company.orgName : O.university.orgName} name="name" defaultValue={org.name} required maxLength={160}
        help={org.verification_status === 'verified' ? t.organization.renameWarning : undefined} />
      <div className="grid gap-4 sm:grid-cols-2">
        {org.kind === 'company' ? (
          <>
            <Field as="select" label={O.company.industry} name="industry" defaultValue={org.industry} placeholder={t.common.select}
              options={INDUSTRIES.map((i) => ({ value: i, label: t.enums.industries[i] }))} />
            <Field as="select" label={O.company.size} name="size" defaultValue={org.size} placeholder={t.common.select}
              options={ORG_SIZES.map((s) => ({ value: s, label: t.enums.orgSize[s] }))} />
          </>
        ) : (
          <>
            <input type="hidden" name="industry" value={org.industry} />
            <Field label={O.university.campus} name="campus" defaultValue={org.campus} maxLength={120} />
          </>
        )}
        <Field label={O.company.location} name="location" defaultValue={org.location} maxLength={120} />
        <Field label={O.company.website} name="website" type="url" defaultValue={org.website} placeholder="https://" maxLength={300} />
      </div>
      <Field as="textarea" label={O.company.description} name="description" defaultValue={org.description} maxLength={1500} rows={3} />
      {org.kind === 'company' ? (
        <Field as="textarea" label={O.company.needs} name="needs" defaultValue={org.needs} maxLength={1500} rows={3} />
      ) : (
        <Field as="textarea" label={O.university.programs} name="programs" defaultValue={org.programs.join('\n')} help={O.university.programsHelp} rows={4} />
      )}
      <SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton>
    </ActionForm>
  );
}

export function InviteMemberForm({ organizationId, kind }: { organizationId: string; kind: string }) {
  const { t } = useI18n();
  const roles = kind === 'company' ? (['supervisor', 'manager'] as const) : (['staff', 'manager'] as const);
  return (
    <ActionForm action={inviteMember} className="space-y-3" success={t.organization.invited} resetOnSuccess>
      <input type="hidden" name="organization_id" value={organizationId} />
      <Field label={t.organization.inviteEmail} name="email" type="email" required autoComplete="off" />
      <Field as="select" label={t.organization.inviteRole} name="member_role" defaultValue={roles[0]} options={roles.map((r) => ({ value: r, label: t.enums.memberRole[r] }))} />
      <SubmitButton className="btn-dark" pendingLabel={t.common.saving}>{t.organization.sendInvite}</SubmitButton>
    </ActionForm>
  );
}

export function InviteToChallengeForm({ studentId, challenges }: { studentId: string; challenges: { id: string; title: string }[] }) {
  const { t } = useI18n();
  return (
    <ActionForm action={inviteToChallenge} className="space-y-3" success={t.challenges.detail.inviteSent} resetOnSuccess>
      <input type="hidden" name="student_id" value={studentId} />
      <Field as="select" label={t.nav.challenges} name="challenge_id" required options={challenges.map((c) => ({ value: c.id, label: c.title }))} />
      <Field as="textarea" label={t.challenges.detail.inviteMessage} name="message" maxLength={600} rows={2} />
      <SubmitButton className="btn-primary w-full">{t.talent.invite}</SubmitButton>
    </ActionForm>
  );
}

export function ReportIncidentForm({ entityType, entityId }: { entityType: string; entityId?: string }) {
  const { t } = useI18n();
  return (
    <ActionForm action={reportIncident} className="space-y-3" success={t.common.done} resetOnSuccess>
      <input type="hidden" name="entity_type" value={entityType} />
      {entityId && <input type="hidden" name="entity_id" value={entityId} />}
      <Field as="select" label={t.common.details} name="category" required defaultValue="incorrect_data"
        options={(['incorrect_data', 'misconduct', 'privacy', 'suspected_fraud', 'technical', 'other'] as const).map((c) => ({ value: c, label: t.enums.incidentCategory[c] }))} />
      <Field as="textarea" label={t.common.description} name="description" required maxLength={2000} rows={3} />
      <SubmitButton className="btn-outline btn-sm">{t.common.submit}</SubmitButton>
    </ActionForm>
  );
}
