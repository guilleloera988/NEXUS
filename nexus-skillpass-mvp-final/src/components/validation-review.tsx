'use client';

import { useActionState, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, FileText } from 'lucide-react';
import { completeValidation } from '@/actions/validation';
import { IDLE } from '@/lib/action-state';
import { competencyName, formatBytes, formatDate, formatHours } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/client';
import type { ValidationDetail } from '@/lib/types';
import { FormFeedback, SubmitButton } from './ui/form';
import { Alert, Badge, StatusBadge } from './ui/primitives';

type VathDecision = { decision: 'verify' | 'adjust' | 'reject'; verified_hours: string; comment: string };
type EvidenceDecision = { decision: 'approve' | 'request_changes' | 'reject'; comment: string };

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; tone: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-ink-300">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs font-semibold transition ${value === o.value ? o.tone : 'bg-white text-ink-600 hover:bg-ink-50'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ValidationReview({ data }: { data: ValidationDetail }) {
  const { t, locale } = useI18n();
  const D = t.validations.detail;
  const [state, action] = useActionState(completeValidation, IDLE);
  const pendingVath = data.vath.filter((v) => v.status === 'submitted');
  const pendingEvidence = data.evidence.filter((e) => e.in_request && e.status === 'submitted');
  const [vath, setVath] = useState<Record<string, VathDecision>>(() => Object.fromEntries(pendingVath.map((v) => [v.id, { decision: 'verify', verified_hours: String(v.submitted_hours), comment: '' }])));
  const [evidence, setEvidence] = useState<Record<string, EvidenceDecision>>(() => Object.fromEntries(pendingEvidence.map((e) => [e.id, { decision: 'approve', comment: '' }])));
  const [levels, setLevels] = useState<Record<string, { level: number | null; comment: string }>>(() => Object.fromEntries(data.competencies.map((c) => [c.id, { level: null, comment: '' }])));
  const [summary, setSummary] = useState('');
  const [issue, setIssue] = useState(false);

  const totalSubmitted = pendingVath.reduce((a, v) => a + Number(v.submitted_hours), 0);
  const totalVerified = pendingVath.reduce((a, v) => {
    const d = vath[v.id];
    return a + (d.decision === 'verify' ? Number(v.submitted_hours) : d.decision === 'adjust' ? Number(d.verified_hours || 0) : 0);
  }, 0);
  const assessedCount = Object.values(levels).filter((l) => l.level !== null).length;
  const canIssue = (Number(data.assignment.verified_hours) + totalVerified) > 0 && (data.assignment.assessed_competencies + assessedCount) > 0 && data.assignment.status === 'active';

  const payload = useMemo(() => JSON.stringify({
    request_id: data.request.id,
    vath: pendingVath.map((v) => ({ id: v.id, decision: vath[v.id].decision, comment: vath[v.id].comment, ...(vath[v.id].decision === 'adjust' ? { verified_hours: Number(vath[v.id].verified_hours) } : {}) })),
    evidence: pendingEvidence.map((e) => ({ id: e.id, ...evidence[e.id] })),
    competencies: Object.entries(levels).filter(([, l]) => l.level !== null).map(([id, l]) => ({ competency_id: id, level: l.level, comment: l.comment })),
    summary_comment: summary,
    issue_credential: issue && canIssue,
  }), [data.request.id, pendingVath, pendingEvidence, vath, evidence, levels, summary, issue, canIssue]);

  if (state.ok) {
    return (
      <Alert tone="success" title={D.completed}>
        {state.data?.outcome && <p>{t.validations.detail.decisions}: {t.status.outcome[state.data.outcome as keyof typeof t.status.outcome]}</p>}
        {state.data?.credential_code && <p className="mt-1 font-semibold">{fmt(t.workspace.validation.credentialIssued, { code: String(state.data.credential_code) })}</p>}
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />

      <section className="card card-pad" aria-labelledby="step1">
        <h2 id="step1" className="mb-4 text-base font-bold">{D.step1}</h2>
        <ul className="space-y-3">
          {data.evidence.map((e) => (
            <li key={e.id} className="rounded-xl border border-ink-200 p-4">
              <div className="flex flex-wrap items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-700">{e.has_file ? <FileText className="size-5" aria-hidden /> : <ExternalLink className="size-5" aria-hidden />}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{e.title} <span className="text-xs font-normal text-ink-500">v{e.version}</span></p>
                  <p className="text-xs text-ink-500">{t.enums.evidenceKind[e.kind]}{e.file_name ? ` · ${e.file_name}` : ''}{e.size_bytes ? ` · ${formatBytes(e.size_bytes)}` : ''}{e.deliverable_title ? ` · ${e.deliverable_title}` : ''}</p>
                  {e.description && <p className="mt-1 text-sm text-ink-600">{e.description}</p>}
                  {e.competency_ids.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{e.competency_ids.map((cid) => <Badge key={cid}>{competencyName(locale, data.competencies.find((c) => c.id === cid))}</Badge>)}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {e.has_file ? <a className="btn-outline btn-sm" href={`/api/evidence/${e.id}/file`} target="_blank" rel="noopener">{t.workspace.evidence.openFile}</a>
                    : e.url ? <a className="btn-outline btn-sm" href={e.url} target="_blank" rel="noopener noreferrer nofollow">{t.workspace.evidence.openLink}</a> : null}
                  {!evidence[e.id] && <StatusBadge status={e.status} label={t.status.evidence[e.status]} />}
                </div>
              </div>
              {evidence[e.id] ? (
                <div className="mt-3 grid gap-2 border-t border-ink-100 pt-3 sm:grid-cols-[auto_1fr] sm:items-center">
                  <Segmented label={e.title} value={evidence[e.id].decision} onChange={(d) => setEvidence((p) => ({ ...p, [e.id]: { ...p[e.id], decision: d } }))}
                    options={[{ value: 'approve', label: D.approve, tone: 'bg-success-600 text-white' }, { value: 'request_changes', label: D.requestChanges, tone: 'bg-warning-700 text-white' }, { value: 'reject', label: D.reject, tone: 'bg-danger-700 text-white' }]} />
                  <input className="input" aria-label={`${D.comment}: ${e.title}`} placeholder={evidence[e.id].decision === 'approve' ? `${D.comment} (${t.common.optional})` : D.commentRequired}
                    value={evidence[e.id].comment} maxLength={2000} onChange={(ev) => setEvidence((p) => ({ ...p, [e.id]: { ...p[e.id], comment: ev.target.value } }))} />
                </div>
              ) : <p className="mt-2 text-xs text-ink-500">{D.contextEvidence}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card card-pad" aria-labelledby="step2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="step2" className="text-base font-bold">{D.step2}</h2>
          {pendingVath.length > 1 && <button type="button" className="btn-ghost btn-sm" onClick={() => setVath((p) => Object.fromEntries(Object.entries(p).map(([k, d]) => [k, { ...d, decision: 'verify' }])))}><CheckCircle2 className="size-4" aria-hidden /> {D.allVerify}</button>}
        </div>
        {pendingVath.length === 0 ? <p className="text-sm text-ink-500">—</p> : (
          <ul className="space-y-3">
            {pendingVath.map((v) => {
              const d = vath[v.id];
              return (
                <li key={v.id} className="rounded-xl border border-ink-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{v.activity}</p>
                      <p className="text-xs text-ink-500">{formatDate(locale, v.activity_date)}{v.task_title ? ` · ${v.task_title}` : ''} · {D.linkedTo}: {v.evidence_ids.map((id) => data.evidence.find((e) => e.id === id)?.title).filter(Boolean).join(', ') || '—'}</p>
                      <p className="mt-1 text-sm text-ink-600">{v.description}</p>
                    </div>
                    <p className="text-right text-sm"><span className="block text-xs text-ink-500">{D.submittedHours}</span><span className="text-lg font-extrabold tabular-nums">{formatHours(locale, v.submitted_hours)} h</span></p>
                  </div>
                  <div className="mt-3 grid gap-2 border-t border-ink-100 pt-3 md:grid-cols-[auto_8rem_1fr] md:items-center">
                    <Segmented label={v.activity} value={d.decision} onChange={(decision) => setVath((p) => ({ ...p, [v.id]: { ...p[v.id], decision } }))}
                      options={[{ value: 'verify', label: D.verify, tone: 'bg-success-600 text-white' }, { value: 'adjust', label: D.adjust, tone: 'bg-warning-700 text-white' }, { value: 'reject', label: D.reject, tone: 'bg-danger-700 text-white' }]} />
                    {d.decision === 'adjust' ? (
                      <input className="input" type="number" min={0} max={Number(v.submitted_hours) - 0.25} step={0.25} aria-label={D.verifiedHours} value={d.verified_hours}
                        onChange={(e) => setVath((p) => ({ ...p, [v.id]: { ...p[v.id], verified_hours: e.target.value } }))} />
                    ) : <span className="text-sm font-semibold text-ink-700">{d.decision === 'verify' ? `${formatHours(locale, v.submitted_hours)} h` : '0 h'}</span>}
                    <input className="input" aria-label={`${D.comment}: ${v.activity}`} placeholder={d.decision === 'verify' ? `${D.comment} (${t.common.optional})` : D.commentRequired}
                      value={d.comment} maxLength={2000} onChange={(e) => setVath((p) => ({ ...p, [v.id]: { ...p[v.id], comment: e.target.value } }))} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex justify-end gap-6 border-t border-ink-100 pt-3 text-sm">
          <span>{D.submittedHours}: <strong className="tabular-nums">{formatHours(locale, totalSubmitted)} h</strong></span>
          <span>{D.verifiedHours}: <strong className="tabular-nums text-success-700">{formatHours(locale, totalVerified)} h</strong></span>
        </div>
      </section>

      <section className="card card-pad" aria-labelledby="step3">
        <h2 id="step3" className="text-base font-bold">{D.step3}</h2>
        <p className="mb-4 mt-1 text-sm text-ink-500">{D.assessHelp}</p>
        <ul className="space-y-4">
          {data.competencies.map((c) => (
            <li key={c.id} className="rounded-xl border border-ink-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{competencyName(locale, c)}</p>
                  <p className="text-xs text-ink-500">{t.challenges.fields.requiredLevel}: {c.required_level}{c.previous_level ? ` · ${fmt(D.previousLevel, { level: c.previous_level })}` : ''}</p>
                </div>
                <div role="radiogroup" aria-label={competencyName(locale, c)} className="flex flex-wrap gap-1">
                  <button type="button" role="radio" aria-checked={levels[c.id].level === null} onClick={() => setLevels((p) => ({ ...p, [c.id]: { ...p[c.id], level: null } }))}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${levels[c.id].level === null ? 'bg-ink-200 text-ink-900' : 'text-ink-500 hover:bg-ink-100'}`}>{D.skip}</button>
                  {([1, 2, 3, 4, 5] as const).map((l) => (
                    <button key={l} type="button" role="radio" aria-checked={levels[c.id].level === l} title={t.rubric.levels[l].label}
                      onClick={() => setLevels((p) => ({ ...p, [c.id]: { ...p[c.id], level: l } }))}
                      className={`size-9 rounded-lg text-sm font-bold transition ${levels[c.id].level === l ? (l >= 3 ? 'bg-ink-950 text-gold-300' : 'bg-warning-700 text-white') : 'border border-ink-300 text-ink-700 hover:border-ink-500'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {levels[c.id].level !== null && (
                <div className="mt-3 grid gap-2 sm:grid-cols-[14rem_1fr] sm:items-center">
                  <p className="text-xs font-semibold text-ink-700">{t.rubric.levels[levels[c.id].level as 1 | 2 | 3 | 4 | 5].label} <span className="block font-normal text-ink-500">{t.rubric.levels[levels[c.id].level as 1 | 2 | 3 | 4 | 5].hint}</span></p>
                  <input className="input" aria-label={`${D.comment}: ${competencyName(locale, c)}`} placeholder={`${D.comment} (${t.common.optional})`} maxLength={1000}
                    value={levels[c.id].comment} onChange={(e) => setLevels((p) => ({ ...p, [c.id]: { ...p[c.id], comment: e.target.value } }))} />
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-500">{t.rubric.verifiedRule}</p>
      </section>

      <section className="card card-pad" aria-labelledby="step4">
        <h2 id="step4" className="mb-4 text-base font-bold">{D.step4}</h2>
        <label htmlFor="summary" className="label">{D.summary}</label>
        <textarea id="summary" className="textarea" rows={3} maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)} />
        <div className={`mt-4 flex items-start gap-3 rounded-xl border p-4 ${canIssue ? 'border-gold-300 bg-gold-50' : 'border-ink-200 bg-ink-50'}`}>
          <input id="issue" type="checkbox" className="checkbox" checked={issue && canIssue} disabled={!canIssue} onChange={(e) => setIssue(e.target.checked)} aria-describedby="issue-help" />
          <div>
            <label htmlFor="issue" className="text-sm font-bold text-ink-900">{D.issueCredential}</label>
            <p id="issue-help" className="help">{D.issueHelp}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <FormFeedback state={state} t={t} />
          <SubmitButton pendingLabel={t.common.saving}>{D.complete}</SubmitButton>
        </div>
      </section>
    </form>
  );
}
