import 'server-only';
import { headers } from 'next/headers';
import { appOrigin } from './env';

/** Absolute public URL for share links and QR codes (NEXT_PUBLIC_APP_URL, else the request host). */
export async function publicUrl(path: string, demoId?: string | null) {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('127.0.0.1') || host?.startsWith('localhost') ? 'http' : 'https');
  const url = new URL(path, appOrigin(host ? `${proto}://${host}` : null));
  if (demoId) url.searchParams.set('demo', demoId);
  return url.toString();
}
