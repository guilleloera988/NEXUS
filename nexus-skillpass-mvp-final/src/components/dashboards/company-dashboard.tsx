import Link from 'next/link';
import { Award, BadgeCheck, ClipboardCheck, FileClock, Plus, Target, UserPlus, Users } from 'lucide-react';
import { Alert, Avatar, Badge, Card, EmptyState, PageHeader, ProgressBar, StatCard, StatusBadge } from '@/components/ui/primitives';
import { formatDate, formatHours, formatRelative } from '@/lib/format';
import type { Locale, Messages } from '@/lib/i18n';
import type { ChallengeStatus, Me } from '@/lib/types';

interface CompanyDashboardData {
  organization: { id: string; name: string; verification_status: string; industry: string; location: string } | null;
  can_manage: boolean;
  stats: Record<'challenges' | 'active' | 'open' | 'completed' | 'participants' | 'pending_applications' | 'pending_validations' | 'evidence_pending' | 'credentials' | 'verified_vath', number>;
  challenges: { id: string; title: string; status: ChallengeStatus; end_date: string | null; max_participants: number; estimated_vath: number; participants: number; pending_applications: number; pending_validations: number; verified_hours: number; tasks_total: number; tasks_done: number }[];
  pending_validations: { id: string; created_at: string; challenge_title: string; student_name: string; hours: number; evidence_count: number }[];
  recent_applications: { id: string; created_at: string; status: string; match_score: number | null; challenge_id: string; challenge_title: string; student_name: string; career: string }[];
  observed_talent: { code: string; issued_at: string; student_id: string; full_name: string; career: string; verified_hours: number; challenge_title: string; competencies: number }[];
}

