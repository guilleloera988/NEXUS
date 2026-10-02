#!/usr/bin/env node
// Runs the database suite (RLS, grants, workflow, integrity) against a REAL PostgreSQL
// server instead of embedded PGlite.
//
//   npm run test:pg                      # boots a throwaway local cluster (needs initdb/pg_ctl)
//   TEST_DATABASE_URL=postgres://... npm run test:pg   # uses an existing server (e.g. CI service)
//
// The connecting user must be allowed to CREATE DATABASE and CREATE ROLE: every suite
// creates its own database and the demo bootstrap creates the anon/authenticated roles.
// Never point this at a Supabase project or any database holding real data.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';

const cwd = path.resolve(import.meta.dirname, '..');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });

function vitest(url) {
  const result = spawnSync('npx', ['vitest', 'run', 'tests/database.test.ts', 'tests/storage.test.ts'], {
    cwd, stdio: 'inherit', env: { ...process.env, TEST_DATABASE_URL: url },
  });
  return result.status ?? 1;
}

if (process.env.TEST_DATABASE_URL) process.exit(vitest(process.env.TEST_DATABASE_URL));

function findBin() {
  const candidates = [];
  if (process.env.PG_BIN) candidates.push(process.env.PG_BIN);
  try { candidates.push(execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim()); } catch { /* not on PATH */ }
  if (existsSync('/usr/lib/postgresql')) {
    for (const v of readdirSync('/usr/lib/postgresql').sort().reverse()) candidates.push(`/usr/lib/postgresql/${v}/bin`);
  }
  return candidates.find((dir) => existsSync(path.join(dir, 'initdb')) && existsSync(path.join(dir, 'pg_ctl')));
}

const freePort = () => new Promise((resolve, reject) => {
  const srv = createServer();
  srv.once('error', reject);
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});

const bin = findBin();
if (!bin) {
  console.error('PostgreSQL server binaries not found. Install PostgreSQL 15+ or set PG_BIN / TEST_DATABASE_URL.');
  process.exit(1);
}

// PostgreSQL refuses to run as root; in containers we hand the cluster to the postgres user.
const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const wrap = (cmd, args) => (asRoot ? ['runuser', ['-u', 'postgres', '--', cmd, ...args]] : [cmd, args]);

const dir = mkdtempSync(path.join(os.tmpdir(), 'skillpass-pg-'));
const data = path.join(dir, 'data');
const port = await freePort();
if (asRoot) { chmodSync(dir, 0o777); run('chown', ['postgres', dir]); }

let code = 1;
try {
  run(...wrap(path.join(bin, 'initdb'), ['-D', data, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--no-locale']), { stdio: 'ignore' });
  run(...wrap(path.join(bin, 'pg_ctl'), ['-D', data, '-l', path.join(dir, 'server.log'), '-w', '-o', `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1 -c fsync=off`, 'start']), { stdio: 'ignore' });
  const version = execFileSync(path.join(bin, 'postgres'), ['--version'], { encoding: 'utf8' }).trim();
  console.log(`Real PostgreSQL ready: ${version} on 127.0.0.1:${port}`);
  code = vitest(`postgres://postgres@127.0.0.1:${port}/postgres`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  try { run(...wrap(path.join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop']), { stdio: 'ignore' }); } catch { /* already stopped */ }
  rmSync(dir, { recursive: true, force: true });
}
process.exit(code);
