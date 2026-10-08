import type { Metadata } from 'next';
import { supabaseConfig } from '@/lib/server/env';
import { getMessages } from '@/lib/i18n/server';
import { ForgotForm } from '../auth-forms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.auth.forgotTitle };
}

export default function ForgotPasswordPage() {
  return <ForgotForm configured={Boolean(supabaseConfig())} />;
}