export function CompanyDashboard({ me, data, t, locale }: { me: Me; data: CompanyDashboardData; t: Messages; locale: Locale }) {
  const C = t.dashboard.company;
  const supervisor = me.profile.role === 'supervisor';
  if (!data.organization) {
    return (
      <>
        <PageHeader title={t.nav.dashboard} />
        <EmptyState title={C.noOrg} action={<Link href="/organization" className="btn-primary btn-sm">{t.nav.organization}</Link>} />
      </>
    );
  }
  const org = data.organization;
  const firstCandidates = data.recent_applications[0];
  return (
    <>
      <PageHeader kicker={t.roles[me.profile.role]} title={org.name} subtitle={supervisor ? C.supervisorSubtitle : C.subtitle}
        actions={<>
          {data.can_manage && <Link href="/challenges/new" className="btn-primary"><Plus className="size-4" aria-hidden /> {C.createChallenge}</Link>}
          {data.can_manage && <Link href={firstCandidates ? `/challenges/${firstCandidates.challenge_id}?tab=candidates` : '/challenges?scope=mine'} className="btn-outline"><UserPlus className="size-4" aria-hidden /> {C.reviewCandidates}</Link>}
          <Link href="/validations" className={data.can_manage ? 'btn-outline' : 'btn-primary'}><ClipboardCheck className="size-4" aria-hidden /> {C.validate}</Link>
          <Link href="/talent" className="btn-outline"><Users className="size-4" aria-hidden /> {C.exploreTalent}</Link>
        </>} />

      {org.verification_status !== 'verified' && <Alert tone="warning" className="mb-5">{C.pendingVerification}</Alert>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Target className="size-5" />} label={C.active} value={data.stats.active} hint={`${data.stats.open} ${C.open.toLowerCase()} · ${data.stats.challenges} ${C.challenges.toLowerCase()}`} href="/challenges?scope=mine" />
        <StatCard icon={<Users className="size-5" />} label={C.participants} value={data.stats.participants} hint={`${data.stats.pending_applications} ${C.pendingApplications.toLowerCase()}`} />
        <StatCard icon={<ClipboardCheck className="size-5" />} label={C.pendingValidations} value={data.stats.pending_validations} accent={data.stats.pending_validations > 0}
          hint={`${data.stats.evidence_pending} ${C.evidencePending.toLowerCase()}`} href="/validations" />
        <StatCard icon={<Award className="size-5" />} label={C.credentials} value={data.stats.credentials} hint={`${formatHours(locale, data.stats.verified_vath)} ${C.verifiedVath}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={C.myChallenges} action={<Link href="/challenges?scope=mine" className="text-sm font-semibold text-ink-600 hover:text-ink-950">{t.common.viewAll}</Link>}>
            {data.challenges.length === 0 ? (
              <EmptyState icon={<Target className="size-6" />} title={C.emptyChallenges} text={C.emptyChallengesText}
                action={data.can_manage ? <Link href="/challenges/new" className="btn-primary btn-sm">{C.createChallenge}</Link> : undefined} />
            ) : (
              <ul className="divide-y divide-ink-100">
                {data.challenges.map((c) => (
                  <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/challenges/${c.id}`} className="font-bold text-ink-950 hover:underline">{c.title}</Link>
                        <p className="text-xs text-ink-500">
                          {c.participants}/{c.max_participants} {t.challenges.participants.toLowerCase()} · {formatHours(locale, c.verified_hours)} VATH
                          {c.end_date ? ` · ${t.common.until} ${formatDate(locale, c.end_date)}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {c.pending_applications > 0 && <Badge tone="gold">{c.pending_applications} {C.pendingApplications.toLowerCase()}</Badge>}
                        {c.pending_validations > 0 && <Badge tone="warning">{c.pending_validations} {C.pendingValidations.toLowerCase()}</Badge>}
                        <StatusBadge status={c.status} label={t.status.challenge[c.status]} />
                      </div>
                    </div>
                    {c.tasks_total > 0 && <div className="mt-2 max-w-md"><ProgressBar value={c.tasks_done} max={c.tasks_total} label={t.workspace.progress} /></div>}
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      <Link href={`/challenges/${c.id}`} className="link text-xs">{t.challenges.detail.manage}</Link>
                      {['active', 'under_review', 'recruiting', 'published'].includes(c.status) && c.participants > 0 && <Link href={`/workspace/${c.id}`} className="link text-xs">{t.challenges.openWorkspace}</Link>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title={C.pendingTitle} action={<Link href="/validations" className="text-sm font-semibold text-ink-600 hover:text-ink-950">{t.common.viewAll}</Link>}>
            {data.pending_validations.length === 0 ? <p className="text-sm text-ink-500">{t.validations.empty}</p> : (
              <ul className="space-y-3">
                {data.pending_validations.map((v) => (
                  <li key={v.id} className="flex items-center gap-3">
                    <Avatar name={v.student_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{v.student_name}</p>
                      <p className="truncate text-xs text-ink-500">{v.challenge_title} · {formatHours(locale, v.hours)} h · <FileClock className="inline size-3" aria-hidden /> {v.evidence_count}</p>
                    </div>
                    <Link href={`/validations/${v.id}`} className="btn-primary btn-sm">{t.validations.review}</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {data.can_manage && (
            <Card title={C.recentApplications}>
              {data.recent_applications.length === 0 ? <p className="text-sm text-ink-500">{t.challenges.detail.candidatesEmpty}</p> : (
                <ul className="space-y-3">
                  {data.recent_applications.map((a) => (
                    <li key={a.id}>
                      <Link href={`/challenges/${a.challenge_id}?tab=candidates`} className="flex items-center gap-3 rounded-lg hover:bg-ink-50">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-gold-400 text-xs font-extrabold">{a.match_score ?? '—'}%</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{a.student_name}</span>
                          <span className="block truncate text-xs text-ink-500">{a.challenge_title} · {formatRelative(locale, a.created_at)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          <Card title={C.observedTalent}>
            <p className="mb-3 text-xs text-ink-500">{C.observedHelp}</p>
            {data.observed_talent.length === 0 ? <p className="text-sm text-ink-500">—</p> : (
              <ul className="space-y-3">
                {data.observed_talent.map((s) => (
                  <li key={s.code} className="flex items-center gap-3">
                    <Avatar name={s.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{s.full_name}</p>
                      <p className="truncate text-xs text-ink-500">{s.challenge_title}</p>
                    </div>
                    <Badge tone="success"><BadgeCheck className="size-3.5" aria-hidden />{formatHours(locale, s.verified_hours)} h</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
