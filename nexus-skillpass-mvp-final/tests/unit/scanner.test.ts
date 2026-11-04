import { execFileSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Antivirus in the upload path (src/lib/server/scanner.ts, storage.ts). fetch, Supabase Storage and the RPC layer
 * are fakes; the scanner service and the database rules have their own suites.
 */
const TOKEN = 'scanner-token-for-unit-tests-0123456789abcdef';
const uploads: string[] = [];
const writes: { fn: string; payload: Record<string, unknown> }[] = [];
let answer: () => Promise<Response>;
let requests: { url: string; init: RequestInit }[] = [];

vi.mock('@/lib/server/supabase', () => ({
  supabaseServer: async () => ({
    storage: { from: () => ({ upload: async (path: string) => { uploads.push(path); return { error: null }; }, remove: async () => ({}) }) },
  }),
}));
vi.mock('@/lib/server/backend', () => ({
  write: async (fn: string, payload: Record<string, unknown>) => { writes.push({ fn, payload }); return {}; },
}));

const env = { ...process.env };
beforeEach(() => {
  uploads.length = 0; writes.length = 0; requests = [];
  process.env.SCANNER_URL = 'https://scanner.example.org/';
  process.env.SCANNER_TOKEN = TOKEN;
  answer = async () => Response.json({ status: 'clean', engine: 'ClamAV 1.4.2/27453' });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => { requests.push({ url, init }); return answer(); });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { process.env = { ...env }; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const session = { mode: 'supabase' as const, userId: '10000000-0000-4000-8000-000000000011' };
const CHALLENGE = '40000000-0000-4000-8000-000000000001';
const pdf = () => new File(['%PDF-1.4\n% evidencia de prueba\n'], 'informe.pdf', { type: 'application/pdf' });
const gate = createHmac('sha256', TOKEN).update('skillpass-scan-gate').digest('hex');

describe('scanner configuration', () => {
  it('needs an https URL (or a local one) and a token of at least 32 characters', async () => {
    const { scannerConfig } = await import('@/lib/server/scanner');
    expect(scannerConfig()).toEqual({ url: 'https://scanner.example.org', token: TOKEN });
    process.env.SCANNER_URL = 'http://scanner.example.org'; expect(scannerConfig()).toBeNull();
    process.env.SCANNER_URL = 'http://127.0.0.1:8080'; expect(scannerConfig()).toEqual({ url: 'http://127.0.0.1:8080', token: TOKEN });
    process.env.SCANNER_URL = 'not a url'; expect(scannerConfig()).toBeNull();
    process.env.SCANNER_URL = 'https://scanner.example.org'; process.env.SCANNER_TOKEN = 'short'; expect(scannerConfig()).toBeNull();
    delete process.env.SCANNER_URL; expect(scannerConfig()).toBeNull();
  });
});

describe('scanning an upload', () => {
  it('sends the bytes with the token and returns an attestation for clean files', async () => {
    const { scanUpload } = await import('@/lib/server/scanner');
    const result = await scanUpload(new TextEncoder().encode('hola'));
    expect(result).toEqual({ verdict: 'clean', engine: 'ClamAV 1.4.2/27453', attestation: { gate, verdict: 'clean', engine: 'ClamAV 1.4.2/27453' } });
    expect(requests[0].url).toBe('https://scanner.example.org/scan');
    expect((requests[0].init.headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`);
    expect(new TextDecoder().decode(await new Response(requests[0].init.body).arrayBuffer())).toBe('hola');
  });

  it('fails closed when the scanner cannot answer or answers without a verdict', async () => {
    const { scanUpload } = await import('@/lib/server/scanner');
    for (const bad of [
      async () => new Response('down', { status: 503 }),
      async () => { throw new Error('ECONNREFUSED'); },
      async () => Response.json({ status: 'maybe' }),
      async () => new Response('not json'),
    ]) {
      answer = bad;
      await expect(scanUpload(new Uint8Array([1]))).rejects.toMatchObject({ key: 'scanner_unavailable', status: 503, field: 'file' });
    }
  });

  it('does nothing without a scanner configured', async () => {
    delete process.env.SCANNER_TOKEN;
    const { scanUpload } = await import('@/lib/server/scanner');
    expect(await scanUpload(new Uint8Array([1]))).toBeNull();
    expect(requests).toEqual([]);
  });
});

describe('storing evidence files', () => {
  it('stores a clean file and hands its attestation to sp_add_evidence', async () => {
    const { storeEvidenceFile } = await import('@/lib/server/storage');
    const stored = await storeEvidenceFile(session, CHALLENGE, pdf());
    expect(uploads).toHaveLength(1);
    expect(stored.scan).toEqual({ gate, verdict: 'clean', engine: 'ClamAV 1.4.2/27453' });
  });

  it('never stores an infected file; reports it for the audit log', async () => {
    answer = async () => Response.json({ status: 'infected', signature: 'Win.Test.EICAR_HDB-1', engine: 'ClamAV 1.4.2' });
    const { storeEvidenceFile } = await import('@/lib/server/storage');
    await expect(storeEvidenceFile(session, CHALLENGE, pdf())).rejects.toMatchObject({ key: 'file_infected', field: 'file' });
    expect(uploads).toEqual([]);
    expect(writes).toEqual([{ fn: 'sp_log_blocked_upload', payload: { gate, challenge_id: CHALLENGE, file_name: 'informe.pdf', signature: 'Win.Test.EICAR_HDB-1' } }]);
  });

  it('stores nothing while the scanner is down', async () => {
    answer = async () => new Response('down', { status: 503 });
    const { storeEvidenceFile } = await import('@/lib/server/storage');
    await expect(storeEvidenceFile(session, CHALLENGE, pdf())).rejects.toMatchObject({ key: 'scanner_unavailable' });
    expect(uploads).toEqual([]);
  });

  it('stores unscanned files when no scanner is configured (the database decides whether that is allowed)', async () => {
    delete process.env.SCANNER_URL;
    const { storeEvidenceFile } = await import('@/lib/server/storage');
    const stored = await storeEvidenceFile(session, CHALLENGE, pdf());
    expect(uploads).toHaveLength(1);
    expect(stored.scan).toBeUndefined();
    expect(requests).toEqual([]);
  });
});

describe('operator script', () => {
  it('prints the hashed gate the app sends and turns the requirement on; refuses a short token', () => {
    const out = execFileSync('node', ['scripts/scan-gate.mjs'], { env: { ...process.env, SCANNER_TOKEN: TOKEN }, encoding: 'utf8' });
    expect(out).toContain(`'"${createHash('sha256').update(gate).digest('hex')}"'::jsonb`);
    expect(out).toContain("set value = 'true'::jsonb");
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain(gate);
    expect(() => execFileSync('node', ['scripts/scan-gate.mjs'], { env: { ...process.env, SCANNER_TOKEN: 'short' }, stdio: 'pipe' })).toThrow();
  });
});
