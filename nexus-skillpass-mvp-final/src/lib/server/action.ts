import 'server-only';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { ZodError } from 'zod';
import type { ActionState } from '@/lib/action-state';
import { dictionaries } from '@/lib/i18n';
import { AppError } from './errors';

const KNOWN_ERRORS = new Set(Object.keys(dictionaries.es.errors));

/**
 * Wraps a Server Action body: maps validation/database errors to translation keys,
 * never leaks internals, and refreshes the rendered tree after a successful mutation.
 */
export async function runAction(fn: () => Promise<Partial<ActionState> | void>, options: { revalidate?: boolean } = {}): Promise<ActionState> {
  try {
    const result = (await fn()) ?? {};
    if (options.revalidate !== false) revalidatePath('/', 'layout');
    return { ok: true, at: Date.now(), ...result };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      const key = issue && KNOWN_ERRORS.has(issue.message) ? issue.message : 'invalid_field';
      return { ok: false, error: key, field: issue?.path.map(String).join('.') || undefined, at: Date.now() };
    }
    if (error instanceof AppError) {
      return { ok: false, error: KNOWN_ERRORS.has(error.key) ? error.key : 'generic', field: error.field, at: Date.now() };
    }
    console.error('[skillpass] action failed', error instanceof Error ? error.message : error);
    return { ok: false, error: 'unexpected', at: Date.now() };
  }
}

// ---------------------------------------------------------------------------
// FormData helpers
// ---------------------------------------------------------------------------
export const fdString = (fd: FormData, key: string) => {
  const value = fd.get(key);
  return typeof value === 'string' ? value : '';
};
export const fdAll = (fd: FormData, key: string) => fd.getAll(key).filter((v): v is string => typeof v === 'string' && v !== '');
export const fdBool = (fd: FormData, key: string) => {
  const value = fd.get(key);
  return value === 'on' || value === 'true' || value === '1';
};
export function fdJson(fd: FormData, key = 'payload'): unknown {
  const raw = fdString(fd, key);
  if (!raw || raw.length > 200_000) throw new AppError('invalid_data');
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError('invalid_data');
  }
}

// ---------------------------------------------------------------------------
// Minimal in-memory rate limiter (per server instance). Supabase Auth applies its own limits.
// ---------------------------------------------------------------------------
const buckets = new Map<string, { count: number; until: number }>();
export function rateLimit(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
  const entry = buckets.get(key);
  if (!entry || entry.until < now) {
    buckets.set(key, { count: 1, until: now + windowMs });
    return;
  }
  entry.count += 1;
  if (entry.count > limit) throw new AppError('rate_limited', 429);
}
