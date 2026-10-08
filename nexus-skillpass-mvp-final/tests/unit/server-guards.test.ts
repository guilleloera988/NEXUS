import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AppError, fromDatabaseError } from '@/lib/server/errors';

beforeAll(() => {
  vi.stubEnv('NEXUS_DEMO_SECRET', 'unit-test-secret-unit-test-secret-0123456789');
});

describe('demo session cookie', () => {
  const ID = '0b6c3c1e-8f7a-4c2d-9e1f-1a2b3c4d5e6f';

  it('round-trips a signed session', async () => {
    const { signDemoSession, verifyDemoSession } = await import('@/lib/server/demo-session');
    const token = await signDemoSession(ID, 'supervisor');
    const session = await verifyDemoSession(token);
    expect(session?.id).toBe(ID);
    expect(session?.persona).toBe('supervisor');
  });

  it('rejects tampered, malformed or expired tokens', async () => {
    const { signDemoSession, verifyDemoSession } = await import('@/lib/server/demo-session');
    const token = await signDemoSession(ID, 'student');
    const [payload, mac] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ id: ID, persona: 'admin', exp: 4102444800 })).toString('base64url');
    expect(await verifyDemoSession(`${forged}.${mac}`)).toBeNull();
    expect(await verifyDemoSession(`${payload}.${mac.slice(0, -2)}xx`)).toBeNull();
    expect(await verifyDemoSession(`${payload}.${mac}.extra`)).toBeNull();
    expect(await verifyDemoSession('garbage')).toBeNull();
    expect(await verifyDemoSession(null)).toBeNull();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 1000 * 3600 * 24 * 30);
    expect(await verifyDemoSession(token)).toBeNull();
    vi.useRealTimers();
  });
});

describe('database error mapping', () => {
  it('maps RPC errors to translation keys and fields', () => {
    const e = fromDatabaseError({ code: 'P0001', message: 'sp:invalid_field', detail: 'title' });
    expect(e).toBeInstanceOf(AppError);
    expect([e.key, e.status, e.field]).toEqual(['invalid_field', 400, 'title']);
    expect(fromDatabaseError({ code: '42501', message: 'sp:admin_only' }).status).toBe(403);
  });
  it('never leaks raw database messages', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(fromDatabaseError({ code: '42501', message: 'permission denied for table profiles' }).key).toBe('forbidden');
    expect(fromDatabaseError({ code: '23505', message: 'duplicate key value violates unique constraint "x"' }).key).toBe('duplicate');
    expect(fromDatabaseError({ code: '22P02', message: 'invalid input syntax for type uuid' }).key).toBe('invalid_data');
    expect(fromDatabaseError(new Error('connection refused')).key).toBe('unexpected');
  });
});
