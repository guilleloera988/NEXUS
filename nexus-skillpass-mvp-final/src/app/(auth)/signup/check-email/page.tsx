import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getMessages } from '@/lib/i18n/server';
import { SIGNUP_EMAIL_COOKIE } from '@/lib/server/auth-cookies';
import { CheckEmailPanel } from '../../auth-forms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.auth.checkEmail.title, robots: { index: false } };
}

export default async function CheckEmailPage({ searchParams }: PageProps<'/signup/check-email'>) {
  const params = await searchParams;
  const remembered = (await cookies()).get(SIGNUP_EMAIL_COOKIE)?.value ?? '';
  const email = remembered.includes('@') && remembered.length <= 254 ? remembered : null;
  return <CheckEmailPanel email={email} pending={params.pending === '1'} />;
}
