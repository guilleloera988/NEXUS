import Link from 'next/link';
import { Compass } from 'lucide-react';
import { BrandLink } from '@/components/ui/brand';
import { getMessages } from '@/lib/i18n/server';

export default async function NotFound() {
  const { t } = await getMessages();
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <div className="mb-8 flex justify-center"><BrandLink /></div>
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-ink-950 text-gold-300"><Compass className="size-7" aria-hidden /></span>
        <h1 className="text-2xl font-extrabold">{t.errors.notFoundTitle}</h1>
        <p className="mt-2 text-ink-500">{t.errors.notFoundText}</p>
        <Link href="/" className="btn-primary mt-6">{t.errors.goHome}</Link>
      </div>
    </main>
  );
}
