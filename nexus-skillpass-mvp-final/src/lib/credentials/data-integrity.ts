import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import jsonld, { type DocumentLoader } from 'jsonld';
import credentialsV2 from './contexts/credentials-v2.json';
import openBadgesV3 from './contexts/ob-v3p0-3.0.3.json';
import { base58btcDecode, base58btcEncode } from './multikey';

/*
 * Data Integrity proofs with the eddsa-rdfc-2022 cryptosuite (W3C "Data Integrity EdDSA Cryptosuites v1.0"),
 * the proof format 1EdTech certifies for Open Badges 3.0. The document and the proof options are canonicalized
 * with RDFC-1.0, hashed with SHA-256 (proof options first) and signed with Ed25519.
 *
 * The JSON-LD contexts travel with the app (copied from 1EdTech and W3C and checked in tests), so signing never
 * fetches anything, and "safe mode" refuses any property that a context does not define: nothing that is shown
 * to a person can be left out of what is signed.
 */
export const CREDENTIALS_V2 = 'https://www.w3.org/ns/credentials/v2';
export const OPEN_BADGES_V3 = 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json';

const BUNDLED: Record<string, unknown> = { [CREDENTIALS_V2]: credentialsV2, [OPEN_BADGES_V3]: openBadgesV3 };

export function documentLoader(extra: Record<string, unknown> = {}): DocumentLoader {
  return async (url: string) => {
    const document = extra[url] ?? BUNDLED[url];
    if (!document) throw new Error(`JSON-LD context not available offline: ${url}`);
    return { contextUrl: null, documentUrl: url, document };
  };
}

export async function canonize(input: object, extra?: Record<string, unknown>): Promise<string> {
  return jsonld.canonize(input, { algorithm: 'RDFC-1.0', format: 'application/n-quads', documentLoader: documentLoader(extra), safe: true });
}

const PKCS8_ED25519 = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex');

export const privateKeyFromSeed = (seed: Uint8Array): KeyObject =>
  createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, Buffer.from(seed)]), format: 'der', type: 'pkcs8' });
export const publicKeyFromRaw = (raw: Uint8Array): KeyObject =>
  createPublicKey({ key: Buffer.concat([SPKI_ED25519, Buffer.from(raw)]), format: 'der', type: 'spki' });
export const rawPublicKey = (privateKey: KeyObject): Uint8Array =>
  new Uint8Array(createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(SPKI_ED25519.length));

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest();

type Json = Record<string, unknown>;
export interface ProofOptions {
  /** URL of the public key: `${issuerDid}#${publicKeyMultibase}`. */
  verificationMethod: string;
  /** xsd:dateTime, e.g. 2026-11-18T10:00:00Z. */
  created: string;
}

/** hashData = SHA-256(canonical proof options) || SHA-256(canonical document). */
async function hashData(unsecured: Json, proofConfig: Json, extra?: Record<string, unknown>) {
  const [canonicalProof, canonicalDocument] = await Promise.all([canonize(proofConfig, extra), canonize(unsecured, extra)]);
  return Buffer.concat([sha256(canonicalProof), sha256(canonicalDocument)]);
}

/** Returns a copy of `document` with an eddsa-rdfc-2022 DataIntegrityProof. */
export async function addProof<T extends Json>(document: T, privateKey: KeyObject, options: ProofOptions, extra?: Record<string, unknown>): Promise<T & { proof: Json }> {
  const unsecured: Json = { ...document };
  delete unsecured.proof;
  const proof: Json = {
    type: 'DataIntegrityProof', cryptosuite: 'eddsa-rdfc-2022', created: options.created,
    verificationMethod: options.verificationMethod, proofPurpose: 'assertionMethod',
  };
  const data = await hashData(unsecured, { ...proof, '@context': unsecured['@context'] }, extra);
  proof.proofValue = `z${base58btcEncode(sign(null, data, privateKey))}`;
  return { ...(unsecured as T), proof };
}

/** True when the document carries a valid eddsa-rdfc-2022 proof made with `publicKey` (raw 32 bytes). */
export async function verifyProof(document: Json, publicKey: Uint8Array, extra?: Record<string, unknown>): Promise<boolean> {
  const { proof, ...unsecured } = document as Json & { proof?: Json };
  if (!proof || proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== 'eddsa-rdfc-2022') return false;
  const { proofValue, ...options } = proof;
  if (typeof proofValue !== 'string' || !proofValue.startsWith('z')) return false;
  try {
    const data = await hashData(unsecured, { ...options, '@context': unsecured['@context'] }, extra);
    return verify(null, data, publicKeyFromRaw(publicKey), Buffer.from(base58btcDecode(proofValue.slice(1))));
  } catch {
    return false;
  }
}
