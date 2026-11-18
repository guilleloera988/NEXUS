import type { Locale } from '@/lib/i18n';

/*
 * Legal texts (privacy notice and terms). They are DRAFTS written for review by AINDEV's lawyer and go live
 * only when the four LEGAL_* variables below are set in the deployment: until then the pages do not exist,
 * sign-up keeps its short sentence and nobody is asked to accept anything.
 *
 * LEGAL_VERSION is the date the texts were last changed. Change it together with any change to privacy.ts or
 * terms.ts: every account is then asked to accept the new version (legal_acceptances keeps one row per
 * user and version, migration 20261113000001).
 */
export const LEGAL_VERSION = '2026-11-13';

export interface LegalEntity {
  /** Legal name of the data controller (razón social), e.g. "AINDEV TECH, S.A.S. de C.V.". */
  name: string;
  /** Address for notifications (domicilio). */
  address: string;
  /** Mailbox for privacy requests (ARCO rights) and legal notices. */
  email: string;
  /** City and state whose courts the terms name, e.g. "Aguascalientes, Aguascalientes". */
  jurisdiction: string;
}

const clean = (value: string | undefined) => value?.replace(/\s+/g, ' ').trim() ?? '';

/** The entity behind the texts, or null while the deployment has not been given all four values. */
export function legalEntity(): LegalEntity | null {
  const entity = {
    name: clean(process.env.LEGAL_ENTITY_NAME),
    address: clean(process.env.LEGAL_ENTITY_ADDRESS),
    email: clean(process.env.LEGAL_CONTACT_EMAIL).toLowerCase(),
    jurisdiction: clean(process.env.LEGAL_JURISDICTION),
  };
  if (!entity.name || !entity.address || !entity.jurisdiction) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entity.email)) return null;
  return entity;
}

export type LegalBlock = string | { list: string[] };
export interface LegalSection { id: string; title: string; blocks: LegalBlock[] }
export interface LegalDocument {
  title: string;
  /** One paragraph in plain words, shown above the sections. */
  summary: string;
  sections: LegalSection[];
}
export type LegalText = (locale: Locale, entity: LegalEntity) => LegalDocument;

/** "13 de noviembre de 2026" / "November 13, 2026" for a version date. */
export function legalVersionDate(locale: Locale, version = LEGAL_VERSION) {
  const [y, m, d] = version.split('-').map(Number);
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-MX', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}
