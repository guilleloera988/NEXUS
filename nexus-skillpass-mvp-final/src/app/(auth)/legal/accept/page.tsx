import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { logout } from '@/actions/auth';
import { fmt } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/server';
import { LEGAL_VERSION, legalEntity, legalVersionDate } from '@/lib/legal/config';
import { safeNextPath } from '@/lib/safety';
import { getSession } from '@/lib/server/backend';
import { legalPending } from '@/lib/server/legal';
import { AcceptLegalForm } from './accept-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.legal.acceptTitle };
}

/** Asks an existing account to accept the current terms and privacy notice before going on. */
export default async function AcceptLegalPage({ searchParams }: PageProps<'/legal/accept'>) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === 'string' ? params.next : null);
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/legal/accept?next=${next}`)}`);
  const entity = legalEntity();
  if (!entity || !(await legalPending())) redirect(next);
  const { t, locale } = await getMessages();
  const L = t.legal;
  return (
    <>
      <h1 className="text-2xl font-extrabold">{L.acceptTitle}</h1>
      <p className="mt-1 text-ink-500">{L.acceptText}</p>
      <p className="mt-2 text-sm text-ink-500">{fmt(L.version, { date: legalVersionDate(locale), version: LEGAL_VERSION })}</p>
      <div className="mt-6"><AcceptLegalForm next={next} /></div>
      <p className="mt-6 text-sm text-ink-500">{fmt(L.declineHint, { email: entity.email })}</p>
      <form action={logout} className="mt-2"><button type="submit" className="btn-ghost btn-sm">{t.nav.signOut}</button></form>
    </>
  );
}
