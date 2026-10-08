'use client';

import { useId, useState } from 'react';
import { Link2, Plus, Send, Upload } from 'lucide-react';
import { addEvidence, saveTask, saveVath, submitForValidation } from '@/actions/workspace';
import { LINK_KINDS } from '@/lib/constants';
import { competencyName, formatHours } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/client';
import type { Competency, Deliverable, Evidence, Task, VathEntry } from '@/lib/types';
import { ActionForm, Checkbox, Field, SubmitButton } from '../ui/form';
import { Dialog } from '../ui/interactive';
import { Alert } from '../ui/primitives';

export function TaskDialog({ challengeId, team, deliverables, task }: {
  challengeId: string; team: { student_id: string; full_name: string }[]; deliverables: Deliverable[]; task?: Task;
}) {
  const { t } = useI18n();
  const T = t.workspace.tasks;
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen} title={task ? t.common.edit : T.add} trigger={task ? t.common.edit : <><Plus className="size-4" aria-hidden /> {T.add}</>}
      triggerClassName={task ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'}>
      <ActionForm action={saveTask} className="space-y-4" onSuccess={() => setOpen(false)}>
        <input type="hidden" name="challenge_id" value={challengeId} />
        {task && <input type="hidden" name="id" value={task.id} />}
        {task && <input type="hidden" name="status" value={task.status} />}
        <Field label={T.fields.title} name="title" required maxLength={160} defaultValue={task?.title} />
        <Field as="textarea" label={T.fields.description} name="description" maxLength={1500} rows={3} defaultValue={task?.description} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field as="select" label={T.fields.assignee} name="assignee_id" placeholder={T.unassigned} defaultValue={task?.assignee_id ?? ''}
            options={team.map((m) => ({ value: m.student_id, label: m.full_name }))} />
          <Field as="select" label={T.fields.deliverable} name="deliverable_id" placeholder={t.common.none} defaultValue={task?.deliverable_id ?? ''}
            options={deliverables.map((d) => ({ value: d.id, label: d.title }))} />
          <Field label={T.fields.dueDate} name="due_date" type="date" defaultValue={task?.due_date ?? ''} />
        </div>
        <div className="flex justify-end"><SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton></div>
      </ActionForm>
    </Dialog>
  );
}

