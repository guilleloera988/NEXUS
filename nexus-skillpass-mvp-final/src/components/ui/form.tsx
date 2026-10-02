'use client';

import { useActionState, useEffect, useId, useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { IDLE, type ActionState } from '@/lib/action-state';
import { fmt, type Messages } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/client';

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function errorText(t: Messages, state: ActionState) {
  if (!state.error) return '';
  const template = (t.errors as Record<string, string>)[state.error] ?? t.errors.generic;
  const fieldKey = state.field?.split('.')[0] ?? '';
  const field = (t.fields as Record<string, string>)[fieldKey] ?? state.field ?? '';
  return fmt(template, { field });
}

/** Form bound to a Server Action with accessible success/error feedback. */
export function ActionForm({ action, children, className = '', success, resetOnSuccess = false, onSuccess, id }: {
  action: Action; children: ReactNode; className?: string; success?: string; resetOnSuccess?: boolean;
  onSuccess?: (state: ActionState) => void; id?: string;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const { t } = useI18n();
  const ref = useRef<HTMLFormElement>(null);
  const last = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!state.at || state.at === last.current) return;
    last.current = state.at;
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state);
    }
  }, [state, resetOnSuccess, onSuccess]);
  return (
    <form ref={ref} action={formAction} className={className} id={id}>
      {children}
      <FormFeedback state={state} success={success} t={t} />
    </form>
  );
}

export function FormFeedback({ state, success, t }: { state: ActionState; success?: string; t: Messages }) {
  if (!state.at) return <div aria-live="polite" className="sr-only" />;
  if (state.ok) {
    return success ? (
      <p role="status" aria-live="polite" className="mt-3 rounded-lg bg-success-50 px-3 py-2 text-sm font-medium text-success-700">{success}</p>
    ) : <div aria-live="polite" className="sr-only">{t.common.done}</div>;
  }
  return <p role="alert" className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm font-medium text-danger-700">{errorText(t, state)}</p>;
}

export function SubmitButton({ children, className = 'btn-primary', pendingLabel, name, value, disabled, form }: {
  children: ReactNode; className?: string; pendingLabel?: string; name?: string; value?: string; disabled?: boolean; form?: string;
}) {
  const { pending, data } = useFormStatus();
  const mine = !name || !data || data.get(name) === value;
  const busy = pending && mine;
  return (
    <button type="submit" className={className} disabled={pending || disabled} aria-busy={busy} name={name} value={value} form={form}>
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {busy && pendingLabel ? pendingLabel : children}
    </button>
  );
}

type FieldProps = {
  label: string; name: string; help?: string; required?: boolean; className?: string;
} & ({ as?: 'input'; type?: string; defaultValue?: string | number | null; placeholder?: string; min?: number; max?: number; step?: number | string; autoComplete?: string; maxLength?: number; inputMode?: 'numeric' | 'decimal' | 'email' | 'url' | 'text' }
  | { as: 'textarea'; defaultValue?: string | null; placeholder?: string; rows?: number; maxLength?: number }
  | { as: 'select'; defaultValue?: string | null; options: { value: string; label: string }[]; placeholder?: string });

export function Field(props: FieldProps) {
  const id = useId();
  const helpId = props.help ? `${id}-help` : undefined;
  const { label, name, help, required, className = '' } = props;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}{required && <span className="text-danger-600" aria-hidden> *</span>}
      </label>
      {props.as === 'textarea' ? (
        <textarea id={id} name={name} className="textarea" defaultValue={props.defaultValue ?? ''} placeholder={props.placeholder}
          rows={props.rows ?? 4} maxLength={props.maxLength} required={required} aria-describedby={helpId} />
      ) : props.as === 'select' ? (
        <select id={id} name={name} className="select" defaultValue={props.defaultValue ?? ''} required={required} aria-describedby={helpId}>
          {props.placeholder !== undefined && <option value="">{props.placeholder}</option>}
          {props.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input id={id} name={name} className="input" type={props.type ?? 'text'} defaultValue={props.defaultValue ?? ''} placeholder={props.placeholder}
          min={props.min} max={props.max} step={props.step} autoComplete={props.autoComplete} maxLength={props.maxLength} inputMode={props.inputMode}
          required={required} aria-describedby={helpId} />
      )}
      {help && <p id={helpId} className="help">{help}</p>}
    </div>
  );
}

export function Checkbox({ name, label, help, defaultChecked, value }: { name: string; label: ReactNode; help?: string; defaultChecked?: boolean; value?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="checkbox" aria-describedby={help ? `${id}-help` : undefined} />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-ink-900">{label}</label>
        {help && <p id={`${id}-help`} className="help">{help}</p>}
      </div>
    </div>
  );
}

/** Toggle-chip multi-select backed by native checkboxes (keyboard and screen-reader friendly). */
export function ChipGroup({ name, legend, options, defaultValues = [], help, max }: {
  name: string; legend: string; options: { value: string; label: string; hint?: string }[]; defaultValues?: string[]; help?: string; max?: number;
}) {
  const id = useId();
  return (
    <fieldset aria-describedby={help ? `${id}-help` : undefined}>
      <legend className="label">{legend}</legend>
      <div className="flex flex-wrap gap-2" data-max={max}>
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer" title={o.hint}>
            <input type="checkbox" name={name} value={o.value} defaultChecked={defaultValues.includes(o.value)} className="peer sr-only" />
            <span className="inline-flex items-center rounded-full border border-ink-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 transition
              peer-checked:border-ink-950 peer-checked:bg-ink-950 peer-checked:text-gold-200 peer-focus-visible:ring-4 peer-focus-visible:ring-gold-200">
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {help && <p id={`${id}-help`} className="help">{help}</p>}
    </fieldset>
  );
}
