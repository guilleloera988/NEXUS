import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft, Award, BadgeCheck, CalendarDays, CheckCircle2, Circle, CircleDot, Clock, ExternalLink, FileText, Globe, Hourglass, Lock, Trash2,
} from 'lucide-react';
import { deleteEvidence, deleteTask, deleteVath, setEvidenceVisibility, setTaskStatus } from '@/actions/workspace';
import { EvidenceDialog, SubmitPanel, TaskDialog, VathDialog } from '@/components/workspace/forms';
import { Alert, Avatar, Badge, Card, EmptyState, LinkTabs, ProgressRing, StatCard, StatusBadge } from '@/components/ui/primitives';
import { competencyName, formatBytes, formatDate, formatDateTime, formatHours, formatRelative } from '@/lib/format';
import { fmt, type Messages } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/server';
import { getMe, read } from '@/lib/server/backend';
import { maxUploadBytes } from '@/lib/server/env';
import type { Evidence, Workspace } from '@/lib/types';

const TABS = ['overview', 'tasks', 'evidence', 'vath', 'team', 'validation'] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({ params }: PageProps<'/workspace/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const { t } = await getMessages();
  const data = /^[0-9a-f-]{36}$/i.test(id) ? await read<Workspace | null>('sp_workspace', { challenge_id: id }).catch(() => null) : null;
  return { title: data?.challenge ? `${t.nav.workspace} · ${data.challenge.title}` : t.nav.workspace };
}

function EvidenceIcon({ e }: { e: Evidence }) {
  return <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-700">{e.has_file ? <FileText className="size-5" aria-hidden /> : <ExternalLink className="size-5" aria-hidden />}</span>;
}

function activityText(t: Messages, a: Workspace['activity'][number]) {
  const labels: Record<string, string> = {
    task_created: '＋', task_status_changed: '✓', evidence_added: '📎', validation_requested: '⇢', validation_completed: '✔', credential_issued: '★', challenge_status_changed: '◎', application_decided: '•',
  };
  const detail = a.details.title ?? (a.details.outcome ? (t.status.outcome as Record<string, string>)[a.details.outcome] : a.details.status ? (t.status.challenge as Record<string, string>)[a.details.status] ?? (t.status.task as Record<string, string>)[a.details.status] ?? a.details.status : '');
  return { icon: labels[a.action] ?? '•', detail };
}

