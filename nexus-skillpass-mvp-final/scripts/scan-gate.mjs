#!/usr/bin/env node
// Prints the SQL that turns on the antivirus requirement (migration 20261105000001) once the scanner runs and
// SCANNER_URL, SCANNER_TOKEN and SCAN_GATE_SECRET are set in Vercel:
//
//   SCAN_GATE_SECRET=<the value set in Vercel> node scripts/scan-gate.mjs
//
// The database keeps only the SHA-256 of a token derived from SCAN_GATE_SECRET (a Vercel-only secret, never shared
// with the scanner). Run the printed statements in the Supabase SQL editor (or the Management API) of the project
// the app uses, and again whenever the secret changes.
// Must stay in step with scanGate() in src/lib/server/scanner.ts.
import { createHash, createHmac } from 'node:crypto';

const secret = process.env.SCAN_GATE_SECRET?.trim();
if (!secret || secret.length < 32) {
  console.error('Set SCAN_GATE_SECRET (at least 32 characters, e.g. `openssl rand -hex 32`).');
  process.exit(1);
}
const gate = createHmac('sha256', secret).update('skillpass-scan-gate').digest('hex');
const stored = createHash('sha256').update(gate).digest('hex');
console.log(`insert into public.platform_settings (key, value) values ('scan_gate', '"${stored}"'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
update public.platform_settings set value = 'true'::jsonb, updated_at = now() where key = 'scan_required';`);
