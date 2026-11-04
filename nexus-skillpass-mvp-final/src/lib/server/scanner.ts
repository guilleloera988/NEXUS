import 'server-only';
import { createHmac } from 'node:crypto';
import { AppError } from './errors';

/*
 * Antivirus for evidence uploads (scanner/ and migration 20261105000001). With SCANNER_URL and SCANNER_TOKEN set,
 * every file goes to the ClamAV scanner before it is stored and an infected file is refused. With SCAN_GATE_SECRET
 * too, a clean file is registered with an attestation that only this server can produce. SCANNER_TOKEN is shared
 * with the scanner; SCAN_GATE_SECRET stays in Vercel. Without a scanner (local DEMO, the demo project) files are
 * stored unscanned, which the database accepts only while platform_settings.scan_required is false.
 */
export interface ScanAttestation { gate: string; verdict: 'clean'; engine: string }
export type ScanOutcome =
  | { verdict: 'clean'; engine: string; attestation?: ScanAttestation }
  | { verdict: 'infected'; engine: string; signature: string; gate?: string };

const GATE_CONTEXT = 'skillpass-scan-gate';

export function scannerConfig() {
  const url = process.env.SCANNER_URL?.trim();
  const token = process.env.SCANNER_TOKEN?.trim();
  if (!url || !token || token.length < 32) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(parsed.hostname)) return null;
    return { url: parsed.origin, token };
  } catch {
    return null;
  }
}

function gateSecret() {
  const value = process.env.SCAN_GATE_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

/** The token sp_add_evidence checks; the database keeps only its SHA-256 (platform_settings 'scan_gate'). */
export const scanGate = (secret: string) => createHmac('sha256', secret).update(GATE_CONTEXT).digest('hex');

/** Scans the bytes, or returns null when no scanner is configured. Throws `scanner_unavailable` when it cannot answer. */
export async function scanUpload(bytes: Uint8Array): Promise<ScanOutcome | null> {
  const config = scannerConfig();
  if (!config) return null;
  let body: { status?: unknown; signature?: unknown; engine?: unknown };
  try {
    const res = await fetch(`${config.url}/scan`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/octet-stream' },
      body: new Blob([new Uint8Array(bytes)]),
      signal: AbortSignal.timeout(25_000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    body = await res.json();
  } catch (error) {
    console.error('[skillpass] antivirus scanner unavailable', error instanceof Error ? error.message.slice(0, 120) : 'error');
    throw new AppError('scanner_unavailable', 503, 'file');
  }
  const engine = typeof body.engine === 'string' && body.engine ? body.engine.slice(0, 120) : 'ClamAV';
  const secret = gateSecret();
  const gate = secret ? scanGate(secret) : undefined;
  if (body.status === 'clean') return { verdict: 'clean', engine, ...(gate ? { attestation: { gate, verdict: 'clean' as const, engine } } : {}) };
  if (body.status === 'infected') {
    const signature = typeof body.signature === 'string' ? body.signature.slice(0, 200) : 'unknown';
    return { verdict: 'infected', engine, signature, ...(gate ? { gate } : {}) };
  }
  console.error('[skillpass] antivirus scanner answered without a verdict');
  throw new AppError('scanner_unavailable', 503, 'file');
}
