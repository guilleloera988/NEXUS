'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Compass, Loader2, RotateCcw, X } from 'lucide-react';
import { switchPersona } from '@/actions/demo';
import { DEMO_PERSONAS, type DemoPersona } from '@/lib/demo-personas';
import { GUIDE_OPEN_KEY, GUIDE_STEPS, GUIDE_STEP_KEY } from '@/lib/guide';
import { fmt } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/client';

const read = (key: string) => {
  try { return window.localStorage.getItem(key); } catch { return null; }
};
const store = (key: string, value: string) => {
  try { window.localStorage.setItem(key, value); } catch { /* private mode */ }
};

/** Floating, keyboard-accessible walkthrough for evaluators. Persists progress across persona switches. */
export function GuidedDemo({ persona }: { persona: DemoPersona | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const total = GUIDE_STEPS.length;
  const start = search.get('guide') === '1';
  // Rendered client-only (see guided-demo-loader), so localStorage is available during the first render.
  const [step, setStep] = useState(() => {
    if (start) return 0;
    const saved = Number(read(GUIDE_STEP_KEY));
    return Number.isFinite(saved) ? Math.min(Math.max(saved, 0), total - 1) : 0;
  });
  const [open, setOpen] = useState(() => start || read(GUIDE_OPEN_KEY) === '1');
  const [switching, setSwitching] = useState<DemoPersona | null>(null);
  const [seen, setSeen] = useState({ start, persona });
  if (seen.start !== start || seen.persona !== persona) {
    // Adjust state while rendering when the guide is restarted or a persona switch has landed.
    setSeen({ start, persona });
    if (start && !seen.start) { setStep(0); setOpen(true); }
    if (persona !== seen.persona) setSwitching(null);
  }
  const formRef = useRef<HTMLFormElement>(null);
  const steps = t.demo.guided.steps;

  useEffect(() => {
    if (!start) return;
    store(GUIDE_STEP_KEY, '0');
    store(GUIDE_OPEN_KEY, '1');
    const params = new URLSearchParams(search.toString());
    params.delete('guide');
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  }, [start, search, pathname, router]);

  function go(index: number) {
    const target = GUIDE_STEPS[index];
    setStep(index);
    store(GUIDE_STEP_KEY, String(index));
    if (target.persona !== persona) {
      setSwitching(target.persona);
      const form = formRef.current;
      if (form) {
        (form.elements.namedItem('persona') as HTMLInputElement).value = target.persona;
        (form.elements.namedItem('next') as HTMLInputElement).value = target.href;
        form.requestSubmit();
      }
      return;
    }
    router.push(target.href);
  }

  function toggle(value: boolean) {
    setOpen(value);
    store(GUIDE_OPEN_KEY, value ? '1' : '0');
  }

  const current = steps[step];
  const here = GUIDE_STEPS[step].href.split('?')[0] === pathname;

  return (
    <div className="no-print fixed bottom-4 right-4 z-40 w-[min(24rem,calc(100vw-2rem))]">
      <form ref={formRef} action={switchPersona} className="hidden">
        <input type="hidden" name="persona" defaultValue="student" />
        <input type="hidden" name="next" defaultValue="/dashboard" />
      </form>
      {!open ? (
        <button type="button" onClick={() => toggle(true)} className="btn-dark ml-auto flex shadow-xl ring-1 ring-gold-400/60">
          <Compass className="size-4 text-gold-300" aria-hidden /> {t.demo.guided.open} · {step + 1}/{total}
        </button>
      ) : (
        <section aria-label={t.demo.guided.title} className="overflow-hidden rounded-2xl border border-gold-300/60 bg-ink-950 text-white shadow-2xl">
          <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-gold-300" aria-hidden />
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold-300">{t.demo.guided.title}</p>
              <span className="text-xs text-ink-400">{fmt(t.demo.guided.step, { n: step + 1, total })}</span>
            </div>
            <button type="button" onClick={() => toggle(false)} className="rounded-lg p-1 text-ink-400 hover:bg-white/10 hover:text-white" aria-label={t.demo.guided.close}>
              <X className="size-4" aria-hidden />
            </button>
          </header>
          <div className="px-4 py-4" aria-live="polite">
            <ol className="mb-3 flex gap-1" aria-hidden>
              {GUIDE_STEPS.map((_, i) => <li key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-gold-400' : 'bg-white/15'}`} />)}
            </ol>
            <h2 className="text-base font-bold text-white">{step + 1}. {current.title}</h2>
            <p className="mt-1 text-sm text-ink-300">{current.text}</p>
            <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-sm text-gold-200"><span className="font-bold">{t.demo.guided.doThis}</span> {current.action}</p>
            {!here && !switching && (
              <button type="button" onClick={() => go(step)} className="mt-3 text-sm font-semibold text-gold-300 underline underline-offset-4">
                {t.common.open} → {GUIDE_STEPS[step].persona !== persona ? DEMO_PERSONAS[GUIDE_STEPS[step].persona].name : ''}
              </button>
            )}
            {switching && (
              <p className="mt-3 flex items-center gap-2 text-sm text-ink-300"><Loader2 className="size-4 animate-spin" aria-hidden /> {fmt(t.demo.guided.switching, { name: DEMO_PERSONAS[switching].name })}</p>
            )}
          </div>
          <footer className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
            <div className="flex gap-1">
              <button type="button" className="rounded-lg p-2 text-ink-300 hover:bg-white/10 disabled:opacity-40" onClick={() => go(step - 1)} disabled={step === 0 || !!switching} aria-label={t.common.previous}>
                <ArrowLeft className="size-4" aria-hidden />
              </button>
              <button type="button" className="rounded-lg p-2 text-ink-300 hover:bg-white/10" onClick={() => go(0)} disabled={!!switching} aria-label={t.demo.guided.restart}>
                <RotateCcw className="size-4" aria-hidden />
              </button>
            </div>
            {step < total - 1 ? (
              <button type="button" className="btn-primary btn-sm" onClick={() => go(step + 1)} disabled={!!switching}>
                {t.demo.guided.next} <ArrowRight className="size-4" aria-hidden />
              </button>
            ) : (
              <button type="button" className="btn-primary btn-sm" onClick={() => toggle(false)}>{t.demo.guided.finish}</button>
            )}
          </footer>
        </section>
      )}
    </div>
  );
}
