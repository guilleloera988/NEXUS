import { getSession, read } from '@/lib/server/backend';
import { relativeRedirect } from '@/lib/redirect';
import type { SkillPassMe } from '@/lib/types';

/** Guided-demo helper: opens the public verification page of the signed-in student's newest credential. */
export async function GET() {
  const session = await getSession();
  if (!session) return relativeRedirect('/demo');
  try {
    const pass = await read<SkillPassMe | null>('sp_skillpass_me');
    const latest = pass?.credentials.find((c) => c.status === 'active' && c.verification_enabled);
    if (!latest) return relativeRedirect('/my-skillpass');
    const query = session.mode === 'demo' ? `?demo=${session.demo.id}` : '';
    return relativeRedirect(`/verify/${latest.code}${query}`);
  } catch {
    return relativeRedirect('/my-skillpass');
  }
}
