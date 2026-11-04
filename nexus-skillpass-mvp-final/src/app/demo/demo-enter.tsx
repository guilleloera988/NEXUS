'use client';

import { useActionState } from 'react';
import { ArrowRight, Building2, ClipboardCheck, GraduationCap, Shield, UserRound } from 'lucide-react';
import { enterDemo } from '@/actions/demo';
import { FormFeedback, SubmitButton } from '@/components/ui/form';
import { IDLE } from '@/lib/action-state';
import type { DemoPersona } from '@/lib/demo-personas';
import { fmt } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/client';

const ICONS: Record<DemoPersona, typeof UserRound> = { student: UserRound, company: Building2, supervisor: ClipboardCheck, university: GraduationCap, admin: Shield };

export function StartGuided() {
  const { t } = useI18n();
  const [state, action] = useActionState(enterDemo, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="persona" value="student" />
      <input type="hidden" name="next" value="/dashboard?guide=1" />
      <input type="hidden" name="fresh" value="1" />
      <SubmitButton className="btn-primary btn-lg" pendingLabel={t.demo.entering}>{t.demo.startGuided} <ArrowRight className="size-5" aria-hidden /></SubmitButton>
      <FormFeedback state={state} t={t} />
    </form>
  );
}

export function PersonaCard({ persona }: { persona: DemoPersona }) {
  const { t } = useI18n();
  const [state, action] = useActionState(enterDemo, IDLE);
  const info = t.demo.personas[persona];
  const Icon = ICONS[persona];
  return (
    <form action={action} className="card flex flex-col p-5">
      <input type="hidden" name="persona" value={persona} />
      <input type="hidden" name="next" value="/dashboard" />
      <span className="grid size-11 place-items-center rounded-xl bg-ink-950 text-gold-300"><Icon className="size-5" aria-hidden /></span>
      <h3 className="mt-4 font-bold">{info.name}</h3>
      <p className="text-xs font-semibold text-gold-700">{info.role}</p>
      <p className="mt-2 flex-1 text-sm text-ink-600">{info.text}</p>
      <SubmitButton className="btn-dark mt-4 w-full" pendingLabel={t.demo.entering}>{fmt(t.demo.enter, { name: info.name.split(' ')[0] })}</SubmitButton>
      <FormFeedback state={state} t={t} />
    </form>
  );
}
