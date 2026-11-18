import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { dictionaries, fmt, intlLocale, type Locale } from '@/lib/i18n';
import type { OwnCredential } from '@/lib/types';
import { CREDENTIALS_V2, OPEN_BADGES_V3 } from './data-integrity';

/*
 * A SkillPass credential as an Open Badges 3.0 OpenBadgeCredential (1EdTech, VC Data Model 2.0).
 *
 *   achievement        the challenge, as the learner completed it (MicroCredential)
 *   alignment          each verified competency, pointing to the public competency framework
 *   resultDescription  verified hours (VATH) and, per competency, the 1–5 rubric (level 3 required)
 *   result             the verified hours and the level reached in each competency
 *   evidence           the public verification page (and evidence the learner made public)
 *   credentialStatus   a Bitstring Status List, so a revocation in SkillPass reaches every copy
 *
 * No credentialSchema: its type (1EdTechJsonSchemaValidator2019) is only defined in the OB extensions context, and
 * every extra context is one more document a verifier must have; the property is optional.
 *
 * Confidential challenges stay confidential: the same fields the public verification hides (challenge,
 * company, supervisor, exact dates) are left out. The recipient is identified by a salted SHA-256 of their
 * e-mail address, as the specification recommends, and by the name shown on the public verification.
 */
/** W3C Bitstring Status List minimum size (16 KB), so every list looks alike. */
export const STATUS_LIST_BITS = 131_072;

