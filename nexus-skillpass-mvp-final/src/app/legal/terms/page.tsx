import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocumentPage } from '@/components/legal-document';
import { getMessages } from '@/lib/i18n/server';
import { legalEntity } from '@/lib/legal/config';
import { termsOfService } from '@/lib/legal/terms';

// The LEGAL_* values are read at request time: the page exists only once the deployment has them.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.legal.terms };
}

export default async function Page() {
  const entity = legalEntity();
  if (!entity) notFound();
  const { t, locale } = await getMessages();
  return <LegalDocumentPage doc={termsOfService(locale, entity)} entity={entity} locale={locale} t={t} other={{ href: '/legal/privacy', label: t.legal.privacy }} />;
}
