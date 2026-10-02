'use client';

import { useActionState, useId, useMemo, useState, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { saveChallenge } from '@/actions/challenges';
import { COMPENSATION_TYPES, CONFIDENTIALITY, INDUSTRIES, INTERESTS, IP_POLICIES, MODALITIES, PUBLICATION_POLICIES, UNPAID_VATH_LIMIT } from '@/lib/constants';
import { competencyName } from '@/lib/format';
import { IDLE } from '@/lib/action-state';
import { useI18n } from '@/lib/i18n/client';
import type { Challenge, Competency, Deliverable } from '@/lib/types';
import { FormFeedback, SubmitButton } from './ui/form';
import { Alert } from './ui/primitives';

type Values = {
  title: string; summary: string; description: string; problem: string; objective: string; industry: string; tags: string[];
  target_careers: string; modality: string; location: string; duration_weeks: string; start_date: string; end_date: string;
  max_participants: string; estimated_vath: string; supervisor_id: string; conditions: string; compensation_type: string;
  compensation_details: string; ip_policy: string; ip_details: string; confidentiality: string; publication_policy: string;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="card card-pad">
      <legend className="sr-only">{title}</legend>
      <h2 className="mb-4 text-base font-bold" aria-hidden>{title}</h2>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

function Input({ label, value, onChange, required, help, type = 'text', ...rest }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; help?: string; type?: string; min?: number; max?: number; step?: number; maxLength?: number; placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">{label}{required && <span className="text-danger-600" aria-hidden> *</span>}</label>
      <input id={id} className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} aria-describedby={help ? `${id}-h` : undefined} {...rest} />
      {help && <p id={`${id}-h`} className="help">{help}</p>}
    </div>
  );
}

function Area({ label, value, onChange, required, rows = 3, maxLength, help }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; rows?: number; maxLength?: number; help?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">{label}{required && <span className="text-danger-600" aria-hidden> *</span>}</label>
      <textarea id={id} className="textarea" value={value} onChange={(e) => onChange(e.target.value)} required={required} rows={rows} maxLength={maxLength} aria-describedby={help ? `${id}-h` : undefined} />
      {help && <p id={`${id}-h`} className="help">{help}</p>}
    </div>
  );
}

function Select({ label, value, onChange, options, required, help, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean; help?: string; placeholder?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">{label}{required && <span className="text-danger-600" aria-hidden> *</span>}</label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)} required={required} aria-describedby={help ? `${id}-h` : undefined}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {help && <p id={`${id}-h`} className="help">{help}</p>}
    </div>
  );
}