/** RFC 4122 name-based UUID (SHA-1): stable identifiers for the parts of one credential. */
export function uuidv5(name: string, namespace: string): string {
  const hash = createHash('sha1').update(Buffer.from(namespace.replace(/-/g, ''), 'hex')).update(name, 'utf8').digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.subarray(0, 16).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** xsd:dateTime in UTC, whole seconds: 2026-11-18T10:00:00Z. */
export const dateTimeZ = (value: string | number | Date) => new Date(value).toISOString().replace(/\.\d{3}Z$/, 'Z');

export type OpenBadgeSource = Pick<OwnCredential, 'id' | 'code' | 'issued_at' | 'is_demo' | 'confidential' | 'challenge_title' | 'organization_name'
  | 'industry' | 'start_date' | 'end_date' | 'verified_hours' | 'competencies' | 'supervisor_name' | 'supervisor_title' | 'evidence_approved' | 'public_evidence'>;

export interface OpenBadgeInput {
  locale: Locale;
  credential: OpenBadgeSource;
  holder: { name: string; email: string };
  issuer: { id: string; name: string; url: string; image: string; email?: string | null };
  /** The organization behind a challenge that is not confidential. */
  organization: { id: string } | null;
  urls: { verify: string; status: string; framework: string; image: string; evidenceFile: (evidenceId: string) => string };
}

const isAbsoluteUrl = (value: string | null | undefined): value is string => {
  if (!value) return false;
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

function industryLabel(locale: Locale, industry: string | null | undefined) {
  const label = industry ? (dictionaries[locale].enums.industries as Record<string, string>)[industry] ?? industry : '';
  return { label, text: label.toLocaleLowerCase(intlLocale(locale)) };
}

/** The challenge as it may be shown outside SkillPass: confidential ones by their industry only. */
export function challengeName(locale: Locale, c: Pick<OpenBadgeSource, 'confidential' | 'challenge_title' | 'industry'>) {
  const O = dictionaries[locale].openBadge;
  const { text } = industryLabel(locale, c.industry);
  if (!c.confidential && c.challenge_title) return c.challenge_title;
  return text ? fmt(O.confidentialChallenge, { industry: text }) : O.confidentialChallengePlain;
}

/** "SkillPass: <challenge>", the name of the credential in wallets and on LinkedIn. */
export function credentialName(locale: Locale, c: Pick<OpenBadgeSource, 'confidential' | 'challenge_title' | 'industry' | 'is_demo'>) {
  const O = dictionaries[locale].openBadge;
  const name = fmt(O.credentialName, { challenge: challengeName(locale, c) });
  return c.is_demo ? fmt(O.demoName, { name }) : name;
}

export function buildOpenBadge({ locale, credential: c, holder, issuer, organization, urls }: OpenBadgeInput): Record<string, unknown> {
  const t = dictionaries[locale];
  const O = t.openBadge;
  const id = (name: string) => `urn:uuid:${uuidv5(name, c.id)}`;
  const { label: industry, text: industryText } = industryLabel(locale, c.industry);
  const challenge = challengeName(locale, c);
  const organizationName = c.confidential || !c.organization_name ? O.confidentialOrganization : c.organization_name;
  const hours = Number(c.verified_hours) || 0;
  const hoursText = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 }).format(hours);

  const name = credentialName(locale, c);
  let description = fmt(O.credentialDescription, { hours: hoursText, competencies: c.competencies.length });
  if (c.is_demo) description = `${O.demoDescription} ${description}`;

  const levels = [1, 2, 3, 4, 5] as const;
  const levelId = (slug: string, level: number) => id(`level:${slug}:${level}`);
  const resultId = (slug: string) => id(`result:competency:${slug}`);
  const hoursId = id('result:hours');
  const alignment = (k: OpenBadgeSource['competencies'][number]) => ({
    type: ['Alignment'],
    targetName: locale === 'es' ? k.name_es : k.name_en,
    targetUrl: `${urls.framework}#${k.slug}`,
    targetCode: k.slug,
    targetFramework: t.framework.title,
  });
  const orgProfile = !c.confidential && organization && c.organization_name
    ? { id: `urn:uuid:${organization.id}`, type: ['Profile'], name: c.organization_name }
    : null;

  const achievement: Record<string, unknown> = {
    id: id('achievement'),
    type: ['Achievement'],
    achievementType: 'MicroCredential',
    name: challenge,
    description: fmt(O.achievementDescription, { industry: industryText || '—', organization: organizationName }),
    criteria: { narrative: O.criteria },
    image: { id: urls.image, type: 'Image', caption: O.imageCaption },
    inLanguage: locale,
    alignment: c.competencies.map(alignment),
    resultDescription: [
      { id: hoursId, type: ['ResultDescription'], name: O.hours, resultType: 'RawScore', valueMin: '0' },
      ...c.competencies.map((k) => ({
        id: resultId(k.slug),
        type: ['ResultDescription'],
        name: fmt(O.competency, { name: locale === 'es' ? k.name_es : k.name_en }),
        resultType: 'RubricCriterionLevel',
        alignment: [alignment(k)],
        requiredLevel: levelId(k.slug, 3),
        rubricCriterionLevel: levels.map((n) => ({
          id: levelId(k.slug, n),
          type: ['RubricCriterionLevel'],
          name: t.rubric.levels[n].label,
          description: t.rubric.levels[n].hint,
          level: String(n),
          points: String(n),
        })),
      })),
    ],
  };
  if (industry) achievement.fieldOfStudy = industry;
  if (orgProfile) achievement.creator = orgProfile;

  const email = holder.email.trim().toLowerCase();
  const salt = createHash('sha256').update(`skillpass-recipient:${c.id}`).digest('hex').slice(0, 32);
  const subject: Record<string, unknown> = {
    type: ['AchievementSubject'],
    name: holder.name,
    identifier: [{
      type: 'IdentityObject',
      identityHash: `sha256$${createHash('sha256').update(email + salt, 'utf8').digest('hex')}`,
      identityType: 'emailAddress',
      hashed: true,
      salt,
    }],
    achievement,
    result: [
      { type: ['Result'], resultDescription: hoursId, value: String(hours) },
      ...c.competencies.map((k) => ({ type: ['Result'], resultDescription: resultId(k.slug), achievedLevel: levelId(k.slug, k.level) })),
    ],
  };
  if (!c.confidential && c.start_date) subject.activityStartDate = `${c.start_date.slice(0, 10)}T00:00:00Z`;
  if (!c.confidential && c.end_date) subject.activityEndDate = `${c.end_date.slice(0, 10)}T00:00:00Z`;
  if (orgProfile) subject.source = orgProfile;

  const validator = !c.confidential && c.supervisor_name
    ? fmt(O.validatedBy, { name: c.supervisor_title ? `${c.supervisor_name} (${c.supervisor_title})` : c.supervisor_name })
    : '';
  const evidence: Record<string, unknown>[] = [{
    id: urls.verify,
    type: ['Evidence'],
    name: O.evidenceName,
    description: [fmt(O.evidenceDescription, { n: c.evidence_approved }), validator].filter(Boolean).join(' '),
  }];
  for (const e of c.public_evidence) {
    const url = e.has_file ? urls.evidenceFile(e.id) : e.url;
    if (isAbsoluteUrl(url)) evidence.push({ id: url, type: ['Evidence'], name: e.title });
  }

  const issuerProfile: Record<string, unknown> = {
    id: issuer.id,
    type: ['Profile'],
    name: issuer.name,
    url: issuer.url,
    description: O.issuerDescription,
    image: { id: issuer.image, type: 'Image' },
  };
  if (issuer.email) issuerProfile.email = issuer.email;

  return {
    '@context': [CREDENTIALS_V2, OPEN_BADGES_V3],
    id: `urn:uuid:${c.id}`,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    name,
    description,
    image: { id: urls.image, type: 'Image', caption: name },
    issuer: issuerProfile,
    validFrom: dateTimeZ(c.issued_at),
    awardedDate: dateTimeZ(c.issued_at),
    credentialSubject: subject,
    evidence,
    credentialStatus: {
      id: `${urls.status}#0`,
      type: 'BitstringStatusListEntry',
      statusPurpose: 'revocation',
      statusListIndex: '0',
      statusListCredential: urls.status,
    },
  };
}

