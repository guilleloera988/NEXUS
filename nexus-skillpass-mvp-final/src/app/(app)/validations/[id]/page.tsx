import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Clock, FileText, Hourglass } from 'lucide-react';
import { ValidationReview } from '@/components/validation-review';
import { Alert, Avatar, Badge, Card, StatCard, StatusBadge } from '@/components/ui/primitives';
import { competencyName, formatDate, formatDateTime, formatHours } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/server';
import { getMe, read } from '@/lib/server/backend';
import type { ValidationDetail } from '@/lib/types';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.validations.detail.title };
}

export default async function ValidationPage({ params, searchParams }: PageProps<'/validations/[id]'>) {
  const { id } = await params;
  const justDone = (await searchParams).done === '1';
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await getMe();
  if (!me) redirect('/login');
  const data = await read<ValidationDetail | null>('sp_validation', { id });
  if (!data) notFound();
  const { t, locale } = await getMessages();
  const D = t.validations.detail;
  const submitted = data.vath.reduce((a, v) => a + Number(v.submitted_hours), 0);
  const pendingHours = data.vath.filter((v) => v.status === 'submitted').reduce((a, v) => a + Number(v.submitted_hours), 0);
  const decisionLabels = D.decisionLabels as Record<string, string>;
  return (
    <>
      <Link href="/validations" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-950"><ArrowLeft className="size-4" aria-hidden /> {t.validations.title}</Link>
      <section className="card mb-6 grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_1.4fr_auto]">
        <div className="flex items-center gap-4">
          <Avatar name={data.student.full_name} size="lg" />
          <div className="min-w-0">
            <p className="kicker">{D.student}</p>
            <h1 className="text-xl font-extrabold">{data.student.full_name}</h1>
            <p className="text-sm text-ink-500">{[data.student.university, data.student.career].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="min-w-0 border-ink-100 lg:border-l lg:pl-5">
          <p className="kicker">{D.challenge}</p>
          <Link href={`/workspace/${data.challenge.id}`} className="text-lg font-bold hover:underline">{data.challenge.title}</Link>
          <p className="text-sm text-ink-500">{data.challenge.organization_name} · {formatDate(locale, data.challenge.start_date)} – {formatDate(locale, data.challenge.end_date)}</p>
          {data.request.student_note && <p className="mt-2 text-sm text-ink-700"><span className="font-semibold">{D.studentNote}:</span> “{data.request.student_note}”</p>}
        </div>
        <div className="flex items-start"><StatusBadge status={data.request.outcome ?? data.request.status} label={data.request.outcome ? t.status.outcome[data.request.outcome] : t.status.request[data.request.status]} /></div>
      </section>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Clock className="size-5" />} label={D.submittedHours} value={`${formatHours(locale, submitted)} h`} />
        <StatCard icon={<FileText className="size-5" />} label={D.evidenceCount} value={data.evidence.length} />
        <StatCard icon={<Hourglass className="size-5" />} label={D.verifiedSoFar} value={`${formatHours(locale, data.assignment.verified_hours)} h`} hint={pendingHours > 0 ? `${formatHours(locale, pendingHours)} h ${t.status.vath.submitted.toLowerCase()}` : undefined} accent />
      </div>

      {data.can_decide ? <ValidationReview data={data} /> : (
        <div className="space-y-6">
          {justDone && data.request.status === 'completed' && (
            <Alert tone="success" title={D.completed}>
              {data.request.outcome && <p>{t.status.outcome[data.request.outcome]}</p>}
              {data.request.credential_code && (
                <p className="mt-1 font-semibold">{fmt(t.workspace.validation.credentialIssued, { code: data.request.credential_code })}</p>
              )}
            </Alert>
          )}
          {!justDone && <Alert tone={data.request.status === 'pending' ? 'warning' : 'info'}>{data.request.status === 'pending' ? (data.request.student_id === me.profile.id ? D.selfNote : D.cannotDecide) : D.readOnly}</Alert>}
          {data.request.summary_comment && <Card title={D.summary}><p className="text-sm text-ink-700">{data.request.summary_comment}</p><p className="mt-2 text-xs text-ink-500">{data.request.completed_by_name} · {formatDateTime(locale, data.request.completed_at)}</p></Card>}
          <Card title={D.step3}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.competencies.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-xl border border-ink-200 px-3 py-2 text-sm">
                  <span className="font-semibold">{competencyName(locale, c)}</span>
                  {c.assessed_level ? <Badge tone={c.assessed_level >= 3 ? 'success' : 'warning'}>{t.rubric.level} {c.assessed_level}</Badge> : <span className="text-xs text-ink-400">{t.rubric.notAssessed}</span>}
                </li>
              ))}
            </ul>
          </Card>
          <Card title={D.decisions} bodyClassName="overflow-x-auto">
            <table className="table min-w-[620px]">
              <thead><tr><th scope="col">{t.common.date}</th><th scope="col">{t.common.details}</th><th scope="col">{t.common.status}</th><th scope="col">{D.comment}</th></tr></thead>
              <tbody>
                {data.decisions.map((d) => {
                  const item = d.item_type === 'vath' ? data.vath.find((v) => v.id === d.item_id)?.activity : d.item_type === 'evidence' ? data.evidence.find((e) => e.id === d.item_id)?.title : t.challenges.detail.team;
                  return (
                    <tr key={d.id}>
                      <td className="whitespace-nowrap text-ink-500">{formatDateTime(locale, d.decided_at)}<br /><span className="text-xs">{d.decided_by_name}</span></td>
                      <td>{item}{d.item_type === 'vath' && <p className="text-xs text-ink-500">{String(d.previous_value.submitted_hours ?? '')} h → {String(d.new_value.verified_hours ?? '')} h</p>}</td>
                      <td><StatusBadge status={d.decision === 'changes_requested' ? 'reviewed' : d.decision} label={decisionLabels[d.decision] ?? d.decision} /></td>
                      <td className="text-ink-600">{d.comment || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  );
}
