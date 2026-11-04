import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { getMe } from '@/lib/server/backend';
import { getMfaState, mfaPending } from '@/lib/server/mfa';

export const dynamic = 'force-dynamic';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect('/login');
  if (!me.profile.onboarding_completed) redirect('/onboarding');
  // Admins and supervisors complete the second factor before anything else when the database requires it.
  if (mfaPending(await getMfaState(), me.profile.role)) redirect('/mfa');
  return (
    <Suspense>
      <AppShell me={me}>{children}</AppShell>
    </Suspense>
  );
}
