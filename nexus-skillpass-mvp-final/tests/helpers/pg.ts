import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

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

/** Fresh database with the exact migrations, the demo auth emulation and (optionally) the seed. */
export async function createDatabase({ seed = true, extraSql = '' } = {}) {
  const db = new PGlite();
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
export async function sql<T = Record<string, unknown>>(db: PGlite, actor: string | null, query: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [actor ?? '']);
    await tx.exec(actor ? 'set local role authenticated' : 'set local role anon');
    return (await tx.query<T>(query, params)).rows;
  });
}

export async function rpc<T = Record<string, unknown>>(db: PGlite, actor: string | null, fn: string, payload: unknown = {}) {
  const rows = await sql<{ r: T }>(db, actor, `select public.${fn}($1::jsonb) as r`, [JSON.stringify(payload)]);
  return rows[0]?.r as T;
}
