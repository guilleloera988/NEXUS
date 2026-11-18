import { Suspense } from 'react';
import { personaForUser } from '@/lib/demo-personas';
import { getMe } from '@/lib/server/backend';
import { GuidedDemoLoader } from './shell/guided-demo-loader';

/** Keeps the evaluator walkthrough visible on public pages while a demo session is active. */
export async function PublicDemoGuide() {
  const me = await getMe().catch(() => null);
  if (!me?.profile.is_demo) return null;
  return <Suspense><GuidedDemoLoader persona={personaForUser(me.profile.id)} /></Suspense>;
}
