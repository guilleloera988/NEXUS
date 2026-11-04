import type { Metadata } from 'next';
import { getMessages } from '@/lib/i18n/server';
import { ResetForm } from '../auth-forms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.auth.resetTitle };
}

export default function ResetPasswordPage() {
  return <ResetForm />;
}
