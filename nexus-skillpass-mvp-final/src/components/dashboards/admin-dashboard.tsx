import Link from 'next/link';
import { AlertTriangle, Award, BadgeCheck, Building2, CheckCircle2, ClipboardCheck, Clock, FileText, Target, Users } from 'lucide-react';
import { setOrganizationStatus } from '@/actions/admin';
import { Badge, Card, PageHeader, StatCard } from '@/components/ui/primitives';
import { formatHours, formatNumber, formatRelative } from '@/lib/format';
import type { Locale, Messages } from '@/lib/i18n';

export interface AdminOverview {
  stats: {
    users: Record<string, number> | null; organizations: Record<string, number> | null; challenges: Record<string, number> | null;
    applications: number; assignments: number; evidence: Record<string, number> | null; vath_submitted: number; vath_verified: number;
    validations_pending: number; validations_completed: number; credentials_active: number; credentials_revoked: number;
    verified_competencies: number; incidents_open: number;
  };
  pending_organizations: { id: string; name: string; kind: string; created_at: string; location: string; website: string }[];
  recent_audit: { id: string; action: string; entity_type: string; created_at: string; actor_name: string | null; subject_name: string | null }[];
  open_incidents: { id: string; category: string; description: string; status: string; created_at: string }[];
}

const sum = (r: Record<string, number> | null) => Object.values(r ?? {}).reduce((a, b) => a + Number(b), 0);

export function AdminDashboard({ data, t, locale }: { data: AdminOverview; t: Messages; locale: Locale }) {
  const A = t.dashboard.admin;
  const s = data.stats;
  return (
    <>
      <PageHeader kicker="AINDEV" title={A.title} subtitle={A.subtitle} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Users className="size-5" />} label={A.users} value={formatNumber(locale, sum(s.users))}
          hint={Object.entries(s.users ?? {}).map(([k, v]) => `${t.roles[k as keyof typeof t.roles] ?? k}: ${v}`).join(' · ')} href="/admin/users" />
        <StatCard icon={<Building2 className="size-5" />} label={A.organizations} value={formatNumber(locale, sum(s.organizations))}
          hint={`${data.pending_organizations.length} ${t.status.organization.pending.toLowerCase()}`} href="/admin/organizations" />
        <StatCard icon={<Target className="size-5" />} label={A.challenges} value={formatNumber(locale, sum(s.challenges))}
          hint={`${s.challenges?.active ?? 0} ${t.status.challenge.active.toLowerCase()} · ${s.challenges?.recruiting ?? 0} ${t.status.challenge.recruiting.toLowerCase()}`} href="/challenges?scope=all" />
        <StatCard icon={<FileText className="size-5" />} label={A.applications} value={formatNumber(locale, s.applications)} hint={`${s.assignments} ${A.assignments.toLowerCase()}`} href="/admin/applications" />
        <StatCard icon={<Clock className="size-5" />} label={A.vathVerified} value={formatHours(locale, s.vath_verified)} hint={`${formatHours(locale, s.vath_submitted)} ${A.vathSubmitted.toLowerCase()}`} href="/admin/vath" accent />
        <StatCard icon={<ClipboardCheck className="size-5" />} label={A.validationsPending} value={s.validations_pending} hint={`${s.validations_completed} ${A.validationsCompleted.toLowerCase()}`} href="/admin/validations" />
        <StatCard icon={<Award className="size-5" />} label={A.credentialsActive} value={s.credentials_active} hint={`${s.credentials_revoked} ${A.credentialsRevoked.toLowerCase()}`} href="/admin/credentials" />
        <StatCard icon={<AlertTriangle className="size-5" />} label={A.incidentsOpen} value={s.incidents_open} hint={`${s.verified_competencies} ${A.verifiedCompetencies.toLowerCase()}`} href="/admin/incidents" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={A.pendingOrgs} className="lg:col-span-2">
          {data.pending_organizations.length === 0 ? <p className="text-sm text-ink-500">{A.noPending}</p> : (
            <ul className="divide-y divide-ink-100">
              {data.pending_organizations.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-semibold">{o.name}</p>
                    <p className="text-xs text-ink-500">{t.roles[o.kind as 'company' | 'university'] ?? o.kind} · {o.location || '—'} · {formatRelative(locale, o.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <form action={setOrganizationStatus}>
                      <input type="hidden" name="organization_id" value={o.id} /><input type="hidden" name="status" value="verified" />
                      <button type="submit" className="btn-primary btn-sm"><CheckCircle2 className="size-4" aria-hidden /> {A.verify}</button>
                    </form>
                    <form action={setOrganizationStatus}>
                      <input type="hidden" name="organization_id" value={o.id} /><input type="hidden" name="status" value="rejected" />
                      <button type="submit" className="btn-danger btn-sm">{A.reject}</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={A.openIncidents} action={<Link href="/admin/incidents" className="text-sm font-semibold text-ink-600 hover:text-ink-950">{t.common.viewAll}</Link>}>
          {data.open_incidents.length === 0 ? <p className="text-sm text-ink-500">{A.noIncidents}</p> : (
            <ul className="space-y-3">
              {data.open_incidents.slice(0, 5).map((i) => (
                <li key={i.id} className="text-sm">
                  <Badge tone="warning">{t.status.incident[i.status as keyof typeof t.status.incident]}</Badge>
                  <p className="mt-1 line-clamp-2 text-ink-700">{i.description}</p>
                  <p className="text-xs text-ink-400">{formatRelative(locale, i.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={A.recentAudit} className="mt-6" action={<Link href="/admin/audit" className="text-sm font-semibold text-ink-600 hover:text-ink-950">{t.common.viewAll}</Link>} bodyClassName="overflow-x-auto">
        <table className="table min-w-[560px]">
          <thead><tr><th scope="col">{t.common.date}</th><th scope="col">{t.common.actions}</th><th scope="col">Actor</th><th scope="col">{t.roles.student}</th></tr></thead>
          <tbody>
            {data.recent_audit.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-ink-500">{formatRelative(locale, l.created_at)}</td>
                <td><span className="font-mono text-xs">{l.action}</span> <span className="text-xs text-ink-400">({l.entity_type})</span></td>
                <td>{l.actor_name ?? '—'}</td>
                <td>{l.subject_name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {(['users', 'organizations', 'applications', 'evidence', 'vath', 'validations', 'competencies', 'credentials', 'incidents', 'audit'] as const).map((k) => (
          <Link key={k} href={`/admin/${k}`} className="btn-outline btn-sm"><BadgeCheck className="size-3.5" aria-hidden /> {A.sections[k]}</Link>
        ))}
      </div>
    </>
  );
}
