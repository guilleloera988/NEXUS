import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { BrandLink, FullLogo } from '@/components/ui/brand';
import { LocaleSwitch } from '@/components/shell/locale-switch';
import { getMessages } from '@/lib/i18n/server';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = await getMessages();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-ink-950 p-10 text-white lg:flex lg:flex-col">
        <div className="grid-bg absolute inset-0 opacity-60" aria-hidden />
        <div className="absolute -bottom-32 -left-32 size-[28rem] rounded-full bg-gold-500/20 blur-3xl" aria-hidden />
        <div className="relative"><BrandLink tone="light" /></div>
        <div className="relative mt-auto max-w-md">
          <p className="text-4xl font-extrabold leading-tight"><span className="gold-text">{t.landing.heroTitle}</span></p>
          <p className="mt-4 text-ink-300">{t.landing.heroSubtitle}</p>
          <ul className="mt-8 space-y-3 text-sm text-ink-200">
            {t.landing.verifiedApplied.items.map((item) => (
              <li key={item} className="flex gap-2"><BadgeCheck className="size-5 shrink-0 text-gold-300" aria-hidden />{item}</li>
            ))}
          </ul>
        </div>
        <p className="relative mt-10 text-xs text-ink-500">{t.brand.company}</p>
      </aside>
      <div className="flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-4 sm:px-8">
          <div className="lg:hidden"><BrandLink /></div>
          <div className="ml-auto flex items-center gap-2">
            <LocaleSwitch locale={locale} />
            <Link href="/" className="btn-ghost btn-sm">{t.nav.home}</Link>
          </div>
        </div>
        <main id="main" className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 hidden justify-center sm:flex lg:hidden"><FullLogo width={180} /></div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
