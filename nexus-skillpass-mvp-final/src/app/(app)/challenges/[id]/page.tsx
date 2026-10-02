import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, BadgeCheck, CalendarDays, Clock, FileText, Lock, MapPin, Pencil, Scale, Shield, Users, Wallet } from 'lucide-react';
import { MatchRing } from '@/components/challenge-card';
import { ApplyPanel, CandidateCard, EndAssignmentDialog, MatchBreakdown, StatusControl, WithdrawButton } from '@/components/challenge-panels';
import { Alert, Avatar, Badge, Card, DefinitionList, EmptyState, LinkTabs, StatusBadge } from '@/components/ui/primitives';
import { competencyName, formatDate, formatDateTime, formatHours } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/server';
import { getMe, read } from '@/lib/server/backend';
import type { ChallengeDetail } from '@/lib/types';

export async function generateMetadata({ params }: PageProps<'/challenges/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const data = /^[0-9a-f-]{36}$/i.test(id) ? await read<ChallengeDetail | null>('sp_challenge', { id }).catch(() => null) : null;
  return { title: data?.challenge.title ?? 'SkillPass' };
}

export default async function ChallengePage({ params, searchParams }: PageProps<'/challenges/[id]'>) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await getMe();
  if (!me) redirect('/login');
  const data = await read<ChallengeDetail | null>('sp_challenge', { id });
  if (!data) notFound();
  const { t, locale } = await getMessages();
  const D = t.challenges.detail;
  const c = data.challenge;
  const isStudent = me.profile.role === 'student';
  const assigned = data.my_assignment && data.my_assignment.status !== 'withdrawn';
  const tabKeys = data.can_review ? (['overview', 'candidates', 'team', 'history'] as const).filter((k) => k !== 'history' || data.can_manage) : (['overview'] as const);
  const tab = (tabKeys as readonly string[]).includes(String(sp.tab)) ? String(sp.tab) : 'overview';
  const pendingCandidates = data.applications.filter((a) => a.status === 'submitted' || a.status === 'shortlisted').length;

  const facts = [
    { label: D.company, value: <span className="inline-flex items-center gap-1">{c.organization?.name}{c.organization?.verification_status === 'verified' && <BadgeCheck className="size-4 text-gold-600" aria-label={t.challenges.verifiedOrg} />}</span> },
    { label: D.supervisor, value: c.supervisor ? `${c.supervisor.full_name}${c.supervisor.headline ? ` · ${c.supervisor.headline}` : ''}` : t.common.notSet },
    { label: D.dates, value: c.start_date ? `${formatDate(locale, c.start_date)} – ${formatDate(locale, c.end_date)}` : t.common.notSet },
    { label: t.challenges.modality, value: `${t.enums.modality[c.modality]}${c.location ? ` · ${c.location}` : ''}` },
    { label: t.challenges.duration, value: `${c.duration_weeks} ${t.common.weeks}` },
    { label: t.challenges.participants, value: fmt(t.challenges.places, { n: data.counts?.participants ?? 0, max: c.max_participants }) },
    { label: t.challenges.estimated, value: `${formatHours(locale, c.estimated_vath)} h` },
    { label: t.challenges.industry, value: c.industry ? t.enums.industries[c.industry as keyof typeof t.enums.industries] ?? c.industry : '—' },
  ];
  const terms = [
    { icon: Wallet, label: D.compensation, value: t.enums.compensation[c.compensation_type], detail: c.compensation_details },
    { icon: Scale, label: D.ip, value: t.enums.ipPolicy[c.ip_policy], detail: c.ip_details },
    { icon: Lock, label: D.confidentiality, value: t.enums.confidentiality[c.confidentiality], detail: '' },
    { icon: Shield, label: D.publication, value: t.enums.publicationPolicy[c.publication_policy], detail: '' },
  ];

  return (
    <>
      <Link href={isStudent ? '/challenges' : '/challenges?scope=mine'} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-950">
        <ArrowLeft className="size-4" aria-hidden /> {t.nav.challenges}
      </Link>
      <div className="card mb-6 overflow-hidden">
        <div className="relative bg-ink-950 px-5 py-6 text-white sm:px-8">
          <div className="grid-bg absolute inset-0 opacity-50" aria-hidden />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={c.status} label={t.status.challenge[c.status]} />
                {c.is_demo && <Badge tone="dark">{t.demo.badge}</Badge>}
              </div>
              <h1 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl">{c.title}</h1>
              <p className="mt-1 text-sm text-ink-300">{c.organization?.name} · {c.duration_weeks} {t.common.weeks} · {t.enums.modality[c.modality]}</p>
              {c.summary && <p className="mt-3 max-w-3xl text-ink-200">{c.summary}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {assigned && <Link href={`/workspace/${c.id}`} className="btn-primary">{t.challenges.openWorkspace}</Link>}
              {data.can_review && !assigned && (data.counts?.participants ?? 0) > 0 && <Link href={`/workspace/${c.id}`} className="btn btn-sm border border-white/20 text-white hover:bg-white/10">{t.challenges.openWorkspace}</Link>}
              {data.can_manage && !['completed', 'archived'].includes(c.status) && (
                <Link href={`/challenges/${c.id}/edit`} className="btn btn-sm border border-white/20 text-white hover:bg-white/10"><Pencil className="size-4" aria-hidden /> {t.common.edit}</Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {tabKeys.length > 1 && (
        <LinkTabs label={c.title} active={tab} tabs={tabKeys.map((k) => ({
          key: k, href: `/challenges/${c.id}?tab=${k}`, label: D.tabs[k],
          count: k === 'candidates' ? pendingCandidates : k === 'team' ? data.participants.length : undefined,
        }))} />
      )}

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title={D.about}>
              {c.description && <p className="whitespace-pre-line text-ink-700">{c.description}</p>}
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div><h3 className="text-sm font-bold uppercase tracking-wide text-ink-500">{D.problem}</h3><p className="mt-1 whitespace-pre-line text-ink-800">{c.problem}</p></div>
                <div><h3 className="text-sm font-bold uppercase tracking-wide text-ink-500">{D.objective}</h3><p className="mt-1 whitespace-pre-line text-ink-800">{c.objective}</p></div>
              </div>
            </Card>
            <Card title={D.competencies}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.competencies.map((k) => (
                  <li key={k.id} className="flex items-center justify-between rounded-xl border border-ink-200 px-3 py-2">
                    <span className="text-sm font-semibold">{competencyName(locale, k)}</span>
                    <Badge tone="neutral">{t.rubric.level} {k.required_level} · {t.rubric.levels[(k.required_level ?? 3) as 1 | 2 | 3 | 4 | 5].label}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title={D.deliverables}>
              <ol className="relative space-y-4 border-l-2 border-ink-200 pl-5">
                {data.deliverables.map((d, i) => (
                  <li key={d.id} className="relative">
                    <span className="absolute -left-[1.85rem] grid size-6 place-items-center rounded-full bg-ink-950 text-[11px] font-bold text-gold-300">{i + 1}</span>
                    <p className="font-semibold">{d.title}</p>
                    {d.description && <p className="text-sm text-ink-600">{d.description}</p>}
                    {d.due_date && <p className="mt-0.5 text-xs text-ink-500"><CalendarDays className="mr-1 inline size-3" aria-hidden />{formatDate(locale, d.due_date)}</p>}
                  </li>
                ))}
              </ol>
            </Card>
            <Card title={D.terms}>
              <ul className="grid gap-4 sm:grid-cols-2">
                {terms.map((term) => (
                  <li key={term.label} className="flex gap-3">
                    <term.icon className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden />
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{term.label}</p><p className="text-sm font-semibold text-ink-900">{term.value}</p>{term.detail && <p className="text-sm text-ink-600">{term.detail}</p>}</div>
                  </li>
                ))}
              </ul>
              {c.conditions && <p className="mt-4 rounded-xl bg-ink-50 p-3 text-sm text-ink-700"><FileText className="mr-1 inline size-4 text-ink-400" aria-hidden />{c.conditions}</p>}
              {c.compensation_type === 'none' && <Alert tone="info" className="mt-4">{t.challenges.fairWork}</Alert>}
            </Card>
          </div>

          <div className="space-y-6">
            {isStudent && (
              <Card title={assigned ? t.challenges.assigned : data.my_application ? D.yourApplication : D.applyTitle}>
                {assigned ? (
                  <div className="space-y-3">
                    <p className="text-sm text-ink-600">{t.status.assignment[data.my_assignment!.status]}</p>
                    <Link href={`/workspace/${c.id}`} className="btn-primary w-full">{t.challenges.openWorkspace}</Link>
                  </div>
                ) : data.my_application && data.my_application.status !== 'withdrawn' ? (
                  <div className="space-y-2">
                    <StatusBadge status={data.my_application.status} label={t.status.application[data.my_application.status]} />
                    <p className="whitespace-pre-line text-sm text-ink-700">{data.my_application.motivation}</p>
                    {data.my_application.decision_note && <p className="text-sm text-ink-500">“{data.my_application.decision_note}”</p>}
                    {['submitted', 'shortlisted'].includes(data.my_application.status) && <WithdrawButton applicationId={data.my_application.id} />}
                  </div>
                ) : (
                  <ApplyPanel challengeId={c.id} canApply={c.status === 'recruiting'} onboarding={me.profile.onboarding_completed} />
                )}
              </Card>
            )}
            {isStudent && data.match && (
              <Card title={t.challenges.compatibility} action={<MatchRing score={data.match.score} size="sm" />}>
                <MatchBreakdown match={data.match} />
              </Card>
            )}
            {data.can_manage && (
              <Card title={t.challenges.lifecycle}>
                <StatusControl challengeId={c.id} status={c.status} />
              </Card>
            )}
            <Card title={t.common.details}>
              <DefinitionList items={facts} />
            </Card>
            <div className="flex flex-wrap gap-3 text-xs text-ink-500">
              <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{fmt(t.challenges.places, { n: data.counts?.participants ?? 0, max: c.max_participants })}</span>
              <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{formatHours(locale, c.estimated_vath)} VATH</span>
              {c.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{c.location}</span>}
            </div>
          </div>
        </div>
      )}

      {tab === 'candidates' && (
        data.applications.length === 0 ? <EmptyState title={D.candidatesEmpty} /> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.applications.map((a) => <CandidateCard key={a.id} app={a} canDecide={data.can_manage} />)}
          </div>
        )
      )}

      {tab === 'team' && (
        <Card title={D.team}>
          {data.participants.length === 0 ? <p className="text-sm text-ink-500">{D.participantsEmpty}</p> : (
            <ul className="divide-y divide-ink-100">
              {data.participants.map((p) => (
                <li key={p.assignment_id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Avatar name={p.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/talent/${p.student_id}`} className="font-semibold hover:underline">{p.full_name}</Link>
                    <p className="text-xs text-ink-500">{[p.career, p.team_role].filter(Boolean).join(' · ')}</p>
                  </div>
                  <StatusBadge status={p.status} label={t.status.assignment[p.status as keyof typeof t.status.assignment]} />
                  {data.can_manage && p.status === 'active' && <EndAssignmentDialog assignmentId={p.assignment_id} label={D.leave} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'history' && (
        <Card title={D.tabs.history}>
          {data.decision_history.length === 0 ? <p className="text-sm text-ink-500">{D.historyEmpty}</p> : (
            <ol className="space-y-3">
              {data.decision_history.map((h, i) => {
                const template = (t.challenges.history as Record<string, string>)[h.action] ?? h.action;
                const from = String(h.before.status ?? '');
                const to = String(h.after.status ?? '');
                const label = (s: string) => (t.status.application as Record<string, string>)[s] ?? (t.status.challenge as Record<string, string>)[s] ?? s;
                return (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gold-500" aria-hidden />
                    <div>
                      <p className="text-ink-800">{fmt(template, { actor: h.actor_name ?? '—', subject: h.subject_name ?? '—', from: label(from), to: label(to) })}</p>
                      {typeof h.after.note === 'string' && h.after.note && <p className="text-xs text-ink-500">“{h.after.note}”</p>}
                      <p className="text-xs text-ink-400">{formatDateTime(locale, h.created_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      )}
    </>
  );
}
