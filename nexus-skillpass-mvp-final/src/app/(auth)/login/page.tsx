import type { Metadata } from 'next';
import { supabaseConfig } from '@/lib/server/env';
import { getMessages } from '@/lib/i18n/server';
import { LoginForm } from '../auth-forms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.nav.signIn };
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const next = typeof params.next === 'string' && params.next.startsWith('/') && !params.next.startsWith('//') ? params.next : '/dashboard';
  return <LoginForm next={next} configured={Boolean(supabaseConfig())} />;
}
