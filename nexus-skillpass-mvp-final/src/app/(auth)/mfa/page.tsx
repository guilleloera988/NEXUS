import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { logout } from '@/actions/auth';
import { getMessages } from '@/lib/i18n/server';
import { safeNextPath } from '@/lib/safety';
import { getSession } from '@/lib/server/backend';
import { getMfaState } from '@/lib/server/mfa';
import { MfaChallenge, MfaEnroll } from './mfa-forms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.auth.mfa.title };
}

export default async function MfaPage({ searchParams }: PageProps<'/mfa'>) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === 'string' ? params.next : null);
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/mfa?next=${next}`)}`);
  if (session.mode !== 'supabase') redirect(next);
  const mfa = await getMfaState();
  if (mfa.aal === 'aal2') redirect(next);
  const { t } = await getMessages();
  const M = t.auth.mfa;
  return (
    <>
      <h1 className="text-2xl font-extrabold">{M.title}</h1>
      <p className="mt-1 text-ink-500">{M.subtitle}</p>
      <div className="mt-6">
        {mfa.factorId ? <MfaChallenge factorId={mfa.factorId} next={next} /> : <MfaEnroll next={next} />}
      </div>
      <p className="mt-6 text-sm text-ink-500">{M.lost}</p>
      <form action={logout} className="mt-2"><button type="submit" className="btn-ghost btn-sm">{M.signOut}</button></form>
    </>
  );
}
