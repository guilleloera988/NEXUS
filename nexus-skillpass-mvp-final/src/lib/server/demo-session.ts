import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { demoDataDir, demoTtlHours } from './env';
import { DEMO_PERSONAS, type DemoPersona } from '@/lib/demo-personas';

export const DEMO_COOKIE = 'sp_demo';

export interface DemoSession {
  id: string;
  persona: DemoPersona;
  exp: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

const g = globalThis as unknown as { __spDemoKey?: Promise<string> };

async function signingKey(): Promise<string> {
  const fromEnv = process.env.NEXUS_DEMO_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  g.__spDemoKey ??= (async () => {
    const dir = demoDataDir();
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, '.session-key');
    try {
      const existing = (await readFile(file, 'utf8')).trim();
      if (existing.length >= 32) return existing;
    } catch {
      /* create below */
    }
    const value = randomBytes(48).toString('hex');
    try {
      await writeFile(file, value, { flag: 'wx', mode: 0o600 });
      return value;
    } catch {
      return (await readFile(file, 'utf8')).trim();
    }
  })();
  return g.__spDemoKey;
}

export async function signDemoSession(id: string, persona: DemoPersona): Promise<string> {
  const session: DemoSession = { id, persona, exp: Math.floor(Date.now() / 1000) + demoTtlHours() * 3600 };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const mac = createHmac('sha256', await signingKey()).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

export async function verifyDemoSession(token: string | undefined | null): Promise<DemoSession | null> {
  if (!token || token.length > 1024) return null;
  try {
    const [payload, mac, ...rest] = token.split('.');
    if (!payload || !mac || rest.length) return null;
    const expected = createHmac('sha256', await signingKey()).update(payload).digest();
    const actual = Buffer.from(mac, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as DemoSession;
    if (!isUuid(session.id) || !(session.persona in DEMO_PERSONAS) || !Number.isFinite(session.exp)) return null;
    if (session.exp < Date.now() / 1000) return null;
    return session;
  } catch {
    return null;
  }
}
