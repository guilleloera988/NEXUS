import en from './en';
import es, { type Messages } from './es';

export type { Messages };
export type Locale = 'es' | 'en';
export const LOCALES: Locale[] = ['es', 'en'];
export const DEFAULT_LOCALE: Locale = 'es';
export const LOCALE_COOKIE = 'sp_locale';

export const dictionaries: Record<Locale, Messages> = { es, en };
export const isLocale = (value: unknown): value is Locale => value === 'es' || value === 'en';

/** Replaces {placeholders} in a message. Unknown placeholders are left untouched. */
export function fmt(template: string, vars: Record<string, string | number | null | undefined> = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? match : String(value);
  });
}

export const intlLocale = (locale: Locale) => (locale === 'es' ? 'es-MX' : 'en-US');
