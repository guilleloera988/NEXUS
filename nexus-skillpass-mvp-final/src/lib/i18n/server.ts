import 'server-only';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { DEFAULT_LOCALE, LOCALE_COOKIE, dictionaries, isLocale, type Locale } from './index';

/** Locale from the explicit cookie, else the browser preference, else Spanish. */
export const getLocale = cache(async (): Promise<Locale> => {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  const accept = (await headers()).get('accept-language') ?? '';
  const first = accept.split(',')[0]?.trim().slice(0, 2).toLowerCase();
  return first === 'en' ? 'en' : DEFAULT_LOCALE;
});

export async function getMessages() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}
