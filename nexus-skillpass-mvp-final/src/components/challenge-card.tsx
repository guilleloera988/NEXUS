import Link from 'next/link';
import { BadgeCheck, CalendarDays, Clock, MapPin, Users } from 'lucide-react';
import { competencyName, formatDate, formatHours } from '@/lib/format';
import { fmt, type Locale, type Messages } from '@/lib/i18n';
import type { ChallengeCard as Card } from '@/lib/types';
import { Badge, StatusBadge } from './ui/primitives';

export function MatchRing({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'size-10 text-xs' : 'size-14 text-sm';
  const deg = Math.max(0, Math.min(100, score)) * 3.6;
  return (
    <span className={`relative grid shrink-0 place-items-center rounded-full ${s}`}
      style={{ background: `conic-gradient(var(--color-gold-500) ${deg}deg, var(--color-ink-100) ${deg}deg)` }}>
      <span className="absolute inset-[4px] rounded-full bg-white" />
      <span className="relative font-extrabold tabular-nums text-ink-950">{score}%</span>
    </span>
  );
}

export function ChallengeCardView({ c, t, locale, showMatch }: { c: Card; t: Messages; locale: Locale; showMatch: boolean }) {
  const participating = c.my_assignment === 'active' || c.my_assignment === 'completed';
  return (
    <article className="card flex h-full flex-col p-5 transition hover:border-gold-300 hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
            {c.organization.name}
            {c.organization.verification_status === 'verified' && <BadgeCheck className="size-3.5 text-gold-600" aria-label={t.challenges.verifiedOrg} />}
          </p>
          <h2 className="mt-1 text-lg font-bold leading-snug">
            <Link href={`/challenges/${c.id}`} className="hover:underline">{c.title}</Link>
          </h2>
        </div>
        {showMatch && c.match ? (
          <span title={t.challenges.compatibility} className="flex flex-col items-center gap-0.5">
            <MatchRing score={c.match.score} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{t.challenges.compatibility}</span>
          </span>
        ) : <StatusBadge status={c.status} label={t.status.challenge[c.status]} />}
      </div>
      {c.summary && <p className="mt-2 line-clamp-2 text-sm text-ink-600">{c.summary}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.competencies.slice(0, 4).map((k) => <Badge key={k.id} tone="neutral">{competencyName(locale, k)}</Badge>)}
        {c.competencies.length > 4 && <Badge tone="neutral">+{c.competencies.length - 4}</Badge>}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-ink-600">
        <div className="flex items-center gap-1.5"><CalendarDays className="size-3.5 text-ink-400" aria-hidden /><dt className="sr-only">{t.challenges.duration}</dt><dd>{c.duration_weeks} {t.common.weeks}</dd></div>
        <div className="flex items-center gap-1.5"><MapPin className="size-3.5 text-ink-400" aria-hidden /><dt className="sr-only">{t.challenges.modality}</dt><dd>{t.enums.modality[c.modality]}{c.location ? ` · ${c.location}` : ''}</dd></div>
        <div className="flex items-center gap-1.5"><Clock className="size-3.5 text-ink-400" aria-hidden /><dt className="sr-only">{t.challenges.estimated}</dt><dd>{formatHours(locale, c.estimated_vath)} {t.challenges.estimated}</dd></div>
        <div className="flex items-center gap-1.5"><Users className="size-3.5 text-ink-400" aria-hidden /><dt className="sr-only">{t.challenges.participants}</dt><dd>{fmt(t.challenges.places, { n: c.counts?.participants ?? 0, max: c.max_participants })}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Badge tone={c.compensation_type === 'none' ? 'neutral' : 'gold'}>{t.enums.compensation[c.compensation_type]}</Badge>
        {showMatch && <StatusBadge status={c.status} label={t.status.challenge[c.status]} />}
        {c.my_application && !participating && <Badge tone="info">{t.challenges.applied}: {t.status.application[c.my_application]}</Badge>}
        {participating && <Badge tone="success">{t.challenges.assigned}</Badge>}
        {c.pending_applications > 0 && !showMatch && <Badge tone="gold">{c.pending_applications} {t.dashboard.company.pendingApplications.toLowerCase()}</Badge>}
        {c.pending_validations > 0 && !showMatch && <Badge tone="warning">{c.pending_validations} {t.dashboard.company.pendingValidations.toLowerCase()}</Badge>}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
        <span className="text-xs text-ink-500">{c.start_date ? `${formatDate(locale, c.start_date)} – ${formatDate(locale, c.end_date)}` : ''}</span>
        {participating ? (
          <Link href={`/workspace/${c.id}`} className="btn-primary btn-sm">{t.challenges.openWorkspace}</Link>
        ) : (
          <Link href={`/challenges/${c.id}`} className="btn-dark btn-sm">{t.challenges.viewChallenge}</Link>
        )}
      </div>
    </article>
  );
}