export default async function WorkspacePage({ params, searchParams }: PageProps<'/workspace/[id]'>) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await getMe();
  if (!me) redirect('/login');
  const data = await read<Workspace | null>('sp_workspace', { challenge_id: id });
  if (!data) notFound();
  const { t, locale } = await getMessages();
  const W = t.workspace;
  if (data.forbidden) {
    return <EmptyState icon={<Lock className="size-6" />} title={t.errors.forbiddenTitle} text={t.errors.forbiddenText} action={<Link href={`/challenges/${id}`} className="btn-primary btn-sm">{t.challenges.viewChallenge}</Link>} />;
  }
  const c = data.challenge;
  const reviewer = data.role_view === 'reviewer';
  const tab: Tab = (TABS as readonly string[]).includes(String(sp.tab)) ? (sp.tab as Tab) : 'overview';
  const active = data.my_assignment?.status === 'active' && !['completed', 'archived'].includes(c.status);
  const locked = ['completed', 'archived'].includes(c.status);

  const mineVath = data.vath.filter((v) => v.is_mine);
  const scopeVath = reviewer ? data.vath : mineVath;
  const sum = (status: string[]) => scopeVath.filter((v) => status.includes(v.status)).reduce((a, v) => a + Number(status.includes('verified') || status.includes('adjusted') ? v.verified_hours ?? 0 : v.submitted_hours), 0);
  const verified = sum(['verified', 'adjusted']);
  const pending = sum(['submitted']);
  const draftVath = mineVath.filter((v) => v.status === 'draft');
  const draft = draftVath.reduce((a, v) => a + Number(v.submitted_hours), 0);
  const draftEvidence = data.evidence.filter((e) => e.is_mine && e.status === 'draft').length;
  const tasksDone = data.tasks.filter((x) => x.status === 'done').length;
  const deliverablesDone = data.deliverables.filter((d) => (d.evidence_approved ?? 0) > 0).length;
  const progressPct = data.tasks.length ? Math.round((tasksDone / data.tasks.length) * 100) : 0;
  const competencyById = new Map(data.competencies.map((k) => [k.id, k]));
  const myRequests = reviewer ? data.requests : data.requests.filter((r) => r.student_id === me.profile.id);
  const myAssessments = reviewer ? data.assessments : data.assessments.filter((a) => a.student_id === me.profile.id);
  const evidenceById = new Map(data.evidence.map((e) => [e.id, e]));
  const maxMb = Math.round(maxUploadBytes() / 1024 / 1024);
  const team = data.team.filter((m) => m.status === 'active');

  return (
    <>
      <Link href={reviewer ? `/challenges/${c.id}` : '/challenges?scope=participating'} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-950">
        <ArrowLeft className="size-4" aria-hidden /> {reviewer ? c.title : t.nav.myChallenges}
      </Link>

      <section className="card mb-6 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="kicker">{t.nav.workspace}</span>
              <StatusBadge status={c.status} label={t.status.challenge[c.status]} />
              {reviewer && <Badge tone="dark">{W.reviewerView}</Badge>}
              {c.is_demo && <Badge tone="gold">{t.common.demoData}</Badge>}
            </div>
            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{c.title}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {c.organization?.name} · {W.supervisor}: {c.supervisor?.full_name ?? t.common.notSet} · <CalendarDays className="inline size-3.5" aria-hidden /> {formatDate(locale, c.start_date)} – {formatDate(locale, c.end_date)}
            </p>
            <p className="mt-3 max-w-3xl text-sm text-ink-700"><span className="font-semibold">{W.objective}:</span> {c.objective}</p>
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing value={progressPct} label={`${progressPct}%`} sublabel={W.progress} size={116} />
          </div>
        </div>
        {/* Milestones */}
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr" aria-label={W.milestones}>
          {data.deliverables.map((d, i) => {
            const done = (d.evidence_approved ?? 0) > 0;
            const started = (d.evidence_total ?? 0) > 0;
            return (
              <li key={d.id} className={`flex items-start gap-2.5 rounded-xl border p-3 ${done ? 'border-success-600/30 bg-success-50' : started ? 'border-gold-300 bg-gold-50' : 'border-ink-200'}`}>
                {done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-600" aria-hidden /> : started ? <CircleDot className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden /> : <Circle className="mt-0.5 size-5 shrink-0 text-ink-300" aria-hidden />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-500">H{i + 1}{d.due_date ? ` · ${formatDate(locale, d.due_date)}` : ''}</p>
                  <p className="text-sm font-semibold leading-snug text-ink-900">{d.title}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <LinkTabs label={c.title} active={tab} tabs={TABS.map((k) => ({
        key: k, href: `/workspace/${c.id}?tab=${k}`, label: W.tabs[k],
        count: k === 'tasks' ? data.tasks.length - tasksDone : k === 'evidence' ? data.evidence.length : k === 'validation' ? (reviewer ? data.requests.filter((r) => r.status === 'pending').length : draftVath.length + draftEvidence) : undefined,
      }))} />

      {reviewer && tab === 'overview' && (
        <Alert tone="gold" className="mb-5"><span>{W.reviewerHint}</span> <Link href="/validations" className="link ml-1">{W.goToValidations}</Link></Alert>
      )}

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={<CheckCircle2 className="size-5" />} label={W.stats.tasks} value={`${tasksDone}/${data.tasks.length}`} />
              <StatCard icon={<BadgeCheck className="size-5" />} label={W.stats.verified} value={formatHours(locale, verified)} accent />
              <StatCard icon={<Hourglass className="size-5" />} label={W.stats.pending} value={formatHours(locale, pending)} />
              {!reviewer ? <StatCard icon={<Clock className="size-5" />} label={W.stats.draft} value={formatHours(locale, draft)} href={`/workspace/${c.id}?tab=validation`} />
                : <StatCard icon={<Award className="size-5" />} label={W.stats.deliverables} value={`${deliverablesDone}/${data.deliverables.length}`} />}
            </div>
            {!reviewer && data.credential && (
              <Alert tone="success" title={W.validation.credentialTitle}>
                {fmt(W.validation.credentialText, { code: data.credential.code })} <Link href="/my-skillpass" className="link ml-1">{W.validation.viewCredential}</Link>
              </Alert>
            )}
            {!reviewer && active && (draftVath.length > 0 || draftEvidence > 0) && (
              <Alert tone="gold" title={W.validation.submitTitle}>
                {fmt(W.validation.submitText, { vath: draftVath.length, hours: formatHours(locale, draft), evidence: draftEvidence, supervisor: c.supervisor?.full_name ?? '—' })}
                <Link href={`/workspace/${c.id}?tab=validation`} className="link ml-1">{W.validation.submit} →</Link>
              </Alert>
            )}
            <Card title={W.tasks.title} action={<Link href={`/workspace/${c.id}?tab=tasks`} className="text-sm font-semibold text-ink-600 hover:text-ink-950">{t.common.viewAll}</Link>}>
              {data.tasks.length === 0 ? <p className="text-sm text-ink-500">{W.tasks.empty}</p> : (
                <ul className="space-y-2">
                  {data.tasks.slice(0, 6).map((task) => (
                    <li key={task.id} className="flex items-center gap-3 text-sm">
                      {task.status === 'done' ? <CheckCircle2 className="size-4 text-success-600" aria-hidden /> : task.status === 'in_progress' ? <CircleDot className="size-4 text-gold-600" aria-hidden /> : <Circle className="size-4 text-ink-300" aria-hidden />}
                      <span className={`flex-1 ${task.status === 'done' ? 'text-ink-500 line-through' : 'text-ink-900'}`}>{task.title}</span>
                      <span className="text-xs text-ink-500">{task.assignee_name ?? W.tasks.unassigned}</span>
                      {task.due_date && <span className="hidden text-xs text-ink-400 sm:inline">{formatDate(locale, task.due_date)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <div className="space-y-6">
            <Card title={W.team.title}>
              <ul className="space-y-3">
                {c.supervisor && (
                  <li className="flex items-center gap-3"><Avatar name={c.supervisor.full_name} size="sm" tone="dark" /><div><p className="text-sm font-semibold">{c.supervisor.full_name}</p><p className="text-xs text-ink-500">{W.team.supervisor}</p></div></li>
                )}
                {data.team.map((m) => (
                  <li key={m.assignment_id} className="flex items-center gap-3"><Avatar name={m.full_name} size="sm" /><div><p className="text-sm font-semibold">{m.full_name} {m.is_me && <span className="text-xs text-ink-500">{W.team.you}</span>}</p><p className="text-xs text-ink-500">{m.team_role || m.career}</p></div></li>
                ))}
              </ul>
            </Card>
            <Card title={W.activity}>
              {data.activity.length === 0 ? <p className="text-sm text-ink-500">{W.noActivity}</p> : (
                <ul className="space-y-3">
                  {data.activity.slice(0, 8).map((a, i) => {
                    const { icon, detail } = activityText(t, a);
                    return (
                      <li key={i} className="flex gap-2.5 text-sm">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink-100 text-xs" aria-hidden>{icon}</span>
                        <div className="min-w-0">
                          <p className="text-ink-800"><span className="font-semibold">{a.actor_name ?? '—'}</span> {(W.actions as Record<string, string>)[a.action] ?? a.action}{detail ? <>: <span className="text-ink-600">{detail}</span></> : null}</p>
                          <p className="text-xs text-ink-400">{formatRelative(locale, a.created_at)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <Card title={W.tasks.title} action={!locked && (active || reviewer) ? <TaskDialog challengeId={c.id} team={team} deliverables={data.deliverables} /> : undefined}>
          {data.tasks.length === 0 ? <EmptyState title={W.tasks.empty} text={W.tasks.emptyText} /> : (
            <div className="grid gap-4 lg:grid-cols-3">
              {(['todo', 'in_progress', 'done'] as const).map((status) => (
                <section key={status} aria-label={t.status.task[status]} className="rounded-2xl bg-ink-50 p-3">
                  <h3 className="mb-3 flex items-center justify-between px-1 text-sm font-bold">{t.status.task[status]}<span className="text-xs font-semibold text-ink-500">{data.tasks.filter((x) => x.status === status).length}</span></h3>
                  <ul className="space-y-2">
                    {data.tasks.filter((x) => x.status === status).map((task) => (
                      <li key={task.id} className="rounded-xl border border-ink-200 bg-white p-3">
                        <p className="text-sm font-semibold text-ink-900">{task.title}</p>
                        {task.description && <p className="mt-0.5 text-xs text-ink-500">{task.description}</p>}
                        <p className="mt-2 text-xs text-ink-500">{task.assignee_name ?? W.tasks.unassigned}{task.due_date ? ` · ${formatDate(locale, task.due_date)}` : ''}</p>
                        {!locked && (active || reviewer) && (
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            {(['todo', 'in_progress', 'done'] as const).filter((s) => s !== task.status).map((s) => (
                              <form key={s} action={setTaskStatus}>
                                <input type="hidden" name="task_id" value={task.id} /><input type="hidden" name="status" value={s} />
                                <button type="submit" className="btn-outline btn-sm">{s === 'todo' ? W.tasks.markTodo : s === 'in_progress' ? W.tasks.markProgress : W.tasks.markDone}</button>
                              </form>
                            ))}
                            <TaskDialog challengeId={c.id} team={team} deliverables={data.deliverables} task={task} />
                            {(task.created_by === me.profile.id || reviewer) && (
                              <form action={deleteTask}><input type="hidden" name="task_id" value={task.id} />
                                <button type="submit" className="btn-ghost btn-sm text-danger-700" aria-label={`${t.common.delete}: ${task.title}`}><Trash2 className="size-3.5" aria-hidden /></button>
                              </form>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'evidence' && (
        <Card title={W.evidence.title} action={active ? <EvidenceDialog challengeId={c.id} deliverables={data.deliverables} tasks={data.tasks} competencies={data.competencies} publicationAllowed={c.publication_policy === 'public_allowed'} maxMb={maxMb} /> : undefined}>
          {data.evidence.length === 0 ? <EmptyState icon={<FileText className="size-6" />} title={W.evidence.empty} text={W.evidence.emptyText} /> : (
            <ul className="grid gap-3 md:grid-cols-2">
              {data.evidence.map((e) => (
                <li key={e.id} className="flex flex-col rounded-xl border border-ink-200 p-4">
                  <div className="flex items-start gap-3">
                    <EvidenceIcon e={e} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink-900">{e.title} <span className="text-xs font-normal text-ink-500">{fmt(W.evidence.version, { n: e.version })}</span></p>
                      <p className="text-xs text-ink-500">{t.enums.evidenceKind[e.kind]}{e.file_name ? ` · ${e.file_name}` : ''}{e.size_bytes ? ` · ${formatBytes(e.size_bytes)}` : ''}{!e.is_mine ? ` · ${fmt(W.evidence.by, { name: e.student_name })}` : ''}</p>
                    </div>
                    <StatusBadge status={e.status} label={t.status.evidence[e.status]} />
                  </div>
                  {e.description && <p className="mt-2 text-sm text-ink-600">{e.description}</p>}
                  {e.competency_ids.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">{e.competency_ids.map((cid) => <Badge key={cid} tone="neutral">{competencyName(locale, competencyById.get(cid))}</Badge>)}</div>
                  )}
                  {e.review_comment && <p className="mt-2 rounded-lg bg-ink-50 p-2 text-xs text-ink-700"><span className="font-semibold">{W.evidence.reviewComment}:</span> {e.review_comment}</p>}
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                    {e.has_file ? (
                      <a href={`/api/evidence/${e.id}/file`} target="_blank" rel="noopener" className="btn-outline btn-sm"><FileText className="size-3.5" aria-hidden /> {W.evidence.openFile}</a>
                    ) : e.url ? (
                      <a href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="btn-outline btn-sm"><ExternalLink className="size-3.5" aria-hidden /> {W.evidence.openLink}</a>
                    ) : null}
                    {e.is_mine && <Badge tone={e.is_public ? 'info' : 'neutral'}>{e.is_public ? <Globe className="size-3" aria-hidden /> : <Lock className="size-3" aria-hidden />} {e.is_public ? W.evidence.public : W.evidence.private}</Badge>}
                    {e.is_mine && e.status === 'approved' && c.publication_policy === 'public_allowed' && (
                      <form action={setEvidenceVisibility}>
                        <input type="hidden" name="id" value={e.id} /><input type="hidden" name="is_public" value={e.is_public ? 'false' : 'true'} />
                        <button type="submit" className="btn-ghost btn-sm">{e.is_public ? W.evidence.private : W.evidence.public}</button>
                      </form>
                    )}
                    {e.is_mine && active && ['reviewed', 'rejected', 'approved'].includes(e.status) && (
                      <EvidenceDialog challengeId={c.id} deliverables={data.deliverables} tasks={data.tasks} competencies={data.competencies} publicationAllowed={c.publication_policy === 'public_allowed'} maxMb={maxMb} previous={e} />
                    )}
                    {e.is_mine && e.status === 'draft' && (
                      <form action={deleteEvidence} className="ml-auto"><input type="hidden" name="id" value={e.id} />
                        <button type="submit" className="btn-ghost btn-sm text-danger-700"><Trash2 className="size-3.5" aria-hidden /> {W.evidence.deleteConfirm}</button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'vath' && (
        <Card title={W.vath.title} action={active ? <VathDialog challengeId={c.id} tasks={data.tasks} evidence={data.evidence} /> : undefined} bodyClassName="overflow-x-auto">
          <div className="flex flex-wrap gap-4 px-5 pt-5 text-sm sm:px-6">
            <span><span className="text-ink-500">{W.vath.totalVerified}:</span> <span className="font-bold">{formatHours(locale, verified)} h</span></span>
            <span><span className="text-ink-500">{t.status.vath.submitted}:</span> <span className="font-bold">{formatHours(locale, pending)} h</span></span>
            {!reviewer && <span><span className="text-ink-500">{t.status.vath.draft}:</span> <span className="font-bold">{formatHours(locale, draft)} h</span></span>}
          </div>
          {scopeVath.length === 0 ? <div className="p-5"><EmptyState icon={<Clock className="size-6" />} title={W.vath.empty} text={W.vath.emptyText} /></div> : (
            <table className="table mt-3 min-w-[760px]">
              <thead>
                <tr>
                  <th scope="col">{W.vath.fields.date}</th><th scope="col">{W.vath.fields.activity}</th>{reviewer && <th scope="col">{t.roles.student}</th>}
                  <th scope="col" className="text-right">{W.vath.submitted}</th><th scope="col" className="text-right">{W.vath.verified}</th><th scope="col">{t.common.status}</th><th scope="col"><span className="sr-only">{t.common.actions}</span></th>
                </tr>
              </thead>
              <tbody>
                {scopeVath.map((v) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap text-ink-600">{formatDate(locale, v.activity_date)}</td>
                    <td>
                      <p className="font-semibold text-ink-900">{v.activity}</p>
                      <p className="text-xs text-ink-500">{v.description}</p>
                      {v.evidence_ids.length > 0 && <p className="mt-1 text-xs text-ink-500">📎 {v.evidence_ids.map((eid) => evidenceById.get(eid)?.title).filter(Boolean).join(', ')}</p>}
                      {v.validation_comment && <p className="mt-1 text-xs text-warning-700">{W.vath.comment}: {v.validation_comment}</p>}
                    </td>
                    {reviewer && <td className="text-ink-700">{v.student_name}</td>}
                    <td className="text-right tabular-nums">{formatHours(locale, v.submitted_hours)}</td>
                    <td className="text-right font-semibold tabular-nums">{v.verified_hours === null ? '—' : formatHours(locale, v.verified_hours)}</td>
                    <td><StatusBadge status={v.status} label={t.status.vath[v.status]} /></td>
                    <td className="whitespace-nowrap text-right">
                      {v.is_mine && v.status === 'draft' && active && (
                        <div className="flex justify-end gap-1">
                          <VathDialog challengeId={c.id} tasks={data.tasks} evidence={data.evidence} entry={v} />
                          <form action={deleteVath}><input type="hidden" name="id" value={v.id} /><button type="submit" className="btn-ghost btn-sm text-danger-700" aria-label={`${t.common.delete}: ${v.activity}`}><Trash2 className="size-3.5" aria-hidden /></button></form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="px-5 pb-5 pt-3 text-xs text-ink-500 sm:px-6">{t.vath.definition} {t.vath.disclaimer}</p>
        </Card>
      )}

      {tab === 'team' && (
        <Card title={W.team.title}>
          <ul className="divide-y divide-ink-100">
            {c.supervisor && (
              <li className="flex items-center gap-3 py-3 first:pt-0"><Avatar name={c.supervisor.full_name} tone="dark" /><div className="flex-1"><p className="font-semibold">{c.supervisor.full_name}</p><p className="text-xs text-ink-500">{W.team.supervisor} · {c.supervisor.headline}</p></div></li>
            )}
            {data.team.map((m) => (
              <li key={m.assignment_id} className="flex flex-wrap items-center gap-3 py-3 last:pb-0">
                <Avatar name={m.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{m.full_name} {m.is_me && <span className="text-xs text-ink-500">{W.team.you}</span>}</p>
                  <p className="text-xs text-ink-500">{[m.career, m.team_role && `${W.team.role}: ${m.team_role}`].filter(Boolean).join(' · ')}</p>
                </div>
                {m.verified_hours !== null && <Badge tone="success">{formatHours(locale, m.verified_hours)} h · {W.team.hours}</Badge>}
                {m.credential_code && <Badge tone="dark"><Award className="size-3" aria-hidden /> {m.credential_code}</Badge>}
                <StatusBadge status={m.status} label={t.status.assignment[m.status as keyof typeof t.status.assignment]} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'validation' && sp.submitted === '1' && <Alert tone="success" className="mb-5">{W.validation.submitted}</Alert>}
      {tab === 'validation' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {!reviewer && (
              <Card title={W.validation.submitTitle}>
                {data.credential ? (
                  <Alert tone="success" title={W.validation.credentialTitle}>{fmt(W.validation.credentialText, { code: data.credential.code })} <Link href="/my-skillpass" className="link ml-1">{W.validation.viewCredential}</Link></Alert>
                ) : active ? (
                  <SubmitPanel challengeId={c.id} draftVath={draftVath.length} draftHours={draft} draftEvidence={draftEvidence} supervisor={c.supervisor?.full_name ?? t.roles.supervisor} />
                ) : <p className="text-sm text-ink-500">{W.validation.nothing}</p>}
              </Card>
            )}
            <Card title={W.validation.history}>
              {myRequests.length === 0 ? <p className="text-sm text-ink-500">{W.validation.empty}</p> : (
                <ol className="space-y-3">
                  {myRequests.map((r) => (
                    <li key={r.id} className="rounded-xl border border-ink-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={r.outcome ?? r.status} label={r.outcome ? t.status.outcome[r.outcome] : t.status.request[r.status]} />
                          {reviewer && <span className="text-sm font-semibold">{r.student_name}</span>}
                          <span className="text-xs text-ink-500">{formatDateTime(locale, r.created_at)}</span>
                        </div>
                        {reviewer && r.status === 'pending' && <Link href={`/validations/${r.id}`} className="btn-primary btn-sm">{t.validations.review}</Link>}
                        {reviewer && r.status !== 'pending' && <Link href={`/validations/${r.id}`} className="btn-outline btn-sm">{t.common.view}</Link>}
                      </div>
                      {r.student_note && <p className="mt-2 text-sm text-ink-600">“{r.student_note}”</p>}
                      {r.summary_comment && <p className="mt-2 text-sm text-ink-800"><span className="font-semibold">{W.validation.reviewer} {r.completed_by_name}:</span> {r.summary_comment}</p>}
                      {r.credential_code && <p className="mt-2"><Badge tone="dark"><Award className="size-3" aria-hidden /> {fmt(W.validation.credentialIssued, { code: r.credential_code })}</Badge></p>}
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
          <Card title={W.validation.assessments}>
            {myAssessments.length === 0 ? <p className="text-sm text-ink-500">{t.rubric.notAssessed}</p> : (
              <ul className="space-y-3">
                {myAssessments.map((a) => (
                  <li key={a.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{competencyName(locale, competencyById.get(a.competency_id))}</span>
                      <Badge tone={a.level >= 3 ? 'success' : 'warning'}>{t.rubric.level} {a.level} · {t.rubric.levels[a.level as 1 | 2 | 3 | 4 | 5].label}</Badge>
                    </div>
                    {a.comment && <p className="text-xs text-ink-500">{a.comment}</p>}
                    <p className="text-xs text-ink-400">{a.assessor_name} · {formatDate(locale, a.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-ink-500">{t.rubric.verifiedRule}</p>
          </Card>
        </div>
      )}
    </>
  );
}
