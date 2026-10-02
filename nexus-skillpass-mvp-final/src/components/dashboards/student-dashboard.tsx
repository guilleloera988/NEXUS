import Link from 'next/link';
import { ArrowRight, Award, BadgeCheck, Briefcase, CheckCircle2, Circle, Clock, Compass, Hourglass, Target } from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader, ProgressBar, ProgressRing, StatCard, StatusBadge } from '@/components/ui/primitives';
import { formatDate, formatHours, formatRelative } from '@/lib/format';
import { fmt, type Locale, type Messages } from '@/lib/i18n';
import type { ApplicationStatus, Match, Me, NotificationItem } from '@/lib/types';
import { NotificationText } from '../notification-text';

interface StudentDashboardData {
  stats: { active_challenges: number; completed_challenges: number; verified_vath: number; pending_vath: number; draft_vath: number; pending_validations: number; verified_competencies: number; credentials: number; open_applications: number };
  assignments: { id: string; status: string; challenge_id: string; title: string; challenge_status: string; end_date: string | null; estimated_vath: number; organization_name: string; tasks_total: number; tasks_done: number; verified_hours: number; pending_hours: number; credential_code: string | null }[];
  applications: { id: string; status: ApplicationStatus; challenge_id: string; created_at: string; match_score: number | null; title: string; organization_name: string; decision_note: string }[];
  recommended: { id: string; title: string; summary: string; duration_weeks: number; modality: string; estimated_vath: number; organization_name: string; match: Match }[];
  progress: Record<'profile' | 'applied' | 'assigned' | 'evidence' | 'hours_verified' | 'competency_verified' | 'credential' | 'public', boolean>;
  notifications: NotificationItem[];
}

// jsonb does not preserve key order, so the journey order is defined here.
const STEP_ORDER = ['profile', 'applied', 'assigned', 'evidence', 'hours_verified', 'competency_verified', 'credential', 'public'] as const;

const STEP_LINKS: Record<keyof StudentDashboardData['progress'], string> = {
  profile: '/profile?edit=1', applied: '/challenges', assigned: '/challenges', evidence: '/challenges?scope=participating',
  hours_verified: '/challenges?scope=participating', competency_verified: '/challenges?scope=participating', credential: '/my-skillpass', public: '/my-skillpass?tab=privacy',
};