export function EvidenceDialog({ challengeId, deliverables, tasks, competencies, publicationAllowed, maxMb, previous }: {
  challengeId: string; deliverables: Deliverable[]; tasks: Task[]; competencies: Competency[]; publicationAllowed: boolean; maxMb: number; previous?: Evidence;
}) {
  const { t, locale } = useI18n();
  const E = t.workspace.evidence;
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<'file' | 'link'>(previous?.has_file ? 'file' : previous ? 'link' : 'file');
  const fileId = useId();
  return (
    <Dialog open={open} onOpenChange={setOpen} wide title={previous ? E.newVersion : E.add}
      trigger={previous ? E.newVersion : <><Plus className="size-4" aria-hidden /> {E.add}</>} triggerClassName={previous ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'}>
      <ActionForm action={addEvidence} className="space-y-4" onSuccess={() => setOpen(false)}>
        <input type="hidden" name="challenge_id" value={challengeId} />
        <input type="hidden" name="source" value={source} />
        {previous && <input type="hidden" name="previous_id" value={previous.id} />}
        <fieldset>
          <legend className="label">{E.source}</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(['file', 'link'] as const).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={source === s} onClick={() => setSource(s)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${source === s ? 'border-ink-950 bg-ink-950 text-gold-200' : 'border-ink-300 hover:border-ink-500'}`}>
                {s === 'file' ? <Upload className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />} {s === 'file' ? E.uploadFile : E.addLink}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label={t.common.title} name="title" required maxLength={160} defaultValue={previous?.title} />
        <Field as="textarea" label={t.common.description} name="description" maxLength={2000} rows={3} defaultValue={previous?.description} />
        {source === 'file' ? (
          <div>
            <label htmlFor={fileId} className="label">{E.file}<span className="text-danger-600" aria-hidden> *</span></label>
            <input id={fileId} name="file" type="file" required className="input file:mr-3 file:rounded-lg file:border-0 file:bg-ink-950 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.csv,.zip,.pptx,.docx,.xlsx,.doc,.ppt,.xls" aria-describedby={`${fileId}-h`} />
            <p id={`${fileId}-h`} className="help">{fmt(E.fileHelp, { mb: maxMb })}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label={E.url} name="url" type="url" required placeholder="https://" help={E.urlHelp} maxLength={2048} defaultValue={previous?.url ?? ''} />
            <Field as="select" label={E.kind} name="kind" defaultValue={previous?.kind && (LINK_KINDS as readonly string[]).includes(previous.kind) ? previous.kind : 'link'}
              options={LINK_KINDS.map((k) => ({ value: k, label: t.enums.evidenceKind[k] }))} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field as="select" label={E.deliverable} name="deliverable_id" placeholder={t.common.none} defaultValue={previous?.deliverable_id ?? ''}
            options={deliverables.map((d) => ({ value: d.id, label: d.title }))} />
          <Field as="select" label={E.task} name="task_id" placeholder={t.common.none} defaultValue={previous?.task_id ?? ''}
            options={tasks.map((task) => ({ value: task.id, label: task.title }))} />
        </div>
        <fieldset>
          <legend className="label">{E.competencies}</legend>
          <div className="flex flex-wrap gap-2">
            {competencies.map((c) => (
              <label key={c.id} className="cursor-pointer">
                <input type="checkbox" name="competency_ids" value={c.id} defaultChecked={previous?.competency_ids.includes(c.id)} className="peer sr-only" />
                <span className="inline-flex rounded-full border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 peer-checked:border-ink-950 peer-checked:bg-ink-950 peer-checked:text-gold-200 peer-focus-visible:ring-4 peer-focus-visible:ring-gold-200">
                  {competencyName(locale, c)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {publicationAllowed ? <Checkbox name="is_public" label={E.makePublic} /> : <p className="text-xs text-ink-500">{E.publicNotAllowed}</p>}
        <div className="flex justify-end"><SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton></div>
      </ActionForm>
    </Dialog>
  );
}

export function VathDialog({ challengeId, tasks, evidence, entry }: { challengeId: string; tasks: Task[]; evidence: Evidence[]; entry?: VathEntry }) {
  const { t } = useI18n();
  const V = t.workspace.vath;
  const [open, setOpen] = useState(false);
  const usable = evidence.filter((e) => e.is_mine && e.status !== 'rejected');
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Dialog open={open} onOpenChange={setOpen} wide title={entry ? t.common.edit : V.add} trigger={entry ? t.common.edit : <><Plus className="size-4" aria-hidden /> {V.add}</>}
      triggerClassName={entry ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'}>
      <ActionForm action={saveVath} className="space-y-4" onSuccess={() => setOpen(false)}>
        <input type="hidden" name="challenge_id" value={challengeId} />
        {entry && <input type="hidden" name="id" value={entry.id} />}
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr_1fr]">
          <Field label={V.fields.date} name="activity_date" type="date" required defaultValue={entry?.activity_date ?? today} />
          <Field label={V.fields.activity} name="activity" required maxLength={160} defaultValue={entry?.activity} />
          <Field label={V.fields.hours} name="hours" type="number" required min={0.25} max={16} step={0.25} inputMode="decimal" defaultValue={entry?.submitted_hours ?? ''} />
        </div>
        <Field as="textarea" label={V.fields.description} name="description" required maxLength={2000} rows={3} defaultValue={entry?.description} />
        <Field as="select" label={V.fields.task} name="task_id" placeholder={t.common.none} defaultValue={entry?.task_id ?? ''}
          options={tasks.map((task) => ({ value: task.id, label: task.title }))} />
        <fieldset>
          <legend className="label">{V.fields.evidence}</legend>
          {usable.length === 0 ? <Alert tone="warning">{V.noEvidenceYet}</Alert> : (
            <ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-ink-200 p-3">
              {usable.map((e) => (
                <li key={e.id}><Checkbox name="evidence_ids" value={e.id} defaultChecked={entry?.evidence_ids.includes(e.id)}
                  label={<>{e.title} <span className="text-xs text-ink-500">· {t.enums.evidenceKind[e.kind]} · {t.status.evidence[e.status]}</span></>} /></li>
              ))}
            </ul>
          )}
          <p className="help">{V.evidenceRequired} {V.rules}</p>
        </fieldset>
        <div className="flex justify-end"><SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton></div>
      </ActionForm>
    </Dialog>
  );
}

export function SubmitPanel({ challengeId, draftVath, draftHours, draftEvidence, supervisor }: {
  challengeId: string; draftVath: number; draftHours: number; draftEvidence: number; supervisor: string;
}) {
  const { t, locale } = useI18n();
  const W = t.workspace.validation;
  if (draftVath === 0 && draftEvidence === 0) return <p className="text-sm text-ink-500">{W.nothing}</p>;
  return (
    <ActionForm action={submitForValidation} className="space-y-3" success={W.submitted}>
      <input type="hidden" name="challenge_id" value={challengeId} />
      <p className="text-sm text-ink-700">{fmt(W.submitText, { vath: draftVath, hours: formatHours(locale, draftHours), evidence: draftEvidence, supervisor })}</p>
      <Field as="textarea" label={W.note} name="note" maxLength={1000} rows={2} />
      <SubmitButton pendingLabel={t.common.saving}><Send className="size-4" aria-hidden /> {W.submit}</SubmitButton>
    </ActionForm>
  );
}
