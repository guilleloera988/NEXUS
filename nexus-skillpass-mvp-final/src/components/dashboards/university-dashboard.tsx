import { Award, BadgeCheck, Building2, Clock, Download, FileText, GraduationCap, Target, Users } from 'lucide-react';
import { ColumnChart, HBarChart, ParticipationBars } from '@/components/charts';
import { Alert, Badge, Card, EmptyState, PageHeader, StatCard } from '@/components/ui/primitives';
import { formatHours, formatNumber } from '@/lib/format';
import { fmt, intlLocale, type Locale, type Messages } from '@/lib/i18n';

export interface UniversityData {
  organization: { id: string; name: string; campus: string; verification_status: string } | null;
  pending?: boolean;
  stats?: Record<'students' | 'participating' | 'challenges' | 'companies' | 'verified_vath' | 'completed_projects' | 'verified_competencies' | 'applications', number>;
  vath_by_career?: { career: string; hours: number; students: number }[];
  participation_by_career?: { career: string; students: number; participating: number }[];
  competencies_top?: { slug: string; name_es: string; name_en: string; students: number }[];
  trend?: { month: string; vath: number; credentials: number }[];
  companies?: { name: string; is_demo: boolean; challenges: number; students: number; verified_hours: number }[];
  students?: { id: string; full_name: string; career: string; semester: number | null; challenges: number; verified_vath: number; competencies: number; credentials: number; active: boolean; is_demo: boolean }[];
}

export function UniversityDashboard({ data, t, locale }: { data: UniversityData; t: Messages; locale: Locale }) {
  const U = t.dashboard.university;
  if (!data.organization) return <><PageHeader title={t.nav.analytics} /><EmptyState title={U.noOrg} /></>;
  if (data.pending || !data.stats) {
    return (
      <>
        <PageHeader kicker={t.roles.university} title={data.organization.name} subtitle={U.subtitle} />
        <Alert tone="warning">{U.pending}</Alert>
      </>
    );
  }
  const s = data.stats;
  const monthLabel = (m: string) => new Intl.DateTimeFormat(intlLocale(locale), { month: 'short', timeZone: 'UTC' }).format(new Date(`${m}-15T12:00:00Z`));
  const students = data.students ?? [];
  return (
    <>
      <PageHeader kicker={t.roles.university} title={data.organization.name} subtitle={U.subtitle}
        actions={<a href="/api/university/students.csv" className="btn-outline"><Download className="size-4" aria-hidden /> {U.exportCsv}</a>} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Users className="size-5" />} label={U.students} value={formatNumber(locale, s.students)} hint={fmt(U.participatingOf, { a: s.participating, b: s.students })} />
        <StatCard icon={<Clock className="size-5" />} label={U.verifiedVath} value={formatHours(locale, s.verified_vath)} accent />
        <StatCard icon={<Award className="size-5" />} label={U.completedProjects} value={formatNumber(locale, s.completed_projects)} />
        <StatCard icon={<BadgeCheck className="size-5" />} label={U.verifiedCompetencies} value={formatNumber(locale, s.verified_competencies)} />
        <StatCard icon={<Target className="size-5" />} label={U.challenges} value={formatNumber(locale, s.challenges)} />
        <StatCard icon={<Building2 className="size-5" />} label={U.companies} value={formatNumber(locale, s.companies)} />
        <StatCard icon={<GraduationCap className="size-5" />} label={U.participating} value={formatNumber(locale, s.participating)} />
        <StatCard icon={<FileText className="size-5" />} label={U.applications} value={formatNumber(locale, s.applications)} />
      </div>

      <p className="mt-3 text-xs text-ink-500">{U.disclaimer}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={U.vathByCareer}>
          {(data.vath_by_career ?? []).length === 0 ? <p className="text-sm text-ink-500">{U.noData}</p> : (
            <HBarChart tableSummary={U.viewTable} columns={[U.careerCol, U.vathCol]}
              data={(data.vath_by_career ?? []).map((r) => ({ label: r.career, value: Number(r.hours), display: `${formatHours(locale, r.hours)} h` }))} />
          )}
        </Card>
        <Card title={U.topCompetencies}>
          {(data.competencies_top ?? []).length === 0 ? <p className="text-sm text-ink-500">{U.noData}</p> : (
            <HBarChart tableSummary={U.viewTable} columns={[U.competenciesCol, U.students]}
              data={(data.competencies_top ?? []).map((c) => ({ label: locale === 'es' ? c.name_es : c.name_en, value: Number(c.students), display: fmt(U.studentsCount, { n: c.students }) }))} />
          )}
        </Card>
        <Card title={U.participationByCareer}>
          <ParticipationBars tableSummary={U.viewTable}
            labels={{ part: U.participatingLabel, rest: U.notParticipating, category: U.careerCol, total: U.total }}
            data={(data.participation_by_career ?? []).map((r) => ({ label: r.career, total: Number(r.students), part: Number(r.participating) }))} />
        </Card>
        <Card title={U.trend}>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold text-ink-600">{U.trendVath}</p>
              <ColumnChart tableSummary={U.viewTable} columns={[U.month, U.trendVath]}
                data={(data.trend ?? []).map((m) => ({ label: monthLabel(m.month), value: Number(m.vath), display: `${formatHours(locale, m.vath)} h` }))} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-ink-600">{U.trendCredentials}</p>
              <ColumnChart tableSummary={U.viewTable} columns={[U.month, U.trendCredentials]}
                data={(data.trend ?? []).map((m) => ({ label: monthLabel(m.month), value: Number(m.credentials), display: formatNumber(locale, m.credentials) }))} />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={U.companiesTitle}>
          {(data.companies ?? []).length === 0 ? <p className="text-sm text-ink-500">{U.noData}</p> : (
            <ul className="space-y-3">
              {(data.companies ?? []).map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="text-xs text-ink-500">{c.challenges} {U.challengesCol.toLowerCase()} · {fmt(U.studentsCount, { n: c.students })}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums">{formatHours(locale, c.verified_hours)} h</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={U.studentsTitle} className="lg:col-span-2" bodyClassName="overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                <th scope="col">{t.common.name}</th><th scope="col">{U.careerCol}</th><th scope="col">{U.semesterCol}</th>
                <th scope="col" className="text-right">{U.challengesCol}</th><th scope="col" className="text-right">{U.vathCol}</th>
                <th scope="col" className="text-right">{U.competenciesCol}</th><th scope="col" className="text-right">{U.credentialsCol}</th><th scope="col">{t.common.status}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st) => (
                <tr key={st.id}>
                  <td className="font-semibold text-ink-900">{st.full_name}</td>
                  <td className="text-ink-600">{st.career || '—'}</td>
                  <td className="tabular-nums text-ink-600">{st.semester ?? '—'}</td>
                  <td className="text-right tabular-nums">{st.challenges}</td>
                  <td className="text-right font-semibold tabular-nums">{formatHours(locale, st.verified_vath)}</td>
                  <td className="text-right tabular-nums">{st.competencies}</td>
                  <td className="text-right tabular-nums">{st.credentials}</td>
                  <td>{st.active ? <Badge tone="success">{U.activeLabel}</Badge> : <Badge tone="neutral">{U.inactiveLabel}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
