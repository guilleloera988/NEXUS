import type { Metadata } from 'next';
import { supabaseConfig } from '@/lib/server/env';
import { getMessages } from '@/lib/i18n/server';
import { SignupForm } from '../auth-forms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.nav.signUp };
}

export default async function SignupPage({ searchParams }: PageProps<'/signup'>) {
  const params = await searchParams;
  const type = params.type === 'company' || params.type === 'university' ? params.type : 'student';
  return <SignupForm configured={Boolean(supabaseConfig())} initialType={type} />;
}
