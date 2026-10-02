'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Check, Copy, Printer, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';

export function CopyButton({ value, label, className = 'btn-outline btn-sm' }: { value: string; label?: string; className?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button type="button" onClick={copy} className={className} aria-live="polite">
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? t.common.copied : label ?? t.common.copy}
    </button>
  );
}

export function PrintButton({ label, className = 'btn-outline btn-sm' }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Printer className="size-4" aria-hidden /> {label}
    </button>
  );
}

const noopSubscribe = () => () => undefined;

export function ShareButton({ url, title, label, className = 'btn-outline btn-sm' }: { url: string; title: string; label: string; className?: string }) {
  const supported = useSyncExternalStore(noopSubscribe, () => typeof navigator.share === 'function', () => false);
  if (!supported) return <CopyButton value={url} label={label} className={className} />;
  return (
    <button type="button" className={className} onClick={() => navigator.share({ title, url }).catch(() => undefined)}>{label}</button>
  );
}

/** Accessible modal based on the native <dialog> element (focus trap and Escape handled by the browser). */
export function Dialog({ trigger, title, children, triggerClassName = 'btn-outline', wide = false, open: controlledOpen, onOpenChange }: {
  trigger?: ReactNode; title: string; children: ReactNode | ((close: () => void) => ReactNode); triggerClassName?: string; wide?: boolean;
  open?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();
  const [internal, setInternal] = useState(false);
  const open = controlledOpen ?? internal;
  const setOpen = (value: boolean) => { if (onOpenChange) onOpenChange(value); else setInternal(value); };
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  const close = () => setOpen(false);
  return (
    <>
      {trigger && <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>{trigger}</button>}
      <dialog ref={ref} onClose={close} aria-label={title}
        className={`m-auto w-[calc(100%-2rem)] ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl border border-ink-200 bg-white p-0 shadow-2xl backdrop:bg-ink-950/50 backdrop:backdrop-blur-sm`}>
        {open && (
          <div className="max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white px-5 py-4">
              <h2 className="text-lg font-bold">{title}</h2>
              <button type="button" onClick={close} className="btn-ghost btn-sm" aria-label={t.common.close}><X className="size-4" aria-hidden /></button>
            </div>
            <div className="p-5">{typeof children === 'function' ? children(close) : children}</div>
          </div>
        )}
      </dialog>
    </>
  );
}