export function StudentDashboard({ me, data, t, locale }: { me: Me; data: StudentDashboardData; t: Messages; locale: Locale }) {
  const S = t.dashboard.student;
  const active = data.assignments.find((a) => a.status === 'active');
  const steps = STEP_ORDER;
  const done = steps.filter((s) => data.progress[s]).length;
  const next = steps.find((s) => !data.progress[s]);
  const firstName = me.profile.full_name.split(' ')[0];

  return (
    <>
      <PageHeader kicker={t.roles.student} title={fmt(t.dashboard.hello, { name: firstName })} subtitle={S.subtitle}
        actions={<>
          {active && <Link href={`/workspace/${active.challenge_id}`} className="btn-primary">{S.continue} <ArrowRight className="size-4" aria-hidden /></Link>}
          <Link href="/challenges" className={active ? 'btn-outline' : 'btn-primary'}>{S.explore}</Link>
        </>} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard icon={<Target className="size-5" />} label={S.activeChallenges} value={data.stats.active_challenges} href="/challenges?scope=participating" />
        <StatCard icon={<Briefcase className="size-5" />} label={S.completedChallenges} value={data.stats.completed_challenges} />
        <StatCard icon={<Clock className="size-5" />} label={S.verifiedVath} value={formatHours(locale, data.stats.verified_vath)} accent
          hint={data.stats.pending_vath > 0 ? fmt(S.pendingHours, { hours: formatHours(locale, data.stats.pending_vath) }) : data.stats.draft_vath > 0 ? fmt(S.draftHours, { hours: formatHours(locale, data.stats.draft_vath) }) : undefined} />
        <StatCard icon={<Hourglass className="size-5" />} label={S.pendingValidations} value={data.stats.pending_validations} />
        <StatCard icon={<BadgeCheck className="size-5" />} label={S.verifiedCompetencies} value={data.stats.verified_competencies} href="/profile" />
        <StatCard icon={<Award className="size-5" />} label={S.credentials} value={data.stats.credentials} href="/my-skillpass" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={S.myChallenges} action={<Link href="/challenges?scope=participating" className="text-sm font-semibold text-ink-600 hover:text-ink-950">{t.common.viewAll}</Link>}>
            {data.assignments.length === 0 ? (
              <EmptyState icon={<Compass className="size-6" />} title={S.noChallenges} text={S.noChallengesText}
                action={<Link href="/challenges" className="btn-primary btn-sm">{S.explore}</Link>} />
            ) : (
              <ul className="space-y-3">
                {data.assignments.map((a) => (
                  <li key={a.id}>
                    <Link href={`/workspace/${a.challenge_id}`} className="block rounded-xl border border-ink-200 p-4 transition hover:border-gold-300 hover:shadow-[var(--shadow-lift)]">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-ink-950">{a.title}</p>
                          <p className="text-sm text-ink-500">{a.organization_name}{a.end_date ? ` · ${t.common.until} ${formatDate(locale, a.end_date)}` : ''}</p>
                        </div>
                        <div className="flex gap-1.5">
                          {a.credential_code && <Badge tone="success"><BadgeCheck className="size-3.5" aria-hidden />{a.credential_code}</Badge>}
                          <StatusBadge status={a.status === 'completed' ? 'completed' : a.challenge_status} label={a.status === 'completed' ? t.status.assignment.completed : t.status.challenge[a.challenge_status as keyof typeof t.status.challenge]} />
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          {a.tasks_total > 0 ? (
                            <>
                              <div className="mb-1 flex justify-between text-xs text-ink-500"><span>{t.workspace.progress}</span><span>{fmt(S.tasks, { done: a.tasks_done, total: a.tasks_total })}</span></div>
                              <ProgressBar value={a.tasks_done} max={a.tasks_total} label={t.workspace.progress} />
                            </>
                          ) : a.status === 'completed' ? <p className="text-xs text-ink-500">{t.status.assignment.completed} · {formatDate(locale, a.end_date)}</p> : null}
                        </div>
                        <p className="text-sm text-ink-600"><span className="font-bold text-ink-950">{formatHours(locale, a.verified_hours)}</span> VATH
                          {a.pending_hours > 0 && <span className="block text-xs text-warning-700">{fmt(S.pendingHours, { hours: formatHours(locale, a.pending_hours) })}</span>}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {data.recommended.length > 0 && (
            <Card title={S.recommended} action={<Link href="/challenges" className="text-sm font-semibold text-ink-600 hover:text-ink-950">{t.common.viewAll}</Link>}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.recommended.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <Link href={`/challenges/${c.id}`} className="flex h-full gap-3 rounded-xl border border-ink-200 p-4 transition hover:border-gold-300">
                      <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-gold-400 text-sm font-extrabold text-ink-950" title={t.challenges.compatibility}>{c.match.score}%</span>
                      <span className="min-w-0">
                        <span className="block font-bold text-ink-950">{c.title}</span>
                        <span className="block text-xs text-ink-500">{c.organization_name} · {c.duration_weeks} {t.common.weeksShort} · {t.enums.modality[c.modality as keyof typeof t.enums.modality]}</span>
                        <span className="mt-1 line-clamp-2 block text-sm text-ink-600">{c.summary}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title={S.progressTitle}>
            <div className="flex items-center gap-5">
              <ProgressRing value={done} max={steps.length} label={`${Math.round((done / steps.length) * 100)}%`} sublabel="SkillPass" size={112} />
              <div className="min-w-0 flex-1">
                {next ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{S.nextSteps}</p>
                    <Link href={STEP_LINKS[next]} className="mt-1 block font-bold text-ink-950 hover:underline">{S.steps[next]}</Link>
                  </>
                ) : <p className="font-bold text-success-700">{S.allDone}</p>}
              </div>
            </div>
            <ul className="mt-5 space-y-2">
              {steps.map((step) => (
                <li key={step} className="flex items-center gap-2.5 text-sm">
                  {data.progress[step] ? <CheckCircle2 className="size-4 shrink-0 text-success-600" aria-hidden /> : <Circle className="size-4 shrink-0 text-ink-300" aria-hidden />}
                  <span className={data.progress[step] ? 'text-ink-500 line-through decoration-ink-300' : step === next ? 'font-semibold text-ink-950' : 'text-ink-700'}>{S.steps[step]}</span>
                  <span className="sr-only">{data.progress[step] ? t.common.done : ''}</span>
                </li>
              ))}
            </ul>
            <Link href="/my-skillpass" className="btn-dark mt-5 w-full">{S.openSkillpass}</Link>
          </Card>

          <Card title={S.applications}>
            {data.applications.length === 0 ? <p className="text-sm text-ink-500">{S.noApplications}</p> : (
              <ul className="space-y-3">
                {data.applications.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2">
                    <Link href={`/challenges/${a.challenge_id}`} className="min-w-0 hover:underline">
                      <p className="truncate text-sm font-semibold text-ink-900">{a.title}</p>
                      <p className="text-xs text-ink-500">{a.organization_name} · {formatRelative(locale, a.created_at)}</p>
                    </Link>
                    <StatusBadge status={a.status} label={t.status.application[a.status]} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {data.notifications.length > 0 && (
            <Card title={t.notifications.title} action={<Link href="/notifications" className="text-sm font-semibold text-ink-600 hover:text-ink-950">{t.common.viewAll}</Link>}>
              <ul className="space-y-3">
                {data.notifications.map((n) => (
                  <li key={n.id} className="text-sm">
                    <Link href={n.link || '/notifications'} className={`block hover:underline ${n.read_at ? 'text-ink-600' : 'font-semibold text-ink-950'}`}><NotificationText item={n} t={t} /></Link>
                    <span className="text-xs text-ink-400">{formatRelative(locale, n.created_at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
