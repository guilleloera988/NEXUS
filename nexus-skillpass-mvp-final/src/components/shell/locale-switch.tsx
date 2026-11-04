import { Languages } from 'lucide-react';
import { setLocale } from '@/actions/locale';
import type { Locale } from '@/lib/i18n';

/** Progressive-enhancement language toggle (works without JavaScript). */
export function LocaleSwitch({ locale, tone = 'light' }: { locale: Locale; tone?: 'light' | 'dark' }) {
  const next: Locale = locale === 'es' ? 'en' : 'es';
  return (
    <form action={setLocale}>
      <input type="hidden" name="locale" value={next} />
      <button type="submit" lang={next} aria-label={next === 'en' ? 'Switch to English' : 'Cambiar a español'}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold uppercase tracking-wide ${tone === 'dark' ? 'text-ink-300 hover:bg-white/10 hover:text-white' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-950'}`}>
        <Languages className="size-4" aria-hidden /> {next}
      </button>
    </form>
  );
}
