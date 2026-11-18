import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contexts as credentialsContexts } from '@digitalbazaar/credentials-context';
import { DataIntegrityProof } from '@digitalbazaar/data-integrity';
import { cryptosuite as eddsaRdfc2022 } from '@digitalbazaar/eddsa-rdfc-2022-cryptosuite';
import * as vc from '@digitalbazaar/vc';
import { checkStatus } from '@digitalbazaar/vc-bitstring-status-list';
import multikeyContext from '@digitalbazaar/multikey-context';
import didContext from 'did-context';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import credentialsV2 from '@/lib/credentials/contexts/credentials-v2.json';
import openBadgesV3 from '@/lib/credentials/contexts/ob-v3p0-3.0.3.json';
import { addProof, canonize, privateKeyFromSeed, rawPublicKey, verifyProof } from '@/lib/credentials/data-integrity';
import { base58btcDecode, base58btcEncode, parsePublicKeyMultibase, parseSecretKeyMultibase, publicKeyMultibase, secretKeyMultibase } from '@/lib/credentials/multikey';
import { STATUS_LIST_BITS, buildOpenBadge, buildStatusList, linkedInAddToProfileUrl, uuidv5, type OpenBadgeInput } from '@/lib/credentials/open-badge';
import { credentialIssuer, didDocument, issuerDid, signWithIssuer } from '@/lib/server/open-badges';

const fixture = (name: string) => readFileSync(`tests/fixtures/vc-di-eddsa/${name}`, 'utf8');
const json = (name: string) => JSON.parse(fixture(name));
// The W3C examples context: every term maps into the examples vocabulary.
const EXAMPLES = { 'https://www.w3.org/ns/credentials/examples/v2': { '@context': { '@vocab': 'https://www.w3.org/ns/credentials/examples#' } } };

