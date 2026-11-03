import { execFileSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Shared attempt limits (migration 20261104000001). The Supabase client is a fake that keeps the counters the
 * way sp_rate_limit does; the database function itself is covered in database.test.ts.
 */
const SECRET = 'a-test-secret-that-is-at-least-32-characters-long';
type Check = { key: string; window: number; hit: boolean };
let rpcCalls: { fn: string; p: { gate: string; checks: Check[] } }[] = [];
let counters = new Map<string, number>();
let rpcFailure: string | null = null;
let rpcAnswer: unknown = undefined;
let forwardedFor = '203.0.113.7';

vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': forwardedFor }) }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: (fn: string, args: { p: { gate: string; checks: Check[] } }) => ({
      abortSignal: async (signal: AbortSignal) => {
        expect(signal).toBeInstanceOf(AbortSignal);
        rpcCalls.push({ fn, p: args.p });
        if (rpcFailure) return { data: null, error: { message: rpcFailure } };
        if (rpcAnswer !== undefined) return { data: rpcAnswer, error: null };
        const data = args.p.checks.map((check) => {
          const hits = (counters.get(check.key) ?? 0) + (check.hit ? 1 : 0);
          if (check.hit) counters.set(check.key, hits);
          return { hits, reset_in: check.window };
        });
        return { data, error: null };
      },
    }),
  }),
}));

async function load() {
  vi.resetModules();
  return import('@/lib/server/rate-limit');
}

const env = { ...process.env };
beforeEach(() => {
  rpcCalls = []; counters = new Map(); rpcFailure = null; rpcAnswer = undefined; forwardedFor = '203.0.113.7';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  process.env.RATE_LIMIT_SECRET = SECRET;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

const rule = { name: 'test', limit: 3, windowSeconds: 60 };

describe('shared attempt limits', () => {
  it('sends only digests and the gate token, never the e-mail address or the network', async () => {
    const { limitAttempts, rateLimitGate } = await load();
    await limitAttempts([{ rule, id: 'maria@example.com' }, { rule: { ...rule, windowSeconds: 900 }, id: '203.0.113.7', mode: 'peek' }]);
    expect(rpcCalls).toHaveLength(1);
    const { fn, p } = rpcCalls[0];
    expect(fn).toBe('sp_rate_limit');
    expect(p.gate).toBe(rateLimitGate(SECRET));
    expect(p.checks).toEqual([
      { key: expect.stringMatching(/^[0-9a-f]{64}$/), window: 60, hit: true },
      { key: expect.stringMatching(/^[0-9a-f]{64}$/), window: 900, hit: false },
    ]);
    expect(JSON.stringify(p)).not.toMatch(/maria|example\.com|203\.0\.113/);
    // The database stores only the SHA-256 of the gate token.
    const stored = createHash('sha256').update(createHmac('sha256', SECRET).update('skillpass-rate-limit-gate').digest('hex')).digest('hex');
    expect(createHash('sha256').update(p.gate).digest('hex')).toBe(stored);
  });

  it('allows `limit` counted attempts per window; a peek refuses once earlier failures reached the limit', async () => {
    const { limitAttempts, recordAttempts } = await load();
    for (let i = 0; i < 3; i++) await limitAttempts([{ rule, id: 'ana' }]);
    await expect(limitAttempts([{ rule, id: 'ana' }])).rejects.toMatchObject({ key: 'rate_limited', status: 429 });
    await limitAttempts([{ rule, id: 'luis' }]);

    await recordAttempts([{ rule, id: 'pedro' }, { rule, id: 'pedro' }]);
    await limitAttempts([{ rule, id: 'pedro', mode: 'peek' }]);
    await recordAttempts([{ rule, id: 'pedro' }]);
    await expect(limitAttempts([{ rule, id: 'pedro', mode: 'peek' }])).rejects.toMatchObject({ key: 'rate_limited' });
  });

  it('keys depend on the rule and the window, so two rules for one account never share a counter', async () => {
    const { limitAttempts } = await load();
    await limitAttempts([{ rule, id: 'ana' }, { rule: { ...rule, name: 'other' }, id: 'ana' }, { rule: { ...rule, windowSeconds: 61 }, id: 'ana' }]);
    expect(new Set(rpcCalls[0].p.checks.map((c) => c.key)).size).toBe(3);
  });

  it('falls back to per-instance limits when the database refuses, and stops asking for a minute', async () => {
    rpcFailure = 'sp:rate_limit_unavailable';
    const { limitAttempts } = await load();
    for (let i = 0; i < 3; i++) await limitAttempts([{ rule, id: 'ana' }]);
    await expect(limitAttempts([{ rule, id: 'ana' }])).rejects.toMatchObject({ key: 'rate_limited' });
    expect(rpcCalls).toHaveLength(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('uses per-instance limits without a secret, or with one shorter than 32 characters', async () => {
    for (const secret of [undefined, 'short']) {
      if (secret === undefined) delete process.env.RATE_LIMIT_SECRET; else process.env.RATE_LIMIT_SECRET = secret;
      const { limitAttempts } = await load();
      for (let i = 0; i < 3; i++) await limitAttempts([{ rule, id: 'ana' }]);
      await expect(limitAttempts([{ rule, id: 'ana' }])).rejects.toMatchObject({ key: 'rate_limited' });
    }
    expect(rpcCalls).toEqual([]);
  });

  it('does not trust a malformed answer: it counts in memory instead', async () => {
    for (const answer of [[{ hits: 'many' }], [{ hits: -1 }], [], { hits: 1 }, null]) {
      rpcAnswer = answer;
      const { limitAttempts } = await load();
      for (let i = 0; i < 3; i++) await limitAttempts([{ rule, id: 'ana' }]);
      await expect(limitAttempts([{ rule, id: 'ana' }])).rejects.toMatchObject({ key: 'rate_limited' });
    }
  });
});

describe('operator script', () => {
  it('prints the gate the app sends, hashed, and refuses a short secret', async () => {
    const { rateLimitGate } = await load();
    const out = execFileSync('node', ['scripts/rate-limit-gate.mjs'], { env: { ...process.env, RATE_LIMIT_SECRET: SECRET }, encoding: 'utf8' });
    expect(out).toContain(`'"${createHash('sha256').update(rateLimitGate(SECRET)).digest('hex')}"'::jsonb`);
    expect(out).not.toContain(SECRET);
    expect(() => execFileSync('node', ['scripts/rate-limit-gate.mjs'], { env: { ...process.env, RATE_LIMIT_SECRET: 'short' }, stdio: 'pipe' })).toThrow();
  });
});

describe('networks', () => {
  it('groups IPv6 clients by /64 and keeps IPv4 addresses whole', async () => {
    const { networkOf } = await load();
    expect(networkOf('203.0.113.7')).toBe('203.0.113.7');
    expect(networkOf(' ::ffff:203.0.113.7 ')).toBe('203.0.113.7');
    expect(networkOf('2001:db8:85a3:0042:1000:8a2e:0370:7334')).toBe('2001:db8:85a3:42::/64');
    expect(networkOf('2001:DB8:85a3:42::1')).toBe('2001:db8:85a3:42::/64');
    expect(networkOf('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(networkOf('[2001:db8:1:2::5]:443')).toBe('2001:db8:1:2::/64');
    expect(networkOf('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(networkOf('')).toBe('local');
  });

  it('reads the first x-forwarded-for address', async () => {
    forwardedFor = '2001:db8:aa:bb:1::2, 10.0.0.1';
    const { clientNetwork } = await load();
    expect(await clientNetwork()).toBe('2001:db8:aa:bb::/64');
  });
});
