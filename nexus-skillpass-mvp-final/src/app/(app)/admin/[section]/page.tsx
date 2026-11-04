import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import { setOrganizationStatus, setUserRole } from '@/actions/admin';
import { CompetencyDialog, IncidentForm, RevokeCredentialDialog, type AdminCompetency } from '@/components/admin-client';
import { Alert, Badge, LinkTabs, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { formatDate, formatDateTime, formatHours, formatNumber } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/server';
import type { Messages } from '@/lib/i18n';
import { getMe, read } from '@/lib/server/backend';

const SECTIONS = ['users', 'organizations', 'challenges', 'applications', 'evidence', 'vath', 'validations', 'competencies', 'credentials', 'incidents', 'audit'] as const;
type Section = (typeof SECTIONS)[number];
const PAGE_SIZE = 50;

/* eslint-disable @typescript-eslint/no-explicit-any -- rows are section-specific JSON from sp_admin_list */
type Row = Record<string, any>;

export async function generateMetadata({ params }: PageProps<'/admin/[section]'>): Promise<Metadata> {
  const { section } = await params;
  const { t } = await getMessages();
  const label = (t.dashboard.admin.sections as Record<string, string>)[section];
  return { title: label ? `${label} · Talent OS` : 'Talent OS' };
}

function filtersFor(section: Section, t: Messages): { value: string; label: string }[] {
  const s = t.status;
  const map = <T extends Record<string, string>>(o: T) => Object.entries(o).map(([value, label]) => ({ value, label }));
  switch (section) {
    case 'users': return map({ student: t.roles.student, company: t.roles.company, supervisor: t.roles.supervisor, university: t.roles.university, admin: t.roles.admin });
    case 'organizations': return map(t.dashboard.admin.kinds);
    case 'challenges': return map(s.challenge);
    case 'applications': return map(s.application);
    case 'evidence': return map(s.evidence);
    case 'vath': return map(s.vath);
    case 'validations': return [...map(s.request), ...map(s.outcome)];
    case 'credentials': return map(s.credential);
    case 'incidents': return map(s.incident);
    default: return [];
  }
}

function changeText(before: Row | null, after: Row | null) {
  const keys = Object.keys(after ?? {});
  const show = (v: unknown) => (v === null || v === undefined ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  return keys.slice(0, 4).map((k) => (before && k in before ? `${k}: ${show(before[k])} → ${show(after?.[k])}` : `${k}: ${show(after?.[k])}`)).join(' · ');
}

function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty: string }) {
  const rows = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead className="border-b border-ink-100 bg-ink-50/70 text-xs uppercase tracking-wide text-ink-500">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-ink-100">{rows ? children : <tr><td colSpan={head.length} className="px-4 py-8 text-center text-ink-500">{empty}</td></tr>}</tbody>
      </table>
    </div>
  );
}

const td = 'px-4 py-3 align-top';

