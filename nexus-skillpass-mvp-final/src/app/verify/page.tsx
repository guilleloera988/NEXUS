import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/shell/public-chrome';
import { getMessages } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.publicPages.verifyTitle };
}

export default async function VerifyPage({ searchParams }: PageProps<'/verify'>) {
  const params = await searchParams;
  const code = typeof params.code === 'string' ? params.code.trim().toUpperCase() : '';
  if (code) redirect(`/verify/${encodeURIComponent(code.slice(0, 40))}`);
  const { t } = await getMessages();
  const P = t.publicPages;
  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-4 py-16">
        <div className="w-full text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-ink-950 text-gold-300"><ShieldCheck className="size-7" aria-hidden /></span>
          <h1 className="mt-4 text-3xl font-extrabold">{P.verifyTitle}</h1>
          <p className="mt-2 text-ink-500">{P.howVerifiedText}</p>
          <form method="get" className="mt-8 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="code" className="sr-only">{P.enterCode}</label>
            <input id="code" name="code" required placeholder={P.codePlaceholder} className="input font-mono uppercase tracking-wide" maxLength={40} autoComplete="off" />
            <button type="submit" className="btn-primary">{P.verifyButton}</button>
          </form>
          <p className="mt-4 text-xs text-ink-500">{P.notOfficial}</p>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
