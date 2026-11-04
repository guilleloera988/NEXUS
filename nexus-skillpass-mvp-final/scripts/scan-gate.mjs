#!/usr/bin/env node
// Prints the SQL that turns on the antivirus requirement (migration 20261105000001) once the scanner runs and
// SCANNER_URL / SCANNER_TOKEN are set in Vercel:
//
//   SCANNER_TOKEN=<the value set in Vercel and in the scanner> node scripts/scan-gate.mjs
//
// The database keeps only the SHA-256 of a token derived from SCANNER_TOKEN. Run the printed statements in the
// Supabase SQL editor (or the Management API) of the project the app uses, and again whenever the token changes.
// Must stay in step with scanGate() in src/lib/server/scanner.ts.
import { createHash, createHmac } from 'node:crypto';

const token = process.env.SCANNER_TOKEN?.trim();
if (!token || token.length < 32) {
  console.error('Set SCANNER_TOKEN (at least 32 characters, e.g. `openssl rand -hex 32`).');
  process.exit(1);
}
const gate = createHmac('sha256', token).update('skillpass-scan-gate').digest('hex');
const stored = createHash('sha256').update(gate).digest('hex');
console.log(`insert into public.platform_settings (key, value) values ('scan_gate', '"${stored}"'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
update public.platform_settings set value = 'true'::jsonb, updated_at = now() where key = 'scan_required';`);