export default async function AdminSectionPage({ params, searchParams }: PageProps<'/admin/[section]'>) {
  const { section: raw } = await params;
  if (!(SECTIONS as readonly string[]).includes(raw)) notFound();
  const section = raw as Section;
  const me = await getMe();
  if (!me) redirect('/login');
  if (me.profile.role !== 'admin') redirect('/dashboard');
  const { t, locale } = await getMessages();
  const A = t.dashboard.admin;
  const C = A.cols;
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 100) : '';
  const page = Math.max(1, Math.min(1000, Number.parseInt(typeof sp.page === 'string' ? sp.page : '1', 10) || 1));
  const data = await read<{ items: Row[]; total: number } | null>('sp_admin_list', { entity: section, q, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  if (!data) redirect('/dashboard');
  const { items, total } = data;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (next: { q?: string; page?: number }) => {
    const u = new URLSearchParams();
    const nq = next.q ?? q;
    if (nq) u.set('q', nq);
    if ((next.page ?? 1) > 1) u.set('page', String(next.page));
    const s = u.toString();
    return `/admin/${section}${s ? `?${s}` : ''}`;
  };
  const filters = filtersFor(section, t);
  const dt = (v: string | null) => (v ? formatDate(locale, v) : '—');
  const demo = (r: Row) => (r.is_demo ? <Badge tone="gold" className="ml-1.5">DEMO</Badge> : null);

  let body: ReactNode;
  switch (section) {
    case 'users':
      body = (
        <Table empty={A.noResults} head={[C.user, C.role, C.organization, C.onboarding, C.publicPass, t.common.created, A.changeRole]}>
          {items.map((r) => (
            <tr key={r.id}>
              <td className={td}><p className="font-semibold">{r.full_name || '—'}{demo(r)}</p>{r.career && <p className="text-xs text-ink-500">{r.career}</p>}</td>
              <td className={td}><Badge tone={r.role === 'admin' ? 'dark' : 'neutral'}>{t.roles[r.role as keyof typeof t.roles]}</Badge></td>
              <td className={td}>{r.university ?? r.organizations ?? '—'}</td>
              <td className={td}>{r.onboarding_completed ? t.common.yes : t.common.no}</td>
              <td className={td}>{r.role === 'student' ? (r.skillpass_public ? t.common.yes : t.common.no) : '—'}</td>
              <td className={`${td} whitespace-nowrap`}>{dt(r.created_at)}</td>
              <td className={td}>
                {r.role === 'admin' || r.id === me.profile.id ? <span className="text-xs text-ink-400">{A.protectedRole}</span> : (
                  <form action={setUserRole} className="flex items-center gap-1.5">
                    <input type="hidden" name="user_id" value={r.id} />
                    <label className="sr-only" htmlFor={`role-${r.id}`}>{A.changeRole}: {r.full_name}</label>
                    <select id={`role-${r.id}`} name="role" defaultValue={r.role} className="select h-9 w-36 py-1 text-xs">
                      {(['student', 'company', 'supervisor', 'university'] as const).map((role) => <option key={role} value={role}>{t.roles[role]}</option>)}
                    </select>
                    <button type="submit" className="btn-outline btn-sm">{t.common.save}</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </Table>
      );
      break;
    case 'organizations':
      body = (
        <Table empty={A.noResults} head={[C.organization, C.kind, t.common.status, C.members, t.dashboard.admin.challenges, C.students, t.common.actions]}>
          {items.map((r) => (
            <tr key={r.id}>
              <td className={td}><p className="font-semibold">{r.name}{demo(r)}</p><p className="text-xs text-ink-500">{[r.industry && (t.enums.industries as Record<string, string>)[r.industry], r.location].filter(Boolean).join(' · ')}</p></td>
              <td className={td}>{(A.kinds as Record<string, string>)[r.kind]}</td>
              <td className={td}><StatusBadge status={r.verification_status} label={t.status.organization[r.verification_status as keyof typeof t.status.organization]} /></td>
              <td className={td}>{formatNumber(locale, r.members)}</td>
              <td className={td}>{formatNumber(locale, r.challenges)}</td>
              <td className={td}>{formatNumber(locale, r.students)}</td>
              <td className={td}>
                {r.kind !== 'aindev' && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.verification_status !== 'verified' && <form action={setOrganizationStatus}><input type="hidden" name="organization_id" value={r.id} /><input type="hidden" name="status" value="verified" /><button type="submit" className="btn-dark btn-sm">{A.verify}</button></form>}
                    {r.verification_status !== 'rejected' && <form action={setOrganizationStatus}><input type="hidden" name="organization_id" value={r.id} /><input type="hidden" name="status" value="rejected" /><button type="submit" className="btn-ghost btn-sm text-danger-700">{A.reject}</button></form>}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      );
      break;
    case 'challenges':
      body = (
        <Table empty={A.noResults} head={[C.challenge, C.organization, t.common.status, t.challenges.fields.compensationType, 'VATH', C.applications, C.participants]}>
          {items.map((r) => (
            <tr key={r.id}>
              <td className={td}><Link href={`/challenges/${r.id}`} className="font-semibold hover:underline">{r.title}</Link>{demo(r)}</td>
              <td className={td}>{r.organization}</td>
              <td className={td}><StatusBadge status={r.status} label={t.status.challenge[r.status as keyof typeof t.status.challenge]} /></td>
              <td className={td}>{t.enums.compensation[r.compensation_type as keyof typeof t.enums.compensation]}</td>
              <td className={td}>{formatHours(locale, r.estimated_vath)}</td>
              <td className={td}>{formatNumber(locale, r.applications)}</td>
              <td className={td}>{formatNumber(locale, r.participants)}</td>
            </tr>
          ))}
        </Table>
      );
      break;
    case 'applications':
      body = (
        <Table empty={A.noResults} head={[C.student, C.challenge, t.common.status, C.match, t.common.created, C.decidedBy]}>
          {items.map((r) => (
            <tr key={r.id}>
              <td className={td}>{r.student}</td><td className={td}>{r.challenge}</td>
              <td className={td}><StatusBadge status={r.status} label={t.status.application[r.status as keyof typeof t.status.application]} /></td>
              <td className={td}>{formatNumber(locale, r.match_score)}%</td><td className={`${td} whitespace-nowrap`}>{dt(r.created_at)}</td>
              <td className={td}>{r.decided_by ? `${r.decided_by} · ${dt(r.decided_at)}` : '—'}</td>
            </tr>
          ))}
        </Table>
      );
      break;
    case 'evidence':
      body = (
        <Table empty={A.noResults} head={[t.common.title, C.student, C.challenge, C.kind, t.common.status, C.version, C.visibility]}>
          {items.map((r) => (
            <tr key={r.id}>
              <td className={td}>
                <p className="font-semibold">{r.title}</p>
                {r.has_file ? <a href={`/api/evidence/${r.id}/file`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:underline">{t.common.open}<ExternalLink className="size-3" aria-hidden /></a>
                  : r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:underline">{t.common.link}<ExternalLink className="size-3" aria-hidden /></a> : null}
              </td>
              <td className={td}>{r.student}</td><td className={td}>{r.challenge}</td>
              <td className={td}>{t.enums.evidenceKind[r.kind as keyof typeof t.enums.evidenceKind]}</td>
              <td className={td}><StatusBadge status={r.status} label={t.status.evidence[r.status as keyof typeof t.status.evidence]} /></td>
              <td className={td}>v{r.version}</td><td className={td}>{r.is_public ? t.common.yes : t.common.no}</td>
            </tr>
          ))}
        </Table>
      );
      break;
    case 'vath':
      body = (
        <Table empty={A.noResults} head={[t.common.date, C.student, C.challenge, t.workspace.vath.fields.activity, C.submitted, C.verified, t.common.status, C.validatedBy]}>
          {items.map((r) => (
            <tr key={r.id}>
              <td className={`${td} whitespace-nowrap`}>{dt(r.activity_date)}</td><td className={td}>{r.student}</td><td className={td}>{r.challenge}</td>
              <td className={`${td} max-w-xs`}><span className="line-clamp-2">{r.activity}</span></td>
              <td className={td}>{formatHours(locale, r.submitted_hours)}</td>
              <td className={td}>{r.verified_hours === null ? '—' : formatHours(locale, r.verified_hours)}</td>
              <td className={td}><StatusBadge status={r.status} label={t.status.vath[r.status as keyof typeof t.status.vath]} /></td>
              <td className={td}>{r.validated_by ? `${r.validated_by} · ${dt(r.validated_at)}` : '—'}</td>
            </tr>
          ))}
        </Table>
      );
      break;
    case 'validations':
      body = (
        <Table empty={A.noResults} head={[C.student, C.challenge, t.common.status, C.outcome, C.decisions, t.common.created, C.validatedBy]}>
          {items.map((r) => (
            <tr key={r.id}>
              <td className={td}><Link href={`/validations/${r.id}`} className="font-semibold hover:underline">{r.student}</Link></td><td className={td}>{r.challenge}</td>
              <td className={td}><StatusBadge status={r.status} label={t.status.request[r.status as keyof typeof t.status.request]} /></td>
              <td className={td}>{r.outcome ? <StatusBadge status={r.outcome} label={t.status.outcome[r.outcome as keyof typeof t.status.outcome]} /> : '—'}</td>
              <td className={td}>{formatNumber(locale, r.decisions)}</td><td className={`${td} whitespace-nowrap`}>{dt(r.created_at)}</td>
              <td className={td}>{r.completed_by ? `${r.completed_by} · ${dt(r.completed_at)}` : '—'}</td>
            </tr>
          ))}
        </Table>
      );
      break;
    case 'competencies':
      body = (
        <Table empty={A.noResults} head={[t.common.name, C.slug, C.category, C.active, C.usage, t.common.actions]}>
          {items.map((r) => (
            <tr key={r.id}>
              <td className={td}><p className="font-semibold">{locale === 'en' ? r.name_en : r.name_es}</p><p className="text-xs text-ink-500">{locale === 'en' ? r.name_es : r.name_en}</p></td>
              <td className={`${td} font-mono text-xs`}>{r.slug}</td>
              <td className={td}>{t.enums.category[r.category as keyof typeof t.enums.category]}</td>
              <td className={td}>{r.is_active ? t.common.yes : t.common.no}</td>
              <td className={td}>{fmt(A.usageText, { a: r.assessments, c: r.challenges })}</td>
              <td className={td}><CompetencyDialog competency={r as AdminCompetency} /></td>
            </tr>
          ))}
        </Table>
      );
      break;
    case 'credentials':
      body = (
        <Table empty={A.noResults} head={[C.code, C.student, C.challenge, 'VATH', t.common.status, A.publicStatus, C.issuedBy, t.common.actions]}>
          {items.map((r) => (
            <tr key={r.id}>
              <td className={td}><Link href={`/verify/${r.code}`} className="font-mono text-xs font-semibold hover:underline">{r.code}</Link>{demo(r)}</td>
              <td className={td}>{r.student}</td><td className={td}>{r.challenge}</td>
              <td className={td}>{formatHours(locale, r.verified_hours)}</td>
              <td className={td}>
                <StatusBadge status={r.status === 'active' ? 'verified' : 'rejected'} label={t.status.credential[r.status as keyof typeof t.status.credential]} />
                {r.revoked_at && <p className="mt-1 max-w-[16rem] text-xs text-ink-500">{fmt(A.revokedOn, { date: dt(r.revoked_at), reason: r.revocation_reason })}</p>}
              </td>
              <td className={td}>{r.verification_enabled ? A.publicOn : A.publicOff}</td>
              <td className={td}>{r.issued_by ? `${r.issued_by} · ${dt(r.issued_at)}` : dt(r.issued_at)}</td>
              <td className={td}>{r.status === 'active' && <RevokeCredentialDialog id={r.id} code={r.code} />}</td>
            </tr>
          ))}
        </Table>
      );
      break;
    case 'incidents':
      body = items.length === 0 ? <div className="card card-pad text-center text-sm text-ink-500">{A.noResults}</div> : (
        <ul className="space-y-4">
          {items.map((r) => (
            <li key={r.id} className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{t.enums.incidentCategory[r.category as keyof typeof t.enums.incidentCategory]} · <span className="text-ink-500">{r.entity_type}</span></p>
                  <p className="text-xs text-ink-500">{C.reporter}: {r.reported_by_name ?? '—'} · {formatDateTime(locale, r.created_at)}</p>
                </div>
                <StatusBadge status={r.status === 'resolved' ? 'verified' : r.status === 'dismissed' ? 'archived' : 'pending'} label={t.status.incident[r.status as keyof typeof t.status.incident]} />
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-ink-700">{r.description}</p>
              <div className="mt-4 border-t border-ink-100 pt-4"><IncidentForm id={r.id} status={r.status} resolution={r.resolution ?? ''} /></div>
            </li>
          ))}
        </ul>
      );
      break;
    case 'audit':
      body = (
        <Table empty={A.noResults} head={[t.common.date, C.actor, C.action, C.entity, C.subject, C.change]}>
          {items.map((r) => (
            <tr key={r.id}>
              <td className={`${td} whitespace-nowrap text-xs`}>{formatDateTime(locale, r.created_at)}</td>
              <td className={td}>{r.actor_name ?? 'system'}</td>
              <td className={`${td} font-mono text-xs`}>{r.action}</td>
              <td className={`${td} text-xs`}>{r.entity_type}</td>
              <td className={td}>{r.subject_name ?? '—'}</td>
              <td className={`${td} max-w-sm break-words font-mono text-[11px] text-ink-600`}>{changeText(r.before, r.after) || '—'}</td>
            </tr>
          ))}
        </Table>
      );
      break;
  }

  return (
    <>
      <PageHeader kicker="Talent OS · AINDEV" title={(A.sections as Record<string, string>)[section]} subtitle={fmt(A.total, { n: total })}
        actions={section === 'competencies' ? <CompetencyDialog /> : undefined} />
      <LinkTabs label="Talent OS" active={section} tabs={SECTIONS.map((s) => ({ key: s, label: (A.sections as Record<string, string>)[s], href: `/admin/${s}` }))} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form method="get" role="search" className="flex w-full max-w-md gap-2">
          <label htmlFor="admin-q" className="sr-only">{t.common.search}</label>
          <input id="admin-q" name="q" type="search" defaultValue={q} placeholder={A.searchPlaceholder} className="input" />
          <button type="submit" className="btn-dark">{t.common.search}</button>
        </form>
        {filters.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label={t.common.filter}>
            <Link href={href({ q: '' })} className={`chip ${q === '' ? 'chip-active' : ''}`} aria-current={q === '' ? 'true' : undefined}>{t.common.all}</Link>
            {filters.map((f) => <Link key={f.value} href={href({ q: f.value })} className={`chip ${q === f.value ? 'chip-active' : ''}`} aria-current={q === f.value ? 'true' : undefined}>{f.label}</Link>)}
          </div>
        )}
      </div>
      {(section === 'audit' || section === 'validations') && <Alert tone="info" className="mb-4"><span className="inline-flex items-center gap-1.5"><Info className="size-4" aria-hidden />{A.integrityNote}</span></Alert>}
      {body}
      {pages > 1 && (
        <nav aria-label={t.common.page} className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href({ page: page - 1 })} className="btn-outline btn-sm">{t.common.previous}</Link> : <span />}
          <span className="text-ink-500">{fmt(A.pageInfo, { page, pages })}</span>
          {page < pages ? <Link href={href({ page: page + 1 })} className="btn-outline btn-sm">{t.common.next}</Link> : <span />}
        </nav>
      )}
    </>
  );
}
