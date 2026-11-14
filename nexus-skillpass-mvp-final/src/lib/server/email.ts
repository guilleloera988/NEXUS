import 'server-only';
import { createHmac } from 'node:crypto';
import { after } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { renderEmail, type EmailBatch } from '@/lib/email/render';
import { legalEntity } from '@/lib/legal/config';
import { getMe, read } from './backend';
import { appOrigin, supabaseConfig } from './env';

/*
 * E-mail notices (migration 20261114000001). The database queues a message for each notice worth one; this
 * module claims the queue, sends through Resend and reports back. It runs after each successful action and
 * from a daily cron. It needs RESEND_API_KEY and EMAIL_GATE_SECRET (the database keeps the SHA-256 of a token
 * derived from the secret, platform_settings 'email_gate'); without them, or without the migration, nothing is sent.
 */
const GATE_CONTEXT = 'skillpass-email-gate';
/** Resend allows two requests a second: batches go one after another with a pause. */
const SEND_GAP_MS = 550;

export function emailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const secret = process.env.EMAIL_GATE_SECRET?.trim();
  if (!apiKey || !secret || secret.length < 32) return null;
  return {
    apiKey, secret,
    from: process.env.EMAIL_FROM?.trim() || 'SkillPass <noreply@aindev.com.mx>',
    apiUrl: (process.env.RESEND_API_URL?.trim() || 'https://api.resend.com').replace(/\/+$/, ''),
  };
}

/** The token the queue RPCs check; the database keeps only its SHA-256. */
export const emailGate = (secret: string) => createHmac('sha256', secret).update(GATE_CONTEXT).digest('hex');

let client: { url: string; key: string; instance: SupabaseClient } | null = null;
function anonymousClient(url: string, key: string) {
  // Anonymous on purpose: the queue is worked for everyone, whoever (or nobody) is signed in.
  if (client?.url !== url || client.key !== key) {
    client = { url, key, instance: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) };
  }
  return client.instance;
}

let running = false;
let pausedUntil = 0;
let warned = false;

async function send(config: NonNullable<ReturnType<typeof emailConfig>>, batch: EmailBatch, origin: string): Promise<string | null> {
  try {
    const message = renderEmail(batch, origin, { privacy: legalEntity() !== null });
    const res = await fetch(`${config.apiUrl}/emails`, {
      method: 'POST',
      // The batch id makes a retry of the same request harmless on the provider's side.
      headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json', 'idempotency-key': batch.batch_id },
      body: JSON.stringify({ from: config.from, to: [batch.to], subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    return res.ok ? null : `HTTP ${res.status}`;
  } catch (error) {
    return error instanceof Error ? error.message.slice(0, 120) : 'error';
  }
}

/**
 * Sends what is ready, at most `limit` recipients (few by default: this runs in the tail of a user's request).
 * Returns how many messages went out and how many the provider refused (the queue retries those later), or
 * null when e-mail is not configured, the queue cannot be reached (this instance then stops asking for a
 * minute) or another run is in progress here.
 */
export async function dispatchEmails(limit = 5): Promise<{ sent: number; failed: number } | null> {
  const config = emailConfig();
  const supabase = supabaseConfig();
  if (!config || !supabase || running || Date.now() < pausedUntil) return null;
  running = true;
  try {
    const db = anonymousClient(supabase.url, supabase.key);
    const gate = emailGate(config.secret);
    const cooldown = Math.min(Math.max(Number(process.env.EMAIL_COOLDOWN_SECONDS ?? 900) || 0, 0), 86_400);
    const claimed = await db.rpc('sp_email_claim', { p: { gate, limit, cooldown } }).abortSignal(AbortSignal.timeout(8_000));
    if (claimed.error) throw new Error(claimed.error.message);
    const batches = (Array.isArray(claimed.data) ? claimed.data : []) as EmailBatch[];
    if (batches.length === 0) return { sent: 0, failed: 0 };

    const origin = appOrigin();
    const results: { batch_id: string; ok: boolean; error?: string }[] = [];
    for (const [i, batch] of batches.entries()) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS));
      const error = await send(config, batch, origin);
      results.push(error ? { batch_id: batch.batch_id, ok: false, error } : { batch_id: batch.batch_id, ok: true });
    }
    const failures = results.filter((r) => !r.ok);
    if (failures.length) console.error('[skillpass] e-mail provider refused', failures.length, 'of', results.length, 'messages:', failures[0].error);
    const done = await db.rpc('sp_email_done', { p: { gate, results } }).abortSignal(AbortSignal.timeout(8_000));
    if (done.error) throw new Error(done.error.message);
    return { sent: results.length - failures.length, failed: failures.length };
  } catch (error) {
    pausedUntil = Date.now() + 60_000;
    if (!warned) {
      warned = true;
      console.error('[skillpass] e-mail queue unavailable:', error instanceof Error ? error.message.slice(0, 120) : 'error');
    }
    return null;
  } finally {
    running = false;
  }
}

/** After the response of a successful action: send whatever that action (or an earlier one) queued. */
export function scheduleEmailDispatch() {
  if (!emailConfig() || !supabaseConfig()) return;
  try {
    after(() => dispatchEmails().then(() => undefined, () => undefined));
  } catch {
    /* outside a request (tests, scripts): the cron picks the queue up */
  }
}

export interface EmailSettings { enabled: boolean; locale: 'es' | 'en' | null }

/**
 * The signed-in person's e-mail preferences, or null where there is nothing to choose: e-mail is not set up
 * in this deployment, the account is a DEMO persona (they never get e-mails) or the database has no queue.
 */
export async function emailSettings(): Promise<EmailSettings | null> {
  if (!emailConfig()) return null;
  const me = await getMe();
  if (!me || me.mode !== 'supabase' || me.profile.is_demo) return null;
  const settings = await read<EmailSettings | null>('sp_email_settings', {}).catch(() => null);
  return settings && typeof settings.enabled === 'boolean' ? { enabled: settings.enabled, locale: settings.locale === 'en' || settings.locale === 'es' ? settings.locale : null } : null;
}
