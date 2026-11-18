import 'server-only';
import { PGlite } from '@electric-sql/pglite';
import { createHash, randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { demoDataDir, demoMaxSessions, demoTtlHours } from './env';
import { AppError } from './errors';
import { isUuid } from './demo-session';

/*
 * Local DEMO engine.
 * Every visitor gets an isolated copy of an embedded PostgreSQL (PGlite) database built
 * from the SAME migrations and seed used for Supabase, so RLS and RPC logic are identical.
 * A template is built once per SQL version and cloned per session (~1 s).
 */

const MAX_OPEN = 4;
const supabaseDir = () => path.join(process.cwd(), 'supabase');
const sessionsDir = () => path.join(demoDataDir(), 'sessions');
export const demoUploadsDir = (id: string) => path.join(sessionsDir(), id, 'uploads');

interface OpenDb {
  db: Promise<PGlite>;
  queue: Promise<unknown>;
  lastUsed: number;
}

const g = globalThis as unknown as {
  __spTemplate?: Promise<{ hash: string; dump: Blob }>;
  __spOpen?: Map<string, OpenDb>;
};
const open = (g.__spOpen ??= new Map());

async function sqlSources() {
  const migrations = (await readdir(path.join(supabaseDir(), 'migrations'))).filter((f) => f.endsWith('.sql')).sort();
  const files = ['demo-bootstrap.sql', ...migrations.map((m) => `migrations/${m}`), 'seed/demo-auth-users.sql', 'seed.sql'];
  const contents = await Promise.all(files.map((f) => readFile(path.join(supabaseDir(), f), 'utf8')));
  const hash = createHash('sha256').update(contents.join('\n--file--\n')).digest('hex').slice(0, 16);
  return { contents, hash };
}

async function buildTemplate(): Promise<{ hash: string; dump: Blob }> {
  const { contents, hash } = await sqlSources();
  const cached = path.join(demoDataDir(), `template-${hash}.tar.gz`);
  try {
    const bytes = await readFile(cached);
    return { hash, dump: new Blob([bytes]) };
  } catch {
    /* build below */
  }
  const db = new PGlite();
  try {
    for (const sql of contents) await db.exec(sql);
    const dump = await db.dumpDataDir('gzip');
    await mkdir(demoDataDir(), { recursive: true });
    await writeFile(cached, Buffer.from(await dump.arrayBuffer()));
    return { hash, dump };
  } finally {
    await db.close();
  }
}

function template() {
  g.__spTemplate ??= buildTemplate().catch((error) => {
    g.__spTemplate = undefined;
    throw error;
  });
  return g.__spTemplate;
}

/** Deletes expired scenarios and keeps the number of scenarios under the configured cap. */
async function cleanup() {
  let entries: { id: string; created: number }[] = [];
  try {
    const dirs = (await readdir(sessionsDir(), { withFileTypes: true })).filter((d) => d.isDirectory() && isUuid(d.name));
    entries = await Promise.all(dirs.map(async (d) => {
      try {
        const meta = JSON.parse(await readFile(path.join(sessionsDir(), d.name, 'meta.json'), 'utf8')) as { created: number };
        return { id: d.name, created: meta.created };
      } catch {
        return { id: d.name, created: (await stat(path.join(sessionsDir(), d.name))).mtimeMs };
      }
    }));
  } catch {
    return;
  }
  const expiry = Date.now() - demoTtlHours() * 3600 * 1000;
  entries.sort((a, b) => a.created - b.created);
  const excess = Math.max(0, entries.length - demoMaxSessions() + 1);
  const remove = entries.filter((e, i) => e.created < expiry || i < excess);
  for (const entry of remove) {
    if (open.has(entry.id)) continue;
    await rm(path.join(sessionsDir(), entry.id), { recursive: true, force: true });
  }
}

/** Creates a fresh, isolated demo scenario and returns its id. */
export async function createDemoScenario(): Promise<string> {
  const { hash, dump } = await template();
  await cleanup();
  const id = randomUUID();
  const dir = path.join(sessionsDir(), id);
  await mkdir(dir, { recursive: true });
  const db = new PGlite(path.join(dir, 'pgdata'), { loadDataDir: dump });
  await db.waitReady;
  await cp(path.join(supabaseDir(), 'seed', 'files'), demoUploadsDir(id), { recursive: true });
  await writeFile(path.join(dir, 'meta.json'), JSON.stringify({ created: Date.now(), hash }));
  open.set(id, { db: Promise.resolve(db), queue: Promise.resolve(), lastUsed: Date.now() });
  await evictIdle();
  return id;
}

async function evictIdle() {
  if (open.size <= MAX_OPEN) return;
  const candidates = [...open.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  for (const [id, entry] of candidates.slice(0, open.size - MAX_OPEN)) {
    open.delete(id);
    entry.queue.then(async () => (await entry.db).close()).catch(() => undefined);
  }
}

async function openScenario(id: string): Promise<OpenDb> {
  if (!isUuid(id)) throw new AppError('demo_expired', 404);
  const existing = open.get(id);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing;
  }
  const dir = path.join(sessionsDir(), id);
  const { hash } = await template();
  try {
    const meta = JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf8')) as { hash: string };
    await stat(path.join(dir, 'pgdata', 'PG_VERSION'));
    if (meta.hash !== hash) throw new Error('outdated scenario');
  } catch {
    throw new AppError('demo_expired', 404);
  }
  const entry: OpenDb = { db: PGlite.create(path.join(dir, 'pgdata')), queue: Promise.resolve(), lastUsed: Date.now() };
  entry.db.catch(() => open.delete(id));
  open.set(id, entry);
  await evictIdle();
  return entry;
}

export async function demoScenarioExists(id: string) {
  try {
    await openScenario(id);
    return true;
  } catch {
    return false;
  }
}

/** Runs one RPC inside a transaction as `actor` (or anon) with RLS enforced, like a Supabase JWT. */
export async function demoRpc<T>(id: string, actor: string | null, fn: string, payload: unknown): Promise<T> {
  const entry = await openScenario(id);
  const job = entry.queue.catch(() => undefined).then(async () => {
    const db = await entry.db;
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [actor ?? '']);
      await tx.exec(actor ? 'set local role authenticated' : 'set local role anon');
      const result = await tx.query<{ r: T }>(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(payload ?? {})]);
      return result.rows[0]?.r as T;
    });
  });
  entry.queue = job.catch(() => undefined);
  entry.lastUsed = Date.now();
  return job;
}

/** Test/maintenance helper: removes every local demo scenario (server must be stopped). */
export async function resetDemoScenarios() {
  await rm(sessionsDir(), { recursive: true, force: true });
}
