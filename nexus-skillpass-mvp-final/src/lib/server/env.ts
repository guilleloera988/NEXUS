import 'server-only';
import path from 'node:path';

export type DemoMode = 'local' | 'supabase' | 'off';

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function demoMode(): DemoMode {
  const raw = (process.env.NEXUS_DEMO_MODE || '').trim().toLowerCase();
  if (raw === 'local' || raw === 'supabase' || raw === 'off') {
    // The embedded database needs a persistent local disk; refuse it on Vercel functions.
    if (raw === 'local' && process.env.VERCEL) return 'off';
    return raw;
  }
  return process.env.VERCEL ? 'off' : 'local';
}

export const demoDataDir = () => path.resolve(process.env.NEXUS_DEMO_DATA_DIR || '.demo-data');
export const demoTtlHours = () => Math.min(Math.max(Number(process.env.NEXUS_DEMO_TTL_HOURS) || 48, 1), 24 * 30);
export const demoMaxSessions = () => Math.min(Math.max(Number(process.env.NEXUS_DEMO_MAX_SESSIONS) || 50, 1), 500);
export const maxUploadBytes = () => Math.min(Math.max(Number(process.env.MAX_UPLOAD_MB) || 4, 1), 10) * 1024 * 1024;

/** Absolute origin for links that leave the app (QR codes, e-mails, share URLs). */
export function appOrigin(requestOrigin?: string | null) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      /* fall through */
    }
  }
  return requestOrigin || 'http://127.0.0.1:3000';
}
