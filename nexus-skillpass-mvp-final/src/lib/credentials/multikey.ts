/*
 * Ed25519 keys in the Multikey format (W3C Controlled Identifiers, Data Integrity EdDSA): a multibase string,
 * base58btc ('z' prefix) over a multicodec header and the raw key bytes.
 *   public  key: 0xed 0x01 + 32 bytes  -> "z6Mk…"
 *   secret  key: 0x80 0x26 + 32 bytes  -> "z3u2…" (the 32-byte seed)
 */
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ED25519_PUBLIC = Uint8Array.of(0xed, 0x01);
const ED25519_SECRET = Uint8Array.of(0x80, 0x26);

export function base58btcEncode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return '1'.repeat(zeros) + digits.reverse().map((d) => ALPHABET[d]).join('');
}

export function base58btcDecode(text: string): Uint8Array {
  let zeros = 0;
  while (zeros < text.length && text[zeros] === '1') zeros++;
  const bytes: number[] = [];
  for (let i = zeros; i < text.length; i++) {
    let carry = ALPHABET.indexOf(text[i]);
    if (carry < 0) throw new Error('invalid base58btc character');
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  return Uint8Array.from([...new Array<number>(zeros).fill(0), ...bytes.reverse()]);
}

function withHeader(header: Uint8Array, key: Uint8Array) {
  const out = new Uint8Array(header.length + key.length);
  out.set(header);
  out.set(key, header.length);
  return `z${base58btcEncode(out)}`;
}

function stripHeader(multibase: string, header: Uint8Array): Uint8Array | null {
  if (!/^z[1-9A-HJ-NP-Za-km-z]+$/.test(multibase)) return null;
  let bytes: Uint8Array;
  try {
    bytes = base58btcDecode(multibase.slice(1));
  } catch {
    return null;
  }
  if (bytes.length !== header.length + 32 || header.some((b, i) => bytes[i] !== b)) return null;
  return bytes.slice(header.length);
}

export const publicKeyMultibase = (raw: Uint8Array) => withHeader(ED25519_PUBLIC, raw);
export const secretKeyMultibase = (seed: Uint8Array) => withHeader(ED25519_SECRET, seed);
/** The 32-byte public key of an Ed25519 Multikey, or null. */
export const parsePublicKeyMultibase = (value: string) => stripHeader(value.trim(), ED25519_PUBLIC);
/** The 32-byte seed of an Ed25519 secret Multikey, or null. */
export const parseSecretKeyMultibase = (value: string) => stripHeader(value.trim(), ED25519_SECRET);
