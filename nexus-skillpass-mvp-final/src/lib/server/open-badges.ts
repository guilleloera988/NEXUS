import 'server-only';
import type { KeyObject } from 'node:crypto';
import { addProof, privateKeyFromSeed, rawPublicKey, verifyProof } from '@/lib/credentials/data-integrity';
import { parsePublicKeyMultibase, parseSecretKeyMultibase, publicKeyMultibase } from '@/lib/credentials/multikey';
import { dateTimeZ } from '@/lib/credentials/open-badge';

/*
 * Open Badges 3.0 issuer. SkillPass signs with an Ed25519 key kept in CREDENTIAL_SIGNING_KEY (a secret Multikey,
 * "z3u2…", made with scripts/credential-key.mjs) and publishes the public key as a did:web document at
 * /.well-known/did.json, so anyone can check a signature without asking SkillPass. Without the key, nothing is
 * offered: no download, no DID document, no status lists.
 *
 * Rotating the key: put the new key in CREDENTIAL_SIGNING_KEY and the old PUBLIC key (z6Mk…) in
 * CREDENTIAL_PREVIOUS_KEYS, so credentials signed before keep verifying. A leaked key is removed from both:
 * every credential signed with it stops verifying and has to be downloaded again.
 */
export interface CredentialIssuer {
  did: string;
  verificationMethod: string;
  publicKeyMultibase: string;
  previousKeys: string[];
  privateKey: KeyObject;
}

/** did:web for an origin; a port's colon is percent-encoded (did:web:127.0.0.1%3A3000). */
export function issuerDid(origin: string) {
  return `did:web:${encodeURIComponent(new URL(origin).host.toLowerCase())}`;
}

let cached: { secret: string; previous: string; origin: string; issuer: CredentialIssuer | null } | null = null;

export function credentialIssuer(origin: string): CredentialIssuer | null {
  const secret = process.env.CREDENTIAL_SIGNING_KEY?.trim() ?? '';
  const previous = process.env.CREDENTIAL_PREVIOUS_KEYS?.trim() ?? '';
  if (cached && cached.secret === secret && cached.previous === previous && cached.origin === origin) return cached.issuer;
  let issuer: CredentialIssuer | null = null;
  const seed = secret ? parseSecretKeyMultibase(secret) : null;
  if (seed) {
    const privateKey = privateKeyFromSeed(seed);
    const key = publicKeyMultibase(rawPublicKey(privateKey));
    const did = issuerDid(origin);
    const previousKeys = [...new Set(previous.split(/[\s,]+/).filter((k) => k && k !== key && parsePublicKeyMultibase(k)))];
    issuer = { did, verificationMethod: `${did}#${key}`, publicKeyMultibase: key, previousKeys, privateKey };
  } else if (secret && !cached) {
    console.error('[skillpass] CREDENTIAL_SIGNING_KEY is not an Ed25519 secret Multikey (z3u2…): Open Badges are off.');
  }
  cached = { secret, previous, origin, issuer };
  return issuer;
}

/** The DID document verifiers resolve: the current key and the previous ones, all usable for assertions. */
export function didDocument(issuer: CredentialIssuer) {
  const keys = [issuer.publicKeyMultibase, ...issuer.previousKeys];
  return {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
    id: issuer.did,
    verificationMethod: keys.map((key) => ({ id: `${issuer.did}#${key}`, type: 'Multikey', controller: issuer.did, publicKeyMultibase: key })),
    assertionMethod: keys.map((key) => `${issuer.did}#${key}`),
  };
}

/** Signs with the current key and checks the result before it leaves the server. */
export async function signWithIssuer<T extends Record<string, unknown>>(document: T, issuer: CredentialIssuer, now = Date.now()) {
  const signed = await addProof(document, issuer.privateKey, { verificationMethod: issuer.verificationMethod, created: dateTimeZ(now) });
  if (!(await verifyProof(signed, parsePublicKeyMultibase(issuer.publicKeyMultibase)!))) throw new Error('Open Badge signature self-check failed');
  return signed;
}
