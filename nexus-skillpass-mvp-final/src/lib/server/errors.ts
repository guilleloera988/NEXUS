import 'server-only';

/** Error with a translation key (see messages.errors) and an optional offending field. */
export class AppError extends Error {
  constructor(public key: string, public status = 400, public field?: string) {
    super(key);
  }
}

/**
 * Normalizes errors raised by PostgreSQL (PGlite or Supabase/PostgREST).
 * The RPC layer raises messages shaped "sp:<key>" with the field in DETAIL.
 */
export function fromDatabaseError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = (error ?? {}) as { code?: string; message?: string; detail?: string; details?: string };
  const message = e.message ?? '';
  const field = (e.detail ?? e.details ?? '') || undefined;
  const match = /sp:([a-z_]+)/.exec(message);
  if (match) return new AppError(match[1], e.code === '42501' ? 403 : 400, field);
  if (e.code === '42501' || /permission denied/i.test(message)) return new AppError('forbidden', 403);
  if (e.code === '23505') return new AppError('duplicate', 409);
  if (e.code?.startsWith('22') || e.code?.startsWith('23')) return new AppError('invalid_data', 400);
  console.error('[skillpass] database operation failed', e.code ?? '', message.slice(0, 200));
  return new AppError('unexpected', 500);
}
