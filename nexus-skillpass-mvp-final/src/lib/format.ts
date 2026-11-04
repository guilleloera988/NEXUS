import { intlLocale, type Locale } from './i18n';

const TZ = 'America/Mexico_City';

/** Dates stored as YYYY-MM-DD are calendar dates: format them in UTC to avoid off-by-one. */
export function formatDate(locale: Locale, value: string | null | undefined, style: 'short' | 'long' = 'short') {
  if (!value) return '—';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric', month: style === 'long' ? 'long' : 'short', year: 'numeric', timeZone: dateOnly ? 'UTC' : TZ,
  }).format(date);
}

export function formatDateTime(locale: Locale, value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ }).format(date);
}

export function formatRelative(locale: Locale, value: string | null | undefined, now = Date.now()) {
  if (!value) return '—';
  const diff = new Date(value).getTime() - now;
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  return formatDate(locale, value);
}

export function formatNumber(locale: Locale, value: number | string | null | undefined, digits = 0) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
}

/** Hours with up to two decimals (VATH can be fractional: 0.25 h steps). */
export const formatHours = (locale: Locale, value: number | string | null | undefined) => formatNumber(locale, value, 2);

export function competencyName(locale: Locale, c: { name_es: string; name_en: string } | null | undefined) {
  if (!c) return '—';
  return locale === 'es' ? c.name_es : c.name_en;
}

export function initials(name: string) {
  return name
    .replace(/^(dr|dra|mtro|mtra|lic|ing)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
