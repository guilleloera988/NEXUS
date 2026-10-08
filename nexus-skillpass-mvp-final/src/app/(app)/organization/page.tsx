import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Building2, X } from 'lucide-react';
import { removeMember, revokeInvitation } from '@/actions/profile';
import { InviteMemberForm, OrganizationForm } from '@/components/profile-client';
import { Alert, Avatar, Badge, Card, DefinitionList, EmptyState, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { formatRelative } from '@/lib/format';
import { getMessages } from '@/lib/i18n/server';
import { getMe, read } from '@/lib/server/backend';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.organization.title };
}

interface Overview {
  organization: { id: string; kind: string; name: string; industry: string; size: string; location: string; website: string; description: string; needs: string; campus: string; programs: string[]; verification_status: 'pending' | 'verified' | 'rejected'; is_demo: boolean };
  my_role: string | null;
  can_manage: boolean;
  members: { user_id: string; member_role: string; full_name: string; headline: string; role: string }[];
  invitations: { id: string; email: string; member_role: string; created_at: string }[];
}

export default async function OrganizationPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const { t, locale } = await getMessages();
  const O = t.organization;
  const data = await read<Overview | null>('sp_org_overview');
  if (!data) return <><PageHeader title={O.title} /><EmptyState icon={<Building2 className="size-6" />} title={O.none} /></>;
  const org = data.organization;
  return (
    <>
      <PageHeader kicker={t.roles[me.profile.role]} title={org.name} subtitle={O.subtitle}
        actions={<StatusBadge status={org.verification_status === 'verified' ? 'verified' : org.verification_status === 'rejected' ? 'rejected' : 'pending'} label={t.status.organization[org.verification_status]} />} />
      {org.verification_status !== 'verified' && <Alert tone="warning" className="mb-5">{org.kind === 'company' ? t.dashboard.company.pendingVerification : t.dashboard.university.pending}</Alert>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={O.details} className="lg:col-span-2">
          {data.can_manage ? <OrganizationForm org={org} /> : (
            <DefinitionList items={[
              { label: t.onboarding.company.industry, value: org.industry ? t.enums.industries[org.industry as keyof typeof t.enums.industries] ?? org.industry : '—' },
              { label: t.onboarding.company.location, value: org.location || '—' },
              { label: t.onboarding.company.website, value: org.website || '—' },
              { label: t.common.description, value: org.description || '—' },
            ]} />
          )}
        </Card>
        <div className="space-y-6">
          <Card title={O.members}>
            <ul className="space-y-3">
              {data.members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3">
                  <Avatar name={m.full_name} size="sm" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{m.full_name}</p><p className="truncate text-xs text-ink-500">{m.headline || t.roles[m.role as keyof typeof t.roles]}</p></div>
                  <Badge tone="neutral">{t.enums.memberRole[m.member_role as keyof typeof t.enums.memberRole]}</Badge>
                  {data.can_manage && m.user_id !== me.profile.id && (m.member_role !== 'owner' || data.my_role === 'owner' || me.profile.role === 'admin') && (
                    <form action={removeMember}>
                      <input type="hidden" name="organization_id" value={org.id} /><input type="hidden" name="user_id" value={m.user_id} />
                      <button type="submit" className="btn-ghost btn-sm text-danger-700" aria-label={`${O.removeMember}: ${m.full_name}`}><X className="size-4" aria-hidden /></button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          {data.can_manage && (
            <Card title={O.invite}>
              <InviteMemberForm organizationId={org.id} kind={org.kind} />
              {data.invitations.length > 0 && (
                <div className="mt-5 border-t border-ink-100 pt-4">
                  <p className="mb-2 text-sm font-semibold">{O.pendingInvites}</p>
                  <ul className="space-y-2">
                    {data.invitations.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{i.email} <span className="text-xs text-ink-500">· {t.enums.memberRole[i.member_role as keyof typeof t.enums.memberRole]} · {formatRelative(locale, i.created_at)}</span></span>
                        <form action={revokeInvitation}><input type="hidden" name="invitation_id" value={i.id} /><button type="submit" className="btn-ghost btn-sm">{O.revoke}</button></form>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
