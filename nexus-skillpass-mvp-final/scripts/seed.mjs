#!/usr/bin/env node
// SkillPass demo data tooling. Every record it creates is FICTIONAL and flagged is_demo.
//
//   npm run seed                         Rebuild the local DEMO template (PGlite) from the
//                                        migrations + seed and print a summary.
//   npm run demo:reset                   Delete every local DEMO scenario (visitors start fresh).
//   npm run seed -- --supabase --confirm-demo-project
//                                        Load the demo into a DEDICATED Supabase demo project:
//                                        creates the 16 demo accounts through the Admin API,
//                                        runs supabase/seed.sql and uploads the demo files.
//     add --apply-migrations             to also apply supabase/migrations when the project is empty
//                                        (prefer `supabase db push` with the Supabase CLI).
//
// Supabase mode reads (from the environment or .env.local):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, NEXUS_DEMO_PASSWORD
// The service-role key and database URL are operator secrets: keep them out of the app
// runtime and out of git. Never run this against a project that holds real users.
import { createClient } from '@supabase/supabase-js';
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const root = path.resolve(import.meta.dirname, '..');
const supabaseDir = path.join(root, 'supabase');
const args = new Set(process.argv.slice(2));
const read = (file) => readFile(path.join(supabaseDir, file), 'utf8');

for (const file of ['.env.local', '.env']) {
  const full = path.join(root, file);
  if (existsSync(full)) { try { process.loadEnvFile(full); } catch { /* ignore malformed */ } }
}

const dataDir = path.resolve(root, process.env.NEXUS_DEMO_DATA_DIR || '.demo-data');

async function migrationFiles() {
  return (await readdir(path.join(supabaseDir, 'migrations'))).filter((f) => f.endsWith('.sql')).sort();
}

async function demoUsers() {
  const sql = await read('seed/demo-auth-users.sql');
  return [...sql.matchAll(/\('([0-9a-f-]{36})',\s*'([^']+)',\s*'(\{[^']*\})'\)/g)].map(([, id, email, meta]) => ({ id, email, meta: JSON.parse(meta) }));
}

async function resetSessions() {
  await rm(path.join(dataDir, 'sessions'), { recursive: true, force: true });
  console.log(`Deleted all local DEMO scenarios in ${path.join(dataDir, 'sessions')}.`);
}

// Mirrors src/lib/server/demo-db.ts so the dev server picks up the rebuilt template.
async function rebuildLocalTemplate() {
  const files = ['demo-bootstrap.sql', ...(await migrationFiles()).map((m) => `migrations/${m}`), 'seed/demo-auth-users.sql', 'seed.sql'];
  const contents = await Promise.all(files.map(read));
  const hash = createHash('sha256').update(contents.join('\n--file--\n')).digest('hex').slice(0, 16);
  await mkdir(dataDir, { recursive: true });
  for (const f of await readdir(dataDir)) if (/^template-[0-9a-f]+\.tar\.gz$/.test(f)) await rm(path.join(dataDir, f));
  const started = Date.now();
  const db = new PGlite();
  try {
    for (const sql of contents) await db.exec(sql);
    const { rows } = await db.query(`select
      (select count(*) from public.profiles)::int as users, (select count(*) from public.organizations)::int as organizations,
      (select count(*) from public.challenges)::int as challenges, (select count(*) from public.evidence)::int as evidence,
      (select count(*) from public.vath_entries)::int as vath_entries, (select count(*) from public.credentials)::int as credentials,
      (select count(*) from public.profiles where not is_demo)::int as non_demo_profiles`);
    const dump = await db.dumpDataDir('gzip');
    await writeFile(path.join(dataDir, `template-${hash}.tar.gz`), Buffer.from(await dump.arrayBuffer()));
    console.log(`Local DEMO template rebuilt in ${((Date.now() - started) / 1000).toFixed(1)} s (template-${hash}).`);
    console.table(rows[0]);
    if (rows[0].non_demo_profiles > 0) throw new Error('Seed produced profiles without is_demo; refusing.');
    console.log('Existing scenarios keep their data; run `npm run demo:reset` to discard them.');
  } finally {
    await db.close();
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Set it in the environment or .env.local (never commit it).`);
  return value;
}

async function seedSupabase() {
  if (!args.has('--confirm-demo-project')) {
    throw new Error('Refusing to write to Supabase without --confirm-demo-project. Use a dedicated demo project, never production.');
  }
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
  const dbUrl = required('SUPABASE_DB_URL');
  const password = required('NEXUS_DEMO_PASSWORD');
  if (password.length < 16) throw new Error('NEXUS_DEMO_PASSWORD must have at least 16 characters.');

  const client = new pg.Client({ connectionString: dbUrl, ssl: /localhost|127\.0\.0\.1/.test(dbUrl) ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows: [state] } = await client.query(`select to_regclass('public.profiles') is not null as migrated,
      (select count(*) from auth.users where email not like '%@demo.skillpass.invalid')::int as real_users`);
    if (state.real_users > 0) {
      throw new Error(`This project has ${state.real_users} non-demo account(s). The demo seed only runs on a dedicated demo project.`);
    }
    if (!state.migrated) {
      if (!args.has('--apply-migrations')) throw new Error('Schema not found. Run `supabase db push` first, or pass --apply-migrations.');
      await client.query('begin');
      try {
        for (const file of await migrationFiles()) {
          console.log(`Applying migrations/${file}`);
          await client.query(await read(`migrations/${file}`));
        }
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const user of await demoUsers()) {
      const { data } = await admin.auth.admin.getUserById(user.id);
      if (data?.user) {
        await admin.auth.admin.updateUserById(user.id, { password });
        console.log(`= ${user.email}`);
        continue;
      }
      const { error } = await admin.auth.admin.createUser({ id: user.id, email: user.email, password, email_confirm: true, user_metadata: user.meta });
      if (error) throw new Error(`Could not create ${user.email}: ${error.message}`);
      console.log(`+ ${user.email}`);
    }

    console.log('Running supabase/seed.sql');
    await client.query(await read('seed.sql'));

    const filesDir = path.join(supabaseDir, 'seed', 'files');
    const files = (await readdir(filesDir, { recursive: true, withFileTypes: true })).filter((d) => d.isFile()).map((d) => path.join(d.parentPath, d.name));
    const types = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
    for (const file of files) {
      const key = path.relative(filesDir, file).split(path.sep).join('/');
      const { error } = await admin.storage.from('evidence').upload(key, await readFile(file), {
        contentType: types[path.extname(file).toLowerCase()] ?? 'application/octet-stream', upsert: true,
      });
      if (error) throw new Error(`Upload failed for ${key}: ${error.message}`);
      console.log(`↑ evidence/${key}`);
    }
    console.log('Supabase demo project ready. Set NEXUS_DEMO_MODE=supabase and NEXUS_DEMO_PASSWORD in the app environment.');
  } finally {
    await client.end();
  }
}

try {
  if (args.has('--reset-sessions')) await resetSessions();
  else if (args.has('--supabase')) await seedSupabase();
  else await rebuildLocalTemplate();
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
