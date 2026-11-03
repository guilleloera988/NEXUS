import 'server-only';
import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { demoMode, supabaseConfig } from './env';
import { AppError } from './errors';

/*
 * Attempt limits shared by every server instance (migration 20261104000001). The counters live in the
 * database behind sp_rate_limit, which only answers callers that hold RATE_LIMIT_SECRET. Without the secret
 * or the migration (local DEMO, the public demo project) the limits are kept in this instance's memory.
 *
 * Per-network limits stay generous: a whole class can sign in from one campus address. The tighter ones
 * follow the account (an e-mail address or a user id).
 */
export const LIMITS = {
  loginNetwork: { name: 'login-ip', limit: 60, windowSeconds: 300 },
  loginFailures: { name: 'login-fail', limit: 10, windowSeconds: 900 },
  signupNetwork: { name: 'signup-ip', limit: 40, windowSeconds: 600 },
  signupEmail: { name: 'signup-email', limit: 3, windowSeconds: 3600 },
  resendNetwork: { name: 'resend-ip', limit: 10, windowSeconds: 600 },
  resendEmail: { name: 'resend-email', limit: 3, windowSeconds: 900 },
  forgotNetwork: { name: 'forgot-ip', limit: 20, windowSeconds: 600 },
  forgotEmail: { name: 'forgot-email', limit: 3, windowSeconds: 900 },
  mfaVerifyBurst: { name: 'mfa-verify', limit: 5, windowSeconds: 300 },
  mfaVerifyHour: { name: 'mfa-verify-hour', limit: 20, windowSeconds: 3600 },
  mfaEnroll: { name: 'mfa-enroll', limit: 5, windowSeconds: 600 },
  upload: { name: 'upload', limit: 20, windowSeconds: 60 },
  demo: { name: 'demo', limit: 30, windowSeconds: 60 },
} as const satisfies Record<string, { name: string; limit: number; windowSeconds: number }>;

export interface AttemptCheck {
  rule: { name: string; limit: number; windowSeconds: number };
  /** Whose attempts these are: a network, a normalized e-mail address or a user id. */
  id: string;
  /**
   * 'count' (default) records this attempt and allows it while the window holds at most `limit` of them.
   * 'peek' records nothing and refuses once earlier attempts reached `limit` (failures counted with 'count').
   */
  mode?: 'count' | 'peek';
}

const GATE_CONTEXT = 'skillpass-rate-limit-gate';

function secret() {
  const value = process.env.RATE_LIMIT_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

/** The token sp_rate_limit checks; the database keeps only its SHA-256 (platform_settings 'rate_limit_gate'). */
export const rateLimitGate = (key: string) => createHmac('sha256', key).update(GATE_CONTEXT).digest('hex');

const digest = (key: string, check: AttemptCheck) =>
  createHmac('sha256', key).update(`${check.rule.name}\n${check.rule.windowSeconds}\n${check.id}`).digest('hex');

// ---------------------------------------------------------------------------
// Per-instance fallback
// ---------------------------------------------------------------------------
const buckets = new Map<string, { hits: number; until: number }>();

function memoryHits(check: AttemptCheck, now = Date.now()) {
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.until <= now) buckets.delete(k);
  const key = `${check.rule.name}\n${check.rule.windowSeconds}\n${check.id}`;
  const entry = buckets.get(key);
  const current = entry && entry.until > now ? entry : null;
  if (check.mode === 'peek') return current?.hits ?? 0;
  if (!current) {
    buckets.set(key, { hits: 1, until: now + check.rule.windowSeconds * 1000 });
    return 1;
  }
  current.hits += 1;
  return current.hits;
}

// ---------------------------------------------------------------------------
// Shared counters
// ---------------------------------------------------------------------------
let warned = false;
let pausedUntil = 0;
function unavailable(reason: string) {
  // After a failure this instance stops asking for a minute, so a missing migration or an outage does not add
  // a failing round trip to every sign-in.
  pausedUntil = Date.now() + 60_000;
  if (warned) return;
  warned = true;
  console.error(`[skillpass] shared attempt limits unavailable (${reason}); using per-instance limits`);
}

let client: { url: string; key: string; instance: SupabaseClient } | null = null;
function anonymousClient(url: string, key: string) {
  // Anonymous on purpose: the counters never depend on, or refresh, the visitor's session.
  if (client?.url !== url || client.key !== key) {
    client = { url, key, instance: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) };
  }
  return client.instance;
}

async function sharedHits(checks: AttemptCheck[]): Promise<number[] | null> {
  const key = secret();
  const config = supabaseConfig();
  if (!key || !config) {
    if (process.env.VERCEL && demoMode() === 'off' && config && !warned) {
      warned = true;
      console.error('[skillpass] RATE_LIMIT_SECRET is not set; using per-instance attempt limits');
    }
    return null;
  }
  if (Date.now() < pausedUntil) return null;
  try {
    const { data, error } = await anonymousClient(config.url, config.key).rpc('sp_rate_limit', {
      p: {
        gate: rateLimitGate(key),
        checks: checks.map((check) => ({ key: digest(key, check), window: check.rule.windowSeconds, hit: check.mode !== 'peek' })),
      },
    }).abortSignal(AbortSignal.timeout(3000));
    if (error) throw new Error(error.message);
    if (!Array.isArray(data) || data.length !== checks.length) throw new Error('unexpected response');
    return data.map((row: { hits?: unknown }) => {
      const hits = Number(row?.hits);
      if (!Number.isInteger(hits) || hits < 0) throw new Error('unexpected response');
      return hits;
    });
  } catch (error) {
    unavailable(error instanceof Error ? error.message.slice(0, 120) : 'error');
    return null;
  }
}

/** Records the attempts and throws `rate_limited` (429) when any of them is over its limit. */
export async function limitAttempts(checks: AttemptCheck[]): Promise<void> {
  if (checks.length === 0) return;
  const hits = (await sharedHits(checks)) ?? checks.map((check) => memoryHits(check));
  const over = checks.some((check, i) => (check.mode === 'peek' ? hits[i] >= check.rule.limit : hits[i] > check.rule.limit));
  if (over) throw new AppError('rate_limited', 429);
}

/** Records attempts without refusing anything (e.g. a failed sign-in, counted after the fact). */
export async function recordAttempts(checks: AttemptCheck[]): Promise<void> {
  if (checks.length === 0) return;
  if (!(await sharedHits(checks))) for (const check of checks) memoryHits(check);
}

// ---------------------------------------------------------------------------
// Identities
// ---------------------------------------------------------------------------
/**
 * The visitor's network. Vercel sets x-forwarded-for itself (a client cannot spoof it there). An IPv6 client
 * usually holds a whole /64, so addresses in one /64 share their limits.
 */
export async function clientNetwork() {
  const h = await headers();
  return networkOf(h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'local');
}

export function networkOf(raw: string) {
  const value = raw.trim().toLowerCase().replace(/^\[|\](:\d+)?$/g, '').replace(/%.*$/, '');
  if (!value.includes(':')) return value || 'local';
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  if (mapped) return mapped[1];
  const [head, tail] = value.split('::', 2);
  const left = head ? head.split(':') : [];
  const right = tail === undefined ? [] : tail ? tail.split(':') : [];
  const groups = tail === undefined ? left : [...left, ...Array(Math.max(8 - left.length - right.length, 0)).fill('0'), ...right];
  if (groups.length < 4 || groups.slice(0, 4).some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return value.slice(0, 64);
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

export const emailIdentity = (email: string) => email.trim().toLowerCase();
