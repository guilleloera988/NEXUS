import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { getMe } from '@/lib/server/backend';

export const dynamic = 'force-dynamic';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect('/login');
  if (!me.profile.onboarding_completed) redirect('/onboarding');
  return (
    <Suspense>
      <AppShell me={me}>{children}</AppShell>
    </Suspense>
  );
}
