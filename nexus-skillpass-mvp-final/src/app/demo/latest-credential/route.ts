import { NextResponse, type NextRequest } from 'next/server';
import { getSession, read } from '@/lib/server/backend';
import type { SkillPassMe } from '@/lib/types';

/** Guided-demo helper: opens the public verification page of the signed-in student's newest credential. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/demo', request.url));
  try {
    const pass = await read<SkillPassMe | null>('sp_skillpass_me');
    const latest = pass?.credentials.find((c) => c.status === 'active' && c.verification_enabled);
    if (!latest) return NextResponse.redirect(new URL('/my-skillpass', request.url));
    const target = new URL(`/verify/${latest.code}`, request.url);
    if (session.mode === 'demo') target.searchParams.set('demo', session.demo.id);
    return NextResponse.redirect(target);
  } catch {
    return NextResponse.redirect(new URL('/my-skillpass', request.url));
  }
}
