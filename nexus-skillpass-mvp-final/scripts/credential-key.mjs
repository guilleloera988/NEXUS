#!/usr/bin/env node
// The Ed25519 key SkillPass signs Open Badges 3.0 with (CREDENTIAL_SIGNING_KEY, see docs/DEPLOYMENT.md).
//
//   node scripts/credential-key.mjs
//       Makes a new key. Paste the CREDENTIAL_SIGNING_KEY line ONLY into Vercel (Production, Sensitive): it is
//       the secret. The public key is what /.well-known/did.json publishes.
//
//   CREDENTIAL_SIGNING_KEY=z3u2... node scripts/credential-key.mjs --public [https://skillpass.aindev.com.mx]
//       Prints the public key and the issuer DID of an existing key, never the key itself (e.g. to move it to
//       CREDENTIAL_PREVIOUS_KEYS when rotating).
//
// Must stay in step with src/lib/credentials/multikey.ts and src/lib/server/open-badges.ts.
import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = Math.floor(carry / 58); }
    while (carry > 0) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
  }
  return '1'.repeat(zeros) + digits.reverse().map((d) => ALPHABET[d]).join('');
}
function unbase58(text) {
  let zeros = 0;
  while (zeros < text.length && text[zeros] === '1') zeros++;
  const bytes = [];
  for (let i = zeros; i < text.length; i++) {
    let carry = ALPHABET.indexOf(text[i]);
    if (carry < 0) throw new Error('invalid base58');
    for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  return Buffer.from([...new Array(zeros).fill(0), ...bytes.reverse()]);
}
const multikey = (header, key) => `z${base58(Buffer.concat([Buffer.from(header), key]))}`;
const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex');
const publicOf = (privateKey) => createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(12);

if (process.argv[2] === '--public') {
  const secret = process.env.CREDENTIAL_SIGNING_KEY?.trim() ?? '';
  let seed = null;
  try {
    const bytes = secret.startsWith('z') ? unbase58(secret.slice(1)) : Buffer.alloc(0);
    if (bytes.length === 34 && bytes[0] === 0x80 && bytes[1] === 0x26) seed = bytes.subarray(2);
  } catch { /* reported below */ }
  if (!seed) {
    console.error('Set CREDENTIAL_SIGNING_KEY to an Ed25519 secret Multikey (z3u2…).');
    process.exit(1);
  }
  const publicKey = multikey([0xed, 0x01], publicOf(createPrivateKey({ key: Buffer.concat([PKCS8, seed]), format: 'der', type: 'pkcs8' })));
  const origin = process.argv[3];
  console.log(`Public key: ${publicKey}`);
  if (origin) console.log(`Issuer:     did:web:${encodeURIComponent(new URL(origin).host.toLowerCase())}`);
} else {
  const { privateKey } = generateKeyPairSync('ed25519');
  const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(PKCS8.length);
  console.log(`CREDENTIAL_SIGNING_KEY=${multikey([0x80, 0x26], seed)}`);
  console.log(`# Public key (safe to share): ${multikey([0xed, 0x01], publicOf(privateKey))}`);
}
