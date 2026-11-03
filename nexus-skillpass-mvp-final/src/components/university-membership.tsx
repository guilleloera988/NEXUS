'use client';

import { useState } from 'react';
import { decideUniversityRequest, setUniversityDomains } from '@/actions/university';
import { fmt } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/client';
import { ActionForm, Field, SubmitButton } from './ui/form';
import { Dialog } from './ui/interactive';

/** Approve or reject one pending request (university staff). */
export function UniversityRequestActions({ organizationId, studentId, name }: { organizationId: string; studentId: string; name: string }) {
  const { t } = useI18n();
  const U = t.dashboard.university;
  return (
    <ActionForm action={decideUniversityRequest} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="student_id" value={studentId} />
      <SubmitButton name="decision" value="approve" className="btn-primary btn-sm" pendingLabel={t.common.saving}>
        <span aria-hidden>{U.approve}</span><span className="sr-only">{`${U.approve}: ${name}`}</span>
      </SubmitButton>
      <SubmitButton name="decision" value="reject" className="btn-outline btn-sm" pendingLabel={t.common.saving}>
        <span aria-hidden>{U.reject}</span><span className="sr-only">{`${U.reject}: ${name}`}</span>
      </SubmitButton>
    </ActionForm>
  );
}

/** Remove a linked student from the university, after a confirmation. */
export function RemoveStudentButton({ organizationId, studentId, name }: { organizationId: string; studentId: string; name: string }) {
  const { t } = useI18n();
  const U = t.dashboard.university;
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen} title={U.removeStudent} triggerClassName="btn-ghost btn-sm text-danger-700"
      trigger={<><span aria-hidden>{U.removeStudent}</span><span className="sr-only">{`${U.removeStudent}: ${name}`}</span></>}>
      <ActionForm action={decideUniversityRequest} onSuccess={() => setOpen(false)} className="space-y-4">
        <input type="hidden" name="organization_id" value={organizationId} />
        <input type="hidden" name="student_id" value={studentId} />
        <input type="hidden" name="decision" value="remove" />
        <p className="text-sm text-ink-700">{fmt(U.removeConfirm, { name })}</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setOpen(false)}>{t.common.cancel}</button>
          <SubmitButton className="btn-danger" pendingLabel={t.common.saving}>{U.removeStudent}</SubmitButton>
        </div>
      </ActionForm>
    </Dialog>
  );
}

/** The university's student e-mail domains (owners and managers). */
export function UniversityDomainsForm({ organizationId, domains }: { organizationId: string; domains: string[] }) {
  const { t } = useI18n();
  const O = t.organization;
  return (
    <ActionForm action={setUniversityDomains} className="space-y-4" success={O.domainsSaved}>
      <input type="hidden" name="organization_id" value={organizationId} />
      <Field as="textarea" label={O.domainsLabel} name="student_email_domains" defaultValue={domains.join('\n')} rows={3}
        help={O.domainsHelp} placeholder="alumnos.universidad.mx" />
      <SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton>
    </ActionForm>
  );
}
