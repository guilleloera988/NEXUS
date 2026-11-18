import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { dispatchEmails, emailConfig } from '@/lib/server/email';
import { LIMITS, limitAttempts } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Digests make both sides the same length whatever a caller sends.
const digest = (value: string) => createHash('sha256').update(value).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/**
 * Safety net for e-mail notices: sends what the per-action dispatch left behind (vercel.json runs it daily).
 * With CRON_SECRET set, only Vercel's cron (which sends it as a bearer token) may call it; without it the
 * route is open but can only send what is already due, a few times a minute. Answers how many messages went out.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && !same(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) return new NextResponse('Unauthorized', { status: 401 });
  if (!emailConfig()) return NextResponse.json({ configured: false }, { headers: { 'Cache-Control': 'no-store' } });
  if (!secret) {
    try {
      await limitAttempts([{ rule: LIMITS.emailCron, id: 'all' }]);
    } catch {
      return new NextResponse('Too many requests', { status: 429 });
    }
  }
  // Works through a backlog in rounds, while every message goes out and there is time left.
  const started = Date.now();
  const total = { sent: 0, failed: 0 };
  let skipped = false;
  for (;;) {
    const round = await dispatchEmails(10);
    if (!round) { skipped = total.sent === 0; break; }
    total.sent += round.sent; total.failed += round.failed;
    if (round.sent === 0 || round.failed > 0 || Date.now() - started > 40_000) break;
  }
  return NextResponse.json({ configured: true, ...(skipped ? { skipped: true } : total) }, { headers: { 'Cache-Control': 'no-store' } });
}