/** GZIP + base64url (no padding) + multibase 'u': the encodedList of a Bitstring Status List. */
export function encodeStatusList(revokedIndexes: number[]): string {
  const bits = new Uint8Array(STATUS_LIST_BITS / 8);
  // Index 0 is the left-most (most significant) bit of the first byte.
  for (const index of revokedIndexes) bits[index >> 3] |= 0x80 >> (index & 7);
  return `u${gzipSync(bits).toString('base64url')}`;
}

/**
 * The status list a verifier fetches for one credential (index 0): one list per credential, built from the
 * credential's current status each time, so a revocation is visible to verifiers at once.
 */
export function buildStatusList({ issuer, url, revoked, now = Date.now() }: { issuer: string; url: string; revoked: boolean; now?: number }) {
  return {
    '@context': [CREDENTIALS_V2],
    id: url,
    type: ['VerifiableCredential', 'BitstringStatusListCredential'],
    issuer,
    validFrom: dateTimeZ(now),
    // A copy someone kept from before a revocation stops being usable within a day.
    validUntil: dateTimeZ(now + 24 * 3600 * 1000),
    credentialSubject: { id: `${url}#list`, type: 'BitstringStatusList', statusPurpose: 'revocation', encodedList: encodeStatusList(revoked ? [0] : []) },
  };
}

/** LinkedIn "Add to profile" link for a certification. */
export function linkedInAddToProfileUrl({ name, organizationName, organizationId, issuedAt, certUrl, certId }: {
  name: string; organizationName: string; organizationId?: string | null; issuedAt: string; certUrl: string; certId: string;
}) {
  const issued = new Date(issuedAt);
  const params = new URLSearchParams({ startTask: 'CERTIFICATION_NAME', name });
  if (organizationId && /^\d+$/.test(organizationId)) params.set('organizationId', organizationId);
  else params.set('organizationName', organizationName);
  params.set('issueYear', String(issued.getUTCFullYear()));
  params.set('issueMonth', String(issued.getUTCMonth() + 1));
  params.set('certUrl', certUrl);
  params.set('certId', certId);
  return `https://www.linkedin.com/profile/add?${params}`;
}
