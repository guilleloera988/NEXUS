import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ChallengeForm } from '@/components/challenge-form';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { getMessages } from '@/lib/i18n/server';
import { getMe, read } from '@/lib/server/backend';
import type { ChallengeDetail, Lookups } from '@/lib/types';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.challenges.editTitle };
}

export default async function EditChallengePage({ params }: PageProps<'/challenges/[id]/edit'>) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await getMe();
  if (!me) redirect('/login');
  const { t } = await getMessages();
  const data = await read<ChallengeDetail | null>('sp_challenge', { id });
  if (!data) notFound();
  if (!data.can_manage || ['completed', 'archived'].includes(data.challenge.status)) {
    return <><PageHeader title={t.challenges.editTitle} /><Alert tone="warning">{t.errors.forbiddenText}</Alert></>;
  }
  const lookups = await read<Lookups>('sp_lookups');
  return (
    <>
      <PageHeader kicker={data.challenge.title} title={t.challenges.editTitle} />
      <ChallengeForm organizationId={data.challenge.organization_id} organizationVerified={data.challenge.organization?.verification_status === 'verified'}
        challenge={data.challenge} competencies={data.competencies} deliverables={data.deliverables} catalog={lookups.competencies} supervisors={data.org_members} />
    </>
  );
}
