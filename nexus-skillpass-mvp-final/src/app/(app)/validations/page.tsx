import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClipboardCheck, FileText } from 'lucide-react';
import { Avatar, Badge, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { formatHours, formatRelative } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/server';
import { getMe, read } from '@/lib/server/backend';
import type { Outcome } from '@/lib/types';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.validations.title };
}

interface Queue {
  pending: { id: string; created_at: string; student_note: string; challenge_id: string; challenge_title: string; student: { id: string; full_name: string; career: string; university: string | null }; vath_count: number; evidence_count: number; hours: number }[];
  completed: { id: string; completed_at: string; outcome: Outcome; challenge_title: string; student_name: string; completed_by_name: string | null; credential_code: string | null }[];
}

export default async function ValidationsPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const { t, locale } = await getMessages();
  const V = t.validations;
  const queue = await read<Queue>('sp_validation_queue');
  return (
    <>
      <PageHeader kicker={t.roles[me.profile.role]} title={V.title} subtitle={V.subtitle} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={`${V.pending} (${queue.pending.length})`} className="lg:col-span-2">
          {queue.pending.length === 0 ? <EmptyState icon={<ClipboardCheck className="size-6" />} title={V.empty} text={V.emptyText} /> : (
            <ul className="divide-y divide-ink-100">
              {queue.pending.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <Avatar name={r.student.full_name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink-950">{r.student.full_name}</p>
                    <p className="text-xs text-ink-500">{[r.student.career, r.student.university].filter(Boolean).join(' · ')}</p>
                    <p className="mt-1 text-sm text-ink-700">{r.challenge_title}</p>
                    <p className="mt-1 flex flex-wrap gap-2 text-xs text-ink-500">
                      <span>{fmt(V.hours, { hours: formatHours(locale, r.hours) })}</span>
                      <span><FileText className="inline size-3" aria-hidden /> {fmt(V.items, { vath: r.vath_count, evidence: r.evidence_count })}</span>
                      <span>{V.requested} {formatRelative(locale, r.created_at)}</span>
                    </p>
                  </div>
                  <Link href={`/validations/${r.id}`} className="btn-primary">{V.review}</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={V.completed}>
          {queue.completed.length === 0 ? <p className="text-sm text-ink-500">—</p> : (
            <ul className="space-y-3">
              {queue.completed.map((r) => (
                <li key={r.id}>
                  <Link href={`/validations/${r.id}`} className="block rounded-lg p-1 hover:bg-ink-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{r.student_name}</span>
                      <StatusBadge status={r.outcome} label={t.status.outcome[r.outcome]} />
                    </div>
                    <p className="truncate text-xs text-ink-500">{r.challenge_title} · {formatRelative(locale, r.completed_at)}</p>
                    {r.credential_code && <Badge tone="dark" className="mt-1">{r.credential_code}</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
