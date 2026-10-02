import { PGlite } from '@electric-sql/pglite';
import { randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const root = path.resolve(import.meta.dirname, '..', '..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

export const USERS = {
  maria: '10000000-0000-4000-8000-000000000001',
  carlos: '10000000-0000-4000-8000-000000000002',
  laura: '10000000-0000-4000-8000-000000000003',
  elena: '10000000-0000-4000-8000-000000000004',
  admin: '10000000-0000-4000-8000-000000000005',
  mariana: '10000000-0000-4000-8000-000000000006',
  hector: '10000000-0000-4000-8000-000000000007',
  luis: '10000000-0000-4000-8000-000000000008',
  ruben: '10000000-0000-4000-8000-000000000009',
  diego: '10000000-0000-4000-8000-000000000011',
  sofia: '10000000-0000-4000-8000-000000000012',
  andres: '10000000-0000-4000-8000-000000000013',
  valeria: '10000000-0000-4000-8000-000000000014',
  jorge: '10000000-0000-4000-8000-000000000015',
  camila: '10000000-0000-4000-8000-000000000016',
} as const;

export const ORGS = {
  nova: '20000000-0000-4000-8000-000000000001',
  demoUniversity: '20000000-0000-4000-8000-000000000002',
  bajio: '20000000-0000-4000-8000-000000000003',
  tecDemo: '20000000-0000-4000-8000-000000000004',
  agroPending: '20000000-0000-4000-8000-000000000006',
} as const;

export const COMP = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const CHALLENGE = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export interface TestTx {
  query<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(query: string): Promise<unknown>;
}
export interface TestDb extends TestTx {
  transaction<R>(fn: (tx: TestTx) => Promise<R>): Promise<R>;
  close(): Promise<void>;
}

/**
 * Real PostgreSQL backend, used when TEST_DATABASE_URL points to a server where the
 * connecting user may create databases (see scripts/test-postgres.mjs). Each call gets
 * its own throwaway database so suites never share state.
 */
async function createPostgresDatabase(url: string): Promise<TestDb> {
  const name = `sp_test_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  const target = new URL(url);
  target.pathname = `/${name}`;
  const client = new pg.Client({ connectionString: target.toString() });
  await client.connect();
  const db: TestDb = {
    query: async <T>(query: string, params: unknown[] = []) => ({ rows: (await client.query(query, params)).rows as T[] }),
    exec: (query: string) => client.query(query),
    async transaction<R>(fn: (tx: TestTx) => Promise<R>) {
      await client.query('begin');
      try {
        const result = await fn({ query: db.query, exec: db.exec });
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    },
    async close() {
      await client.end();
      const cleanup = new pg.Client({ connectionString: url });
      await cleanup.connect();
      await cleanup.query(`drop database if exists ${name} with (force)`);
      await cleanup.end();
    },
  };
  return db;
}

export const backend = process.env.TEST_DATABASE_URL ? 'postgres' : 'pglite';

/** Fresh database with the exact migrations, the demo auth emulation and (optionally) the seed. */
export async function createDatabase({ seed = true, extraSql = '' } = {}): Promise<TestDb> {
  const url = process.env.TEST_DATABASE_URL;
  const db: TestDb = url ? await createPostgresDatabase(url) : new PGlite();
  await db.exec(await read('supabase/demo-bootstrap.sql'));
  if (extraSql) await db.exec(extraSql);
  const files = (await readdir(path.join(root, 'supabase/migrations'))).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) await db.exec(await read(`supabase/migrations/${file}`));
  if (seed) {
    await db.exec(await read('supabase/seed/demo-auth-users.sql'));
    await db.exec(await read('supabase/seed.sql'));
  }
  return db;
}

/** Runs SQL as an API caller: role anon (actor null) or authenticated with a JWT subject. */
export async function sql<T = Record<string, unknown>>(db: TestDb, actor: string | null, query: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [actor ?? '']);
    await tx.exec(actor ? 'set local role authenticated' : 'set local role anon');
    return (await tx.query<T>(query, params)).rows;
  });
}

export async function rpc<T = Record<string, unknown>>(db: TestDb, actor: string | null, fn: string, payload: unknown = {}) {
  const rows = await sql<{ r: T }>(db, actor, `select public.${fn}($1::jsonb) as r`, [JSON.stringify(payload)]);
  return rows[0]?.r as T;
}
