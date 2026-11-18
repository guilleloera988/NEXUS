#!/usr/bin/env node
// Prints the SQL that lets the app use the shared attempt limits (migration 20261104000001).
//
//   RATE_LIMIT_SECRET=<the value set in Vercel> node scripts/rate-limit-gate.mjs
//
// The database keeps only the SHA-256 of a token derived from the secret, never the secret itself. Run the
// printed statement in the Supabase SQL editor (or the Management API) of the project the app uses, and again
// whenever RATE_LIMIT_SECRET changes; until both match, the app keeps per-instance limits.
// Must stay in step with rateLimitGate() in src/lib/server/rate-limit.ts.
import { createHash, createHmac } from 'node:crypto';

const secret = process.env.RATE_LIMIT_SECRET?.trim();
if (!secret || secret.length < 32) {
  console.error('Set RATE_LIMIT_SECRET (at least 32 characters, e.g. `openssl rand -hex 32`).');
  process.exit(1);
}
const token = createHmac('sha256', secret).update('skillpass-rate-limit-gate').digest('hex');
const stored = createHash('sha256').update(token).digest('hex');
console.log(`insert into public.platform_settings (key, value) values ('rate_limit_gate', '"${stored}"'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();`);