describe('eddsa-rdfc-2022 (W3C test vectors)', () => {
  const keys = json('keyPair.json') as { publicKeyMultibase: string; privateKeyMultibase: string };

  it('reads and writes Ed25519 Multikeys', () => {
    const seed = parseSecretKeyMultibase(keys.privateKeyMultibase)!;
    expect(seed).toHaveLength(32);
    expect(secretKeyMultibase(seed)).toBe(keys.privateKeyMultibase);
    expect(publicKeyMultibase(rawPublicKey(privateKeyFromSeed(seed)))).toBe(keys.publicKeyMultibase);
    expect(parsePublicKeyMultibase(keys.publicKeyMultibase)).toEqual(rawPublicKey(privateKeyFromSeed(seed)));
    expect(parseSecretKeyMultibase(keys.publicKeyMultibase)).toBeNull();
    expect(parsePublicKeyMultibase(keys.privateKeyMultibase)).toBeNull();
    for (const bad of ['', 'z', 'zz0OIl', 'u' + keys.privateKeyMultibase.slice(1), keys.privateKeyMultibase.slice(0, -2)]) expect(parseSecretKeyMultibase(bad)).toBeNull();
    const bytes = Uint8Array.of(0, 0, 1, 2, 255, 0);
    expect(base58btcDecode(base58btcEncode(bytes))).toEqual(bytes);
  });

  it('produces the published canonical forms, hash and proof', async () => {
    const unsigned = json('unsigned.json');
    expect(await canonize(unsigned, EXAMPLES)).toBe(fixture('canonDocDataInt.txt'));
    const options = json('proofConfigDataInt.json');
    delete options.proofValue;
    expect(await canonize(options, EXAMPLES)).toBe(fixture('proofCanonDataInt.txt'));
    const combined = Buffer.concat([
      createHash('sha256').update(fixture('proofCanonDataInt.txt')).digest(),
      createHash('sha256').update(fixture('canonDocDataInt.txt')).digest(),
    ]).toString('hex');
    expect(combined).toBe(fixture('combinedHashDataInt.txt').trim());

    const signed = await addProof(unsigned, privateKeyFromSeed(parseSecretKeyMultibase(keys.privateKeyMultibase)!),
      { verificationMethod: options.verificationMethod, created: options.created }, EXAMPLES);
    expect(signed).toEqual(json('signedDataInt.json'));
    expect(await verifyProof(signed, parsePublicKeyMultibase(keys.publicKeyMultibase)!, EXAMPLES)).toBe(true);
  });

  it('rejects any change to the document or the proof', async () => {
    const signed = json('signedDataInt.json');
    const key = parsePublicKeyMultibase(keys.publicKeyMultibase)!;
    expect(await verifyProof({ ...signed, name: 'Otro nombre' }, key, EXAMPLES)).toBe(false);
    expect(await verifyProof({ ...signed, proof: { ...signed.proof, created: '2024-01-01T00:00:00Z' } }, key, EXAMPLES)).toBe(false);
    expect(await verifyProof({ ...signed, proof: { ...signed.proof, cryptosuite: 'eddsa-jcs-2022' } }, key, EXAMPLES)).toBe(false);
    const other = rawPublicKey(privateKeyFromSeed(new Uint8Array(32).fill(7)));
    expect(await verifyProof(signed, other, EXAMPLES)).toBe(false);
    // A property no context defines can neither be signed nor slip past verification.
    await expect(canonize({ ...json('unsigned.json'), '@context': ['https://www.w3.org/ns/credentials/v2'], alumniOf: 'x' })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------------------------------------
// A SkillPass credential as an Open Badge, checked with an independent implementation (Digital Bazaar)
// ---------------------------------------------------------------------------------------------------------
const ORIGIN = 'https://skillpass.test';
const KEY = secretKeyMultibase(new Uint8Array(32).map((_, i) => i + 1));
const SAMPLE: OpenBadgeInput['credential'] = {
  id: '80000000-0000-4000-8000-000000000001', code: 'SKP-2026-4A7C-91D2', issued_at: '2026-08-30T15:04:05.123Z', is_demo: false, confidential: false,
  challenge_title: 'Reducción de paros en Línea 3', organization_name: 'Aceros del Centro', industry: 'manufacturing',
  start_date: '2026-06-01', end_date: '2026-08-15', verified_hours: 80.5,
  competencies: [
    { competency_id: '30000000-0000-4000-8000-000000000002', slug: 'data-analysis', name_es: 'Análisis de datos', name_en: 'Data Analysis', category: 'technical', level: 4 },
    { competency_id: '30000000-0000-4000-8000-000000000011', slug: 'communication', name_es: 'Comunicación efectiva', name_en: 'Effective Communication', category: 'human', level: 3 },
  ],
  supervisor_name: 'Carlos Méndez', supervisor_title: 'Gerente de Mejora Continua', evidence_approved: 6,
  public_evidence: [
    { id: '60000000-0000-4000-8000-000000000001', title: 'Tablero de paros', kind: 'link', url: 'https://example.org/tablero', has_file: false, file_name: null },
    { id: '60000000-0000-4000-8000-000000000002', title: 'Informe final', kind: 'file', url: null, has_file: true, file_name: 'informe.pdf' },
    { id: '60000000-0000-4000-8000-000000000003', title: 'Enlace roto', kind: 'link', url: 'javascript:alert(1)', has_file: false, file_name: null },
  ],
};
const status = `${ORIGIN}/credentials/status/${SAMPLE.code}`;
const input = (over: Partial<OpenBadgeInput> = {}): OpenBadgeInput => ({
  locale: 'es', credential: SAMPLE, holder: { name: 'María Torres', email: ' Maria.Torres@Example.com ' },
  issuer: { id: issuerDid(ORIGIN), name: 'SkillPass by AINDEV NEXUS', url: ORIGIN, image: `${ORIGIN}/brand/skillpass-mark.png` },
  organization: { id: '20000000-0000-4000-8000-000000000001' },
  urls: { verify: `${ORIGIN}/verify/${SAMPLE.code}`, status, framework: `${ORIGIN}/competencies`, image: `${ORIGIN}/brand/skillpass-mark.png`,
    evidenceFile: (id) => `${ORIGIN}/api/public/evidence/${id}` },
  ...over,
});

const env = { ...process.env };
beforeEach(() => { process.env.CREDENTIAL_SIGNING_KEY = KEY; delete process.env.CREDENTIAL_PREVIOUS_KEYS; });
afterEach(() => { process.env = { ...env }; });

type Doc = Record<string, unknown>;
/** What a verifier on the internet would fetch: contexts, the DID document and the status list. */
function loader(extra: Record<string, Doc> = {}) {
  const issuer = credentialIssuer(ORIGIN)!;
  const docs: Record<string, Doc> = {
    'https://www.w3.org/ns/credentials/v2': credentialsV2 as Doc,
    'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json': openBadgesV3 as Doc,
    'https://www.w3.org/ns/did/v1': didContext.contexts.get('https://www.w3.org/ns/did/v1') as Doc,
    'https://w3id.org/security/multikey/v1': multikeyContext.CONTEXT as Doc,
    [issuer.did]: didDocument(issuer),
    ...extra,
  };
  return async (url: string) => {
    if (docs[url]) return { contextUrl: null, documentUrl: url, document: docs[url] };
    const [base] = url.split('#');
    const controller = docs[base] as { '@context': unknown; verificationMethod?: { id: string }[] } | undefined;
    const method = controller?.verificationMethod?.find((m) => m.id === url);
    if (method) return { contextUrl: null, documentUrl: url, document: { '@context': controller!['@context'], ...method } };
    throw new Error(`not available to the verifier: ${url}`);
  };
}
const suite = () => new DataIntegrityProof({ cryptosuite: eddsaRdfc2022 });
async function verifyIndependently(credential: Doc, statusList: Doc | null) {
  try {
    return await vc.verifyCredential({ credential, suite: suite(), documentLoader: loader(statusList ? { [status]: statusList } : {}), checkStatus });
  } catch (error) {
    const e = error as { message: string; details?: unknown };
    throw new Error(`${e.message} ${JSON.stringify(e.details ?? {}).slice(0, 1500)}`);
  }
}

describe('Open Badges 3.0 credential', () => {
  it('is signed by the SkillPass DID and verifies with an independent implementation, status included', async () => {
    const issuer = credentialIssuer(ORIGIN)!;
    expect(issuer.did).toBe('did:web:skillpass.test');
    const signed = await signWithIssuer(buildOpenBadge(input()), issuer);
    const list = await signWithIssuer(buildStatusList({ issuer: issuer.did, url: status, revoked: false }), issuer);
    const result = await verifyIndependently(signed, list);
    expect(result.error ?? null).toBeNull();
    expect(result.verified).toBe(true);
    expect(result.statusResult?.verified).toBe(true);
    expect(result.statusResult?.results?.[0]?.status).toBe(false);
  });

  it('a revocation reaches every copy through the status list', async () => {
    const issuer = credentialIssuer(ORIGIN)!;
    const signed = await signWithIssuer(buildOpenBadge(input()), issuer);
    const revoked = await signWithIssuer(buildStatusList({ issuer: issuer.did, url: status, revoked: true }), issuer);
    const result = await verifyIndependently(signed, revoked);
    // The signature is still SkillPass's; the status check is what reports the revocation.
    expect(result.statusResult?.verified).toBe(true);
    expect(result.statusResult?.results?.[0]?.status).toBe(true);
    const bits = gunzipSync(Buffer.from((revoked.credentialSubject as { encodedList: string }).encodedList.slice(1), 'base64url'));
    expect(bits).toHaveLength(STATUS_LIST_BITS / 8);
    expect([bits[0], bits.subarray(1).some((b) => b !== 0)]).toEqual([0x80, false]);
  });

  it('does not verify after any change, with another key, or with a status list from someone else', async () => {
    const issuer = credentialIssuer(ORIGIN)!;
    const signed = await signWithIssuer(buildOpenBadge(input()), issuer);
    const list = await signWithIssuer(buildStatusList({ issuer: issuer.did, url: status, revoked: false }), issuer);
    const tampered = structuredClone(signed) as unknown as Doc & { credentialSubject: { result: { value?: string }[] } };
    tampered.credentialSubject.result[0].value = '800';
    expect((await verifyIndependently(tampered, list)).verified).toBe(false);
    process.env.CREDENTIAL_SIGNING_KEY = secretKeyMultibase(new Uint8Array(32).fill(9));
    const forged = await signWithIssuer(buildOpenBadge(input()), credentialIssuer(ORIGIN)!);
    process.env.CREDENTIAL_SIGNING_KEY = KEY;
    expect((await verifyIndependently(forged, list)).verified).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Conformance with the Open Badges 3.0 data model (1EdTech, ob_v3p0 + common credentials models)
// ---------------------------------------------------------------------------------------------------------
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const URI = /^[a-z][a-z0-9+.-]*:\S+$/i;
const DATE_TIME_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const ACHIEVEMENT_TYPES = ['Achievement', 'ApprenticeshipCertificate', 'Assessment', 'Assignment', 'AssociateDegree', 'Award', 'Badge', 'BachelorDegree',
  'Certificate', 'CertificateOfCompletion', 'Certification', 'CommunityService', 'Competency', 'Course', 'CoCurricular', 'Degree', 'Diploma',
  'DoctoralDegree', 'Fieldwork', 'GeneralEducationDevelopment', 'JourneymanCertificate', 'LearningProgram', 'License', 'Membership',
  'ProfessionalDoctorate', 'QualityAssuranceCredential', 'MasterCertificate', 'MasterDegree', 'MicroCredential', 'ResearchDoctorate', 'SecondarySchoolDiploma'];
const RESULT_TYPES = ['GradePointAverage', 'LetterGrade', 'Percent', 'PerformanceLevel', 'PredictedScore', 'RawScore', 'Result', 'RubricCriterion',
  'RubricCriterionLevel', 'RubricScore', 'ScaledScore', 'Status'];
const types = (value: unknown) => (Array.isArray(value) ? value : [value]);

/** The required properties and vocabularies of every class SkillPass uses; returns what is wrong. */
function modelProblems(vcDoc: Any): string[] {
  const out: string[] = [];
  const need = (ok: unknown, what: string) => { if (!ok) out.push(what); };
  need(vcDoc['@context'][0] === 'https://www.w3.org/ns/credentials/v2', '@context[0]');
  need(/^https:\/\/purl\.imsglobal\.org\/spec\/ob\/v3p0\/context(-3\.\d\.\d)*\.json$/.test(vcDoc['@context'][1]), '@context[1]');
  need(URI.test(vcDoc.id), 'id');
  need(types(vcDoc.type).includes('VerifiableCredential') && types(vcDoc.type).includes('OpenBadgeCredential'), 'type');
  need(URI.test(vcDoc.issuer?.id) && types(vcDoc.issuer?.type).includes('Profile'), 'issuer');
  need(DATE_TIME_Z.test(vcDoc.validFrom) && DATE_TIME_Z.test(vcDoc.awardedDate), 'validFrom/awardedDate');
  const image = (img: Any | undefined, where: string) => { if (img) need(URI.test(img.id) && img.type === 'Image', `${where}.image`); };
  image(vcDoc.image, 'credential'); image(vcDoc.issuer.image, 'issuer');
  const subject = vcDoc.credentialSubject;
  need(types(subject.type).includes('AchievementSubject'), 'subject.type');
  need(subject.id || subject.identifier?.length, 'subject id or identifier');
  for (const id of subject.identifier ?? []) {
    need(id.type === 'IdentityObject' && typeof id.hashed === 'boolean' && typeof id.identityHash === 'string' && id.identityType, 'IdentityObject');
    if (id.hashed) need(/^(sha256\$[0-9a-fA-F]{64}|md5\$[0-9a-fA-F]{32})$/.test(id.identityHash), 'IdentityHash');
  }
  for (const d of ['activityStartDate', 'activityEndDate']) if (subject[d]) need(!Number.isNaN(Date.parse(subject[d])), d);
  const a = subject.achievement;
  need(URI.test(a.id) && types(a.type).includes('Achievement') && a.name && a.description, 'achievement');
  need(a.criteria && (a.criteria.narrative || a.criteria.id), 'achievement.criteria');
  need(!a.achievementType || ACHIEVEMENT_TYPES.includes(a.achievementType) || /^ext:[a-zA-Z0-9._-]+$/.test(a.achievementType), 'achievementType');
  image(a.image, 'achievement');
  for (const p of [a.creator, subject.source].filter(Boolean)) need(URI.test(p.id) && types(p.type).includes('Profile'), 'Profile');
  const alignments = [...(a.alignment ?? []), ...(a.resultDescription ?? []).flatMap((r: Any) => r.alignment ?? [])];
  for (const al of alignments) need(types(al.type).includes('Alignment') && al.targetName && /^https?:\/\//.test(al.targetUrl), 'Alignment');
  const descriptions = new Map<string, Any>();
  for (const rd of a.resultDescription ?? []) {
    need(URI.test(rd.id) && types(rd.type).includes('ResultDescription') && rd.name, 'ResultDescription');
    need(RESULT_TYPES.includes(rd.resultType) || /^ext:[a-zA-Z0-9._-]+$/.test(rd.resultType), 'resultType');
    for (const level of rd.rubricCriterionLevel ?? []) need(URI.test(level.id) && types(level.type).includes('RubricCriterionLevel') && level.name, 'RubricCriterionLevel');
    if (rd.requiredLevel) need((rd.rubricCriterionLevel ?? []).some((l: Any) => l.id === rd.requiredLevel), 'requiredLevel');
    need(!descriptions.has(rd.id), 'unique ResultDescription ids');
    descriptions.set(rd.id, rd);
  }
  for (const r of subject.result ?? []) {
    need(types(r.type).includes('Result'), 'Result.type');
    const rd = descriptions.get(r.resultDescription);
    need(rd, 'Result.resultDescription');
    if (r.achievedLevel) need((rd?.rubricCriterionLevel ?? []).some((l: Any) => l.id === r.achievedLevel), 'Result.achievedLevel');
    if (rd?.resultType === 'RubricCriterionLevel') need(r.achievedLevel, 'level result has a level');
  }
  for (const e of vcDoc.evidence ?? []) need(types(e.type).includes('Evidence') && (!e.id || URI.test(e.id)), 'Evidence');
  const st = vcDoc.credentialStatus;
  if (st) need(st.type === 'BitstringStatusListEntry' && st.statusPurpose === 'revocation' && /^\d+$/.test(st.statusListIndex) && URI.test(st.statusListCredential) && URI.test(st.id), 'credentialStatus');
  return out;
}

describe('Open Badges 3.0 data model', () => {
  it('has every required property, in the official vocabularies, with consistent references', () => {
    const badge = buildOpenBadge(input()) as Any;
    expect(modelProblems(badge)).toEqual([]);
    expect(badge.credentialSubject.achievement.achievementType).toBe('MicroCredential');
    expect(badge.validFrom).toBe('2026-08-30T15:04:05Z');
    expect(badge.credentialSubject.result).toEqual([
      { type: ['Result'], resultDescription: badge.credentialSubject.achievement.resultDescription[0].id, value: '80.5' },
      { type: ['Result'], resultDescription: badge.credentialSubject.achievement.resultDescription[1].id, achievedLevel: badge.credentialSubject.achievement.resultDescription[1].rubricCriterionLevel[3].id },
      { type: ['Result'], resultDescription: badge.credentialSubject.achievement.resultDescription[2].id, achievedLevel: badge.credentialSubject.achievement.resultDescription[2].rubricCriterionLevel[2].id },
    ]);
    expect(badge.credentialSubject.achievement.alignment.map((x: Any) => [x.targetCode, x.targetUrl])).toEqual([
      ['data-analysis', `${ORIGIN}/competencies#data-analysis`], ['communication', `${ORIGIN}/competencies#communication`]]);
    expect(badge.evidence.map((e: Any) => e.id)).toEqual([`${ORIGIN}/verify/${SAMPLE.code}`, 'https://example.org/tablero', `${ORIGIN}/api/public/evidence/60000000-0000-4000-8000-000000000002`]);
    expect(badge.credentialStatus).toEqual({ id: `${status}#0`, type: 'BitstringStatusListEntry', statusPurpose: 'revocation', statusListIndex: '0', statusListCredential: status });
  });

  it('lets a verifier who knows the e-mail address recognize the recipient, as the specification describes', () => {
    const badge = buildOpenBadge(input()) as Any;
    const [identifier] = badge.credentialSubject.identifier;
    const known = 'maria.torres@example.com';
    expect(identifier.identityHash).toBe(`sha256$${createHash('sha256').update(known + identifier.salt).digest('hex')}`);
    expect(JSON.stringify(badge)).not.toContain(known);
    expect(badge.credentialSubject.name).toBe('María Torres');
  });

  it('keeps confidential challenges confidential', () => {
    const confidential = { ...SAMPLE, confidential: true, challenge_title: null, organization_name: null, start_date: null, end_date: null,
      supervisor_name: null, supervisor_title: null, public_evidence: [] };
    const badge = buildOpenBadge(input({ credential: confidential })) as Any;
    expect(modelProblems(badge)).toEqual([]);
    const text = JSON.stringify(badge);
    for (const secret of ['Reducción de paros', 'Aceros del Centro', 'Carlos Méndez', 'Gerente', '20000000-0000-4000-8000-000000000001', '2026-06-01', '2026-08-15']) expect(text).not.toContain(secret);
    expect(badge.name).toBe('SkillPass: Reto confidencial de manufactura');
    expect(badge.credentialSubject.source).toBeUndefined();
    expect(badge.credentialSubject.achievement.creator).toBeUndefined();
    expect(badge.credentialSubject.achievement.description).toContain('una empresa verificada (confidencial)');
  });

  it('speaks the holder language, says DEMO on demo credentials, and names the organization only when it may', () => {
    const en = buildOpenBadge(input({ locale: 'en' })) as Any;
    expect(en.name).toBe('SkillPass: Reducción de paros en Línea 3');
    expect(en.credentialSubject.achievement.inLanguage).toBe('en');
    expect(en.credentialSubject.achievement.resultDescription[1].name).toBe('Competency: Data Analysis');
    expect(en.description).toContain('80.5 work hours');
    expect(en.credentialSubject.source).toEqual({ id: 'urn:uuid:20000000-0000-4000-8000-000000000001', type: ['Profile'], name: 'Aceros del Centro' });
    const demo = buildOpenBadge(input({ credential: { ...SAMPLE, is_demo: true } })) as Any;
    expect(demo.name).toBe('DEMO · SkillPass: Reducción de paros en Línea 3');
    expect(demo.description).toMatch(/^Credencial ficticia de demostración/);
    expect((buildOpenBadge(input({ organization: null })) as Any).credentialSubject.source).toBeUndefined();
  });

  it('gives each credential its own stable identifiers', () => {
    const a = buildOpenBadge(input()) as Any;
    expect(buildOpenBadge(input())).toEqual(a);
    const b = buildOpenBadge(input({ credential: { ...SAMPLE, id: '80000000-0000-4000-8000-000000000002' } })) as Any;
    expect(b.credentialSubject.achievement.id).not.toBe(a.credentialSubject.achievement.id);
    expect(a.credentialSubject.achievement.id).toBe(`urn:uuid:${uuidv5('achievement', SAMPLE.id)}`);
    // RFC 4122 test vector: uuid v5 of "python.org" in the DNS namespace.
    expect(uuidv5('python.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d');
  });

  it('reads the same with the contexts other verifiers ship (Digital Credentials Consortium package)', async () => {
    const require = createRequire(import.meta.url);
    const dcc = require('@digitalcredentials/open-badges-context').contexts.get('https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json');
    const badge = buildOpenBadge(input());
    expect(await canonize(badge, { 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json': dcc })).toBe(await canonize(badge));
  });

  it('bundles the official contexts unchanged', () => {
    const require = createRequire(import.meta.url);
    // W3C VC Data Model 2.0 context, as Digital Bazaar ships it (and as the 1EdTech validator embeds it).
    expect(credentialsV2).toEqual(credentialsContexts.get('https://www.w3.org/ns/credentials/v2'));
    // 1EdTech's published 3.0.3 context: the DCC copy lacks only the two terms added in its last revision.
    const dcc = require('@digitalcredentials/open-badges-context').contexts.get('https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json');
    const ours = (openBadgesV3 as Any)['@context'];
    expect(Object.keys(ours).filter((k) => !(k in dcc['@context'])).sort()).toEqual(['endorsementJwt', 'jti']);
    for (const [term, value] of Object.entries(dcc['@context'])) expect(ours[term], term).toEqual(value);
  });
});

describe('issuer and LinkedIn', () => {
  it('derives the DID from the public origin and publishes current and previous keys', () => {
    expect(issuerDid('https://skillpass.aindev.com.mx')).toBe('did:web:skillpass.aindev.com.mx');
    expect(issuerDid('http://127.0.0.1:3100')).toBe('did:web:127.0.0.1%3A3100');
    const old = publicKeyMultibase(rawPublicKey(privateKeyFromSeed(new Uint8Array(32).fill(3))));
    process.env.CREDENTIAL_PREVIOUS_KEYS = `${old}, not-a-key ${old}`;
    const issuer = credentialIssuer(ORIGIN)!;
    const doc = didDocument(issuer) as Any;
    expect(doc.id).toBe('did:web:skillpass.test');
    expect(doc.verificationMethod.map((m: Any) => m.publicKeyMultibase)).toEqual([issuer.publicKeyMultibase, old]);
    expect(doc.assertionMethod).toEqual([`did:web:skillpass.test#${issuer.publicKeyMultibase}`, `did:web:skillpass.test#${old}`]);
    expect(doc.verificationMethod[0]).toEqual({ id: issuer.verificationMethod, type: 'Multikey', controller: 'did:web:skillpass.test', publicKeyMultibase: issuer.publicKeyMultibase });
    expect(JSON.stringify(doc)).not.toContain(KEY);
  });

  it('is off without a valid key', () => {
    for (const value of ['', 'z6MkhFWCDeVdET1r1Xoeik5Wtr7NdJyYezE4UDTKoGNbVTUF', 'not-a-key']) {
      process.env.CREDENTIAL_SIGNING_KEY = value;
      expect(credentialIssuer(ORIGIN), value).toBeNull();
    }
  });

  it('builds the LinkedIn certification link', () => {
    const url = new URL(linkedInAddToProfileUrl({ name: 'SkillPass: Reto', organizationName: 'SkillPass by AINDEV NEXUS', issuedAt: '2026-08-30T15:04:05Z',
      certUrl: `${ORIGIN}/verify/${SAMPLE.code}`, certId: SAMPLE.code }));
    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/profile/add');
    expect(Object.fromEntries(url.searchParams)).toEqual({ startTask: 'CERTIFICATION_NAME', name: 'SkillPass: Reto', organizationName: 'SkillPass by AINDEV NEXUS',
      issueYear: '2026', issueMonth: '8', certUrl: `${ORIGIN}/verify/${SAMPLE.code}`, certId: SAMPLE.code });
    const withId = new URL(linkedInAddToProfileUrl({ name: 'x', organizationName: 'y', organizationId: '12345', issuedAt: '2026-01-01T00:00:00Z', certUrl: ORIGIN, certId: 'c' }));
    expect([withId.searchParams.get('organizationId'), withId.searchParams.get('organizationName')]).toEqual(['12345', null]);
  });
});
