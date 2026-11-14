#!/usr/bin/env node
// Prints the SQL that turns on e-mail notices (migration 20261114000001) once RESEND_API_KEY and
// EMAIL_GATE_SECRET are set in Vercel:
//
//   EMAIL_GATE_SECRET=<the value set in Vercel> node scripts/email-gate.mjs
//
// The database keeps only the SHA-256 of a token derived from EMAIL_GATE_SECRET. From the moment the row
// exists, new notices and invitations are queued for e-mail; without it nothing is queued. Run the printed
// statement in the Supabase SQL editor (or the Management API) of the project the app uses, and again
// whenever the secret changes. To turn e-mail off: delete from public.platform_settings where key = 'email_gate';
// Must stay in step with emailGate() in src/lib/server/email.ts.
import { createHash, createHmac } from 'node:crypto';

const secret = process.env.EMAIL_GATE_SECRET?.trim();
if (!secret || secret.length < 32) {
  console.error('Set EMAIL_GATE_SECRET (at least 32 characters, e.g. `openssl rand -hex 32`).');
  process.exit(1);
}
const gate = createHmac('sha256', secret).update('skillpass-email-gate').digest('hex');
const stored = createHash('sha256').update(gate).digest('hex');
console.log(`insert into public.platform_settings (key, value) values ('email_gate', '"${stored}"'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();`);