export function ChallengeForm({ organizationId, organizationVerified, challenge, competencies: initialCompetencies, deliverables: initialDeliverables, catalog, supervisors }: {
  organizationId: string; organizationVerified: boolean; challenge?: Challenge; competencies?: Competency[]; deliverables?: Deliverable[];
  catalog: Competency[]; supervisors: { user_id: string; full_name: string; member_role: string }[];
}) {
  const { t, locale } = useI18n();
  const F = t.challenges.fields;
  const S = t.challenges.sections;
  const [state, action] = useActionState(saveChallenge, IDLE);
  const [v, setV] = useState<Values>({
    title: challenge?.title ?? '', summary: challenge?.summary ?? '', description: challenge?.description ?? '', problem: challenge?.problem ?? '',
    objective: challenge?.objective ?? '', industry: challenge?.industry ?? '', tags: challenge?.tags ?? [],
    target_careers: (challenge?.target_careers ?? []).join(', '), modality: challenge?.modality ?? 'hybrid', location: challenge?.location ?? '',
    duration_weeks: String(challenge?.duration_weeks ?? 6), start_date: challenge?.start_date ?? '', end_date: challenge?.end_date ?? '',
    max_participants: String(challenge?.max_participants ?? 3), estimated_vath: String(challenge?.estimated_vath ?? 40),
    supervisor_id: challenge?.supervisor_id ?? '', conditions: challenge?.conditions ?? '', compensation_type: challenge?.compensation_type ?? 'stipend',
    compensation_details: challenge?.compensation_details ?? '', ip_policy: challenge?.ip_policy ?? 'to_be_agreed', ip_details: challenge?.ip_details ?? '',
    confidentiality: challenge?.confidentiality ?? 'public', publication_policy: challenge?.publication_policy ?? 'public_allowed',
  });
  const [comps, setComps] = useState<{ competency_id: string; required_level: number }[]>(
    (initialCompetencies ?? []).map((c) => ({ competency_id: c.id, required_level: c.required_level ?? 3 })),
  );
  const [dels, setDels] = useState<{ id: string | null; title: string; description: string; due_date: string }[]>(
    (initialDeliverables ?? []).map((d) => ({ id: d.id, title: d.title, description: d.description, due_date: d.due_date ?? '' })),
  );
  const set = (key: keyof Values) => (value: string) => setV((prev) => ({ ...prev, [key]: value }));
  const payload = useMemo(() => JSON.stringify({
    ...v, id: challenge?.id ?? null, organization_id: organizationId,
    target_careers: v.target_careers.split(',').map((s) => s.trim()).filter(Boolean),
    competencies: comps.filter((c) => c.competency_id), deliverables: dels.filter((d) => d.title.trim()),
  }), [v, comps, dels, challenge?.id, organizationId]);
  const unpaidOver = v.compensation_type === 'none' && Number(v.estimated_vath) > UNPAID_VATH_LIMIT;
  const available = (current: string) => catalog.filter((c) => c.id === current || !comps.some((x) => x.competency_id === c.id));

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />
      <Section title={S.basics}>
        <Input label={F.title} value={v.title} onChange={set('title')} required maxLength={160} />
        <Input label={F.summary} value={v.summary} onChange={set('summary')} maxLength={400} />
        <Area label={F.description} value={v.description} onChange={set('description')} rows={4} maxLength={4000} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={F.industry} value={v.industry} onChange={set('industry')} placeholder={t.common.select} options={INDUSTRIES.map((i) => ({ value: i, label: t.enums.industries[i] }))} />
          <Input label={F.targetCareers} value={v.target_careers} onChange={set('target_careers')} help={F.targetCareersHelp} />
        </div>
        <fieldset>
          <legend className="label">{F.tags}</legend>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((key) => {
              const on = v.tags.includes(key);
              return (
                <button key={key} type="button" aria-pressed={on} onClick={() => setV((p) => ({ ...p, tags: on ? p.tags.filter((x) => x !== key) : [...p.tags, key].slice(0, 8) }))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? 'border-ink-950 bg-ink-950 text-gold-200' : 'border-ink-300 bg-white text-ink-700 hover:border-ink-500'}`}>
                  {t.enums.interests[key]}
                </button>
              );
            })}
          </div>
        </fieldset>
      </Section>

      <Section title={S.problem}>
        <Area label={F.problem} value={v.problem} onChange={set('problem')} required rows={4} maxLength={3000} />
        <Area label={F.objective} value={v.objective} onChange={set('objective')} required rows={3} maxLength={2000} />
      </Section>

      <Section title={S.logistics}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label={F.modality} value={v.modality} onChange={set('modality')} options={MODALITIES.map((m) => ({ value: m, label: t.enums.modality[m] }))} required />
          <Input label={F.location} value={v.location} onChange={set('location')} maxLength={120} />
          <Input label={F.durationWeeks} value={v.duration_weeks} onChange={set('duration_weeks')} type="number" min={1} max={52} required />
          <Input label={F.startDate} value={v.start_date} onChange={set('start_date')} type="date" />
          <Input label={F.endDate} value={v.end_date} onChange={set('end_date')} type="date" />
          <Input label={F.maxParticipants} value={v.max_participants} onChange={set('max_participants')} type="number" min={1} max={50} required />
          <Input label={F.estimatedVath} value={v.estimated_vath} onChange={set('estimated_vath')} type="number" min={1} max={1000} step={1} required />
          <div className="sm:col-span-2">
            <Select label={F.supervisor} value={v.supervisor_id} onChange={set('supervisor_id')} placeholder={t.common.select} help={F.supervisorHelp}
              options={supervisors.map((s) => ({ value: s.user_id, label: `${s.full_name} · ${t.enums.memberRole[s.member_role as keyof typeof t.enums.memberRole] ?? s.member_role}` }))} />
          </div>
        </div>
      </Section>

      <Section title={S.competencies}>
        <ul className="space-y-2">
          {comps.map((c, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-[1fr_14rem_auto]">
              <label className="sr-only" htmlFor={`comp-${i}`}>{t.challenges.competency}</label>
              <select id={`comp-${i}`} className="select" value={c.competency_id} onChange={(e) => setComps((p) => p.map((x, j) => (j === i ? { ...x, competency_id: e.target.value } : x)))}>
                <option value="">{t.common.select}</option>
                {available(c.competency_id).map((k) => <option key={k.id} value={k.id}>{competencyName(locale, k)} · {t.enums.category[k.category]}</option>)}
              </select>
              <label className="sr-only" htmlFor={`lvl-${i}`}>{F.requiredLevel}</label>
              <select id={`lvl-${i}`} className="select" value={c.required_level} onChange={(e) => setComps((p) => p.map((x, j) => (j === i ? { ...x, required_level: Number(e.target.value) } : x)))}>
                {([1, 2, 3, 4, 5] as const).map((l) => <option key={l} value={l}>{F.requiredLevel}: {l} · {t.rubric.levels[l].label}</option>)}
              </select>
              <button type="button" className="btn-ghost" onClick={() => setComps((p) => p.filter((_, j) => j !== i))} aria-label={t.common.remove}><Trash2 className="size-4" aria-hidden /></button>
            </li>
          ))}
        </ul>
        {comps.length < 10 && (
          <button type="button" className="btn-outline btn-sm" onClick={() => setComps((p) => [...p, { competency_id: '', required_level: 3 }])}><Plus className="size-4" aria-hidden /> {F.addCompetency}</button>
        )}
      </Section>

      <Section title={S.deliverables}>
        <ul className="space-y-3">
          {dels.map((d, i) => (
            <li key={i} className="grid gap-2 rounded-xl border border-ink-200 p-3 sm:grid-cols-[1fr_10rem_auto]">
              <div className="space-y-2">
                <label className="sr-only" htmlFor={`del-t-${i}`}>{F.deliverableTitle}</label>
                <input id={`del-t-${i}`} className="input" placeholder={F.deliverableTitle} value={d.title} maxLength={160} onChange={(e) => setDels((p) => p.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <label className="sr-only" htmlFor={`del-d-${i}`}>{F.deliverableDescription}</label>
                <input id={`del-d-${i}`} className="input" placeholder={F.deliverableDescription} value={d.description} maxLength={1000} onChange={(e) => setDels((p) => p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              </div>
              <div>
                <label className="sr-only" htmlFor={`del-due-${i}`}>{F.dueDate}</label>
                <input id={`del-due-${i}`} type="date" className="input" value={d.due_date} onChange={(e) => setDels((p) => p.map((x, j) => (j === i ? { ...x, due_date: e.target.value } : x)))} />
              </div>
              <button type="button" className="btn-ghost self-start" onClick={() => setDels((p) => p.filter((_, j) => j !== i))} aria-label={t.common.remove}><Trash2 className="size-4" aria-hidden /></button>
            </li>
          ))}
        </ul>
        {dels.length < 12 && (
          <button type="button" className="btn-outline btn-sm" onClick={() => setDels((p) => [...p, { id: null, title: '', description: '', due_date: '' }])}><Plus className="size-4" aria-hidden /> {F.addDeliverable}</button>
        )}
      </Section>

      <Section title={S.terms}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={F.compensationType} value={v.compensation_type} onChange={set('compensation_type')} options={COMPENSATION_TYPES.map((c) => ({ value: c, label: t.enums.compensation[c] }))} required />
          <Input label={F.compensationDetails} value={v.compensation_details} onChange={set('compensation_details')} maxLength={600} />
        </div>
        {(v.compensation_type === 'none' || unpaidOver) && <Alert tone={unpaidOver ? 'danger' : 'info'}>{t.challenges.fairWork}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={F.ipPolicy} value={v.ip_policy} onChange={set('ip_policy')} options={IP_POLICIES.map((c) => ({ value: c, label: t.enums.ipPolicy[c] }))} required />
          <Input label={F.ipDetails} value={v.ip_details} onChange={set('ip_details')} maxLength={1500} />
          <Select label={F.confidentiality} value={v.confidentiality} onChange={set('confidentiality')} options={CONFIDENTIALITY.map((c) => ({ value: c, label: t.enums.confidentiality[c] }))} required />
          <Select label={F.publicationPolicy} value={v.publication_policy} onChange={set('publication_policy')} options={PUBLICATION_POLICIES.map((c) => ({ value: c, label: t.enums.publicationPolicy[c] }))} required />
        </div>
        <Area label={F.conditions} value={v.conditions} onChange={set('conditions')} rows={3} maxLength={2000} />
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-ink-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <FormFeedback state={state} t={t} />
        <SubmitButton className={challenge ? 'btn-primary' : 'btn-outline'} name="publish" value="draft" disabled={unpaidOver}>{challenge ? t.challenges.saveChanges : t.challenges.saveDraft}</SubmitButton>
        {!challenge && organizationVerified && (
          <SubmitButton className="btn-primary" name="publish" value="recruiting" disabled={unpaidOver}>{t.challenges.publishNow}</SubmitButton>
        )}
      </div>
    </form>
  );
}
