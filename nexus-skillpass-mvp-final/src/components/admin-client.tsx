'use client';

import { useRouter } from 'next/navigation';
import { Pencil, Plus, ShieldOff } from 'lucide-react';
import { revokeCredential, saveCompetency, updateIncident } from '@/actions/admin';
import { useI18n } from '@/lib/i18n/client';
import { ActionForm, Checkbox, Field, SubmitButton } from './ui/form';
import { Dialog } from './ui/interactive';

export interface AdminCompetency {
  id: string; slug: string; name_es: string; name_en: string; category: 'technical' | 'digital' | 'business' | 'human';
  description_es: string; description_en: string; is_active: boolean;
}

export function RevokeCredentialDialog({ id, code }: { id: string; code: string }) {
  const { t } = useI18n();
  const A = t.dashboard.admin;
  const router = useRouter();
  return (
    <Dialog title={`${A.revokeConfirm} · ${code}`} triggerClassName="btn-ghost btn-sm text-danger-700"
      trigger={<><ShieldOff className="size-4" aria-hidden /> {A.revoke}</>}>
      {(close) => (
        <ActionForm action={revokeCredential} className="space-y-4" onSuccess={() => { close(); router.refresh(); }}>
          <input type="hidden" name="credential_id" value={id} />
          <p className="text-sm text-ink-600">{A.revokeHelp}</p>
          <Field as="textarea" label={A.revokeReason} name="reason" required maxLength={1000} rows={3} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={close}>{t.common.cancel}</button>
            <SubmitButton className="btn-danger">{A.revokeConfirm}</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function CompetencyDialog({ competency }: { competency?: AdminCompetency }) {
  const { t } = useI18n();
  const A = t.dashboard.admin;
  const router = useRouter();
  const c = competency;
  return (
    <Dialog wide title={c ? A.editCompetency : A.newCompetency} triggerClassName={c ? 'btn-ghost btn-sm' : 'btn-dark'}
      trigger={c ? <><Pencil className="size-4" aria-hidden /><span className="sr-only">{A.editCompetency}: {c.name_es}</span></> : <><Plus className="size-4" aria-hidden /> {A.newCompetency}</>}>
      {(close) => (
        <ActionForm action={saveCompetency} className="grid gap-4 sm:grid-cols-2" onSuccess={() => { close(); router.refresh(); }}>
          {c && <input type="hidden" name="id" value={c.id} />}
          <Field label={A.cols.slug} name="slug" required defaultValue={c?.slug} maxLength={60} help={A.slugHelp} />
          <Field as="select" label={A.cols.category} name="category" required defaultValue={c?.category ?? 'technical'}
            options={(['technical', 'digital', 'business', 'human'] as const).map((k) => ({ value: k, label: t.enums.category[k] }))} />
          <Field label={A.nameEs} name="name_es" required defaultValue={c?.name_es} maxLength={80} />
          <Field label={A.nameEn} name="name_en" required defaultValue={c?.name_en} maxLength={80} />
          <Field as="textarea" label={A.descriptionEs} name="description_es" defaultValue={c?.description_es} maxLength={400} rows={3} />
          <Field as="textarea" label={A.descriptionEn} name="description_en" defaultValue={c?.description_en} maxLength={400} rows={3} />
          <div className="sm:col-span-2"><Checkbox name="is_active" label={A.competencyActive} defaultChecked={c?.is_active ?? true} /></div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-ghost" onClick={close}>{t.common.cancel}</button>
            <SubmitButton pendingLabel={t.common.saving}>{A.saveCompetency}</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function IncidentForm({ id, status, resolution }: { id: string; status: string; resolution: string }) {
  const { t } = useI18n();
  const A = t.dashboard.admin;
  return (
    <ActionForm action={updateIncident} className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end" success={t.common.saved}>
      <input type="hidden" name="incident_id" value={id} />
      <Field as="select" label={t.common.status} name="status" defaultValue={status}
        options={(['open', 'investigating', 'resolved', 'dismissed'] as const).map((s) => ({ value: s, label: t.status.incident[s] }))} />
      <Field label={A.resolution} name="resolution" defaultValue={resolution} maxLength={2000} />
      <SubmitButton className="btn-outline">{A.updateIncident}</SubmitButton>
    </ActionForm>
  );
}
