import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { getMe } from '@/lib/server/backend';
import { legalPending } from '@/lib/server/legal';
import { legalEntity } from '@/lib/legal/config';
import { getMfaState, mfaPending } from '@/lib/server/mfa';

export const dynamic = 'force-dynamic';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect('/login');
  if (!me.profile.onboarding_completed) redirect('/onboarding');
  // Accounts created before the legal texts (or before their current version) accept them first.
  if (await legalPending()) redirect('/legal/accept');
  // Admins and supervisors complete the second factor before anything else when the database requires it.
  if (mfaPending(await getMfaState(), me.profile.role)) redirect('/mfa');
  return (
    <Suspense>
      <AppShell me={me} legal={Boolean(legalEntity())}>{children}</AppShell>
    </Suspense>
  );
}
