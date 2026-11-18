import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ChallengeForm } from '@/components/challenge-form';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { getMessages } from '@/lib/i18n/server';
import { getMe, read } from '@/lib/server/backend';
import type { Lookups } from '@/lib/types';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.challenges.newTitle };
}

interface OrgOverview {
  organization: { id: string; kind: string; verification_status: string };
  can_manage: boolean;
  members: { user_id: string; full_name: string; member_role: string }[];
}

export default async function NewChallengePage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const { t } = await getMessages();
  const org = await read<OrgOverview | null>('sp_org_overview');
  if (!org || org.organization.kind !== 'company' || !org.can_manage) {
    return <><PageHeader title={t.challenges.newTitle} /><Alert tone="warning">{t.errors.forbiddenText}</Alert></>;
  }
  const lookups = await read<Lookups>('sp_lookups');
  return (
    <>
      <PageHeader kicker={t.nav.challenges} title={t.challenges.newTitle} subtitle={t.challenges.newSubtitle} />
      {org.organization.verification_status !== 'verified' && <Alert tone="warning" className="mb-5">{t.dashboard.company.pendingVerification}</Alert>}
      <ChallengeForm organizationId={org.organization.id} organizationVerified={org.organization.verification_status === 'verified'} catalog={lookups.competencies}
        supervisors={org.members.filter((m) => ['owner', 'manager', 'supervisor'].includes(m.member_role))} />
    </>
  );
}
