'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Send } from 'lucide-react';
import { applyToChallenge, decideApplication, endAssignment, setChallengeStatus, withdrawApplication } from '@/actions/challenges';
import { CHALLENGE_TRANSITIONS } from '@/lib/constants';
import { competencyName, formatRelative } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/client';
import type { CandidateApplication, ChallengeStatus, Match } from '@/lib/types';
import { MatchRing } from './challenge-card';
import { ActionForm, Field, SubmitButton } from './ui/form';
import { Dialog } from './ui/interactive';
import { Avatar, Badge, StatusBadge } from './ui/primitives';

export function MatchBreakdown({ match }: { match: Match }) {
  const { t, locale } = useI18n();
  const D = t.challenges.detail;
  const parts = [
    { label: D.skillsPts, value: match.skills, max: 60 },
    { label: D.interestsPts, value: match.interests, max: 15 },
    { label: D.careerPts, value: match.career, max: 10 },
    { label: D.availabilityPts, value: match.availability, max: 15 },
  ];
  const tone = { verified: 'success', declared: 'gold', missing: 'neutral' } as const;
  return (
    <div>
      <ul className="space-y-2">
        {parts.map((p) => (
          <li key={p.label} className="text-sm">
            <div className="flex justify-between"><span className="text-ink-600">{p.label}</span><span className="font-semibold tabular-nums">{p.value}/{p.max}</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-ink-100"><div className="h-full rounded-full bg-gold-500" style={{ width: `${(p.value / p.max) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {match.competencies.map((c) => (
          <Badge key={c.competency_id} tone={tone[c.source]}>{competencyName(locale, c)} · {D.source[c.source]}</Badge>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-500">{D.matchRules} {fmt(D.weekly, { hours: match.weekly_hours })}</p>
    </div>
  );
}

export function ApplyPanel({ challengeId, canApply, onboarding }: { challengeId: string; canApply: boolean; onboarding: boolean }) {
  const { t } = useI18n();
  const D = t.challenges.detail;
  if (!onboarding) return <Link href="/onboarding" className="btn-primary w-full">{D.completeProfile}</Link>;
  if (!canApply) return <p className="text-sm text-ink-500">{D.notRecruiting}</p>;
  return (
    <ActionForm action={applyToChallenge} className="space-y-3" success={D.applicationSent}>
      <input type="hidden" name="challenge_id" value={challengeId} />
      <Field as="textarea" label={D.motivation} name="motivation" required help={D.motivationHelp} maxLength={2000} rows={5} />
      <Field label={D.availabilityNote} name="availability_note" maxLength={400} />
      <SubmitButton className="btn-primary w-full" pendingLabel={t.common.saving}><Send className="size-4" aria-hidden /> {D.sendApplication}</SubmitButton>
    </ActionForm>
  );
}

export function WithdrawButton({ applicationId }: { applicationId: string }) {
  const { t } = useI18n();
  return (
    <form action={withdrawApplication}>
      <input type="hidden" name="application_id" value={applicationId} />
      <button type="submit" className="btn-ghost btn-sm text-danger-700">{t.challenges.detail.withdraw}</button>
    </form>
  );
}

export function StatusControl({ challengeId, status }: { challengeId: string; status: ChallengeStatus }) {
  const { t } = useI18n();
  const options = CHALLENGE_TRANSITIONS[status];
  return (
    <div>
      <p className="text-sm text-ink-600">{t.challenges.statusHelp[status]}</p>
      {options.length > 0 && (
        <ActionForm action={setChallengeStatus} className="mt-3" success={t.common.saved}>
          <input type="hidden" name="challenge_id" value={challengeId} />
          <div className="flex flex-wrap gap-2">
            {options.map((next, i) => (
              <SubmitButton key={next} name="status" value={next} className={i === 0 ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}>
                {fmt(t.challenges.transitionTo, { status: t.status.challenge[next] })}
              </SubmitButton>
            ))}
          </div>
        </ActionForm>
      )}
    </div>
  );
}

export function CandidateCard({ app, canDecide }: { app: CandidateApplication; canDecide: boolean }) {
  const { t, locale } = useI18n();
  const D = t.challenges.detail;
  const [open, setOpen] = useState(false);
  const decidable = canDecide && (app.status === 'submitted' || app.status === 'shortlisted');
  return (
    <article className="rounded-xl border border-ink-200 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={app.student.full_name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/talent/${app.student.id}`} className="font-bold text-ink-950 hover:underline">{app.student.full_name}</Link>
            <StatusBadge status={app.status} label={t.status.application[app.status]} />
          </div>
          <p className="text-xs text-ink-500">
            {[app.student.career, app.student.university, app.student.semester ? `${t.onboarding.student.semester} ${app.student.semester}` : null].filter(Boolean).join(' · ')}
            {' · '}{formatRelative(locale, app.created_at)}
          </p>
        </div>
        {app.score !== null && <MatchRing score={app.score} />}
      </div>
      <p className="mt-3 whitespace-pre-line text-sm text-ink-700">{app.motivation}</p>
      {app.availability_note && <p className="mt-1 text-xs text-ink-500">{app.availability_note}</p>}
      {app.match && (
        <div className="mt-3">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-700 hover:text-ink-950">
            {D.matchWhy} <ChevronDown className={`size-3.5 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {open && <div className="mt-2 rounded-lg bg-ink-50 p-3"><MatchBreakdown match={app.match} /></div>}
        </div>
      )}
      {app.decision_note && <p className="mt-2 text-xs text-ink-500">“{app.decision_note}”</p>}
      {decidable && (
        <ActionForm action={decideApplication} className="mt-4 border-t border-ink-100 pt-3" success={t.common.saved}>
          <input type="hidden" name="application_id" value={app.id} />
          <label htmlFor={`note-${app.id}`} className="sr-only">{D.decisionNote}</label>
          <input id={`note-${app.id}`} name="note" className="input mb-2" placeholder={D.decisionNote} maxLength={1000} />
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="decision" value="accept" className="btn-primary btn-sm">{D.accept}</SubmitButton>
            {app.status === 'submitted' && <SubmitButton name="decision" value="shortlist" className="btn-outline btn-sm">{D.shortlist}</SubmitButton>}
            <SubmitButton name="decision" value="reject" className="btn-danger btn-sm">{D.reject}</SubmitButton>
          </div>
        </ActionForm>
      )}
    </article>
  );
}

export function EndAssignmentDialog({ assignmentId, label }: { assignmentId: string; label: string }) {
  const { t } = useI18n();
  return (
    <Dialog trigger={label} title={label} triggerClassName="btn-ghost btn-sm text-danger-700">
      <ActionForm action={endAssignment} className="space-y-3" success={t.common.saved}>
        <input type="hidden" name="assignment_id" value={assignmentId} />
        <Field as="textarea" label={t.challenges.detail.leaveReason} name="reason" required maxLength={600} rows={3} />
        <SubmitButton className="btn-danger">{label}</SubmitButton>
      </ActionForm>
    </Dialog>
  );
}
