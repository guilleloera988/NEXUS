import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { BrandLink } from '@/components/ui/brand';
import { getMe } from '@/lib/server/backend';
import { getMessages } from '@/lib/i18n/server';
import { LocaleSwitch } from './locale-switch';

export async function PublicHeader({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { t, locale } = await getMessages();
  const me = await getMe().catch(() => null);
  const dark = tone === 'dark';
  return (
    <header className={`no-print sticky top-0 z-40 border-b backdrop-blur ${dark ? 'border-white/10 bg-ink-950/85' : 'border-ink-200/70 bg-white/85'}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <BrandLink tone={dark ? 'light' : 'dark'} />
        <nav aria-label={t.nav.mainNav} className="flex items-center gap-1 sm:gap-2">
          <Link href="/verify" className={`hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold md:inline-flex ${dark ? 'text-ink-200 hover:text-white' : 'text-ink-700 hover:text-ink-950'}`}>
            <ShieldCheck className="size-4" aria-hidden /> {t.nav.verify}
          </Link>
          <Link href="/demo" className={`hidden rounded-lg px-3 py-2 text-sm font-semibold sm:inline-flex ${dark ? 'text-ink-200 hover:text-white' : 'text-ink-700 hover:text-ink-950'}`}>{t.nav.demo}</Link>
          <LocaleSwitch locale={locale} tone={tone} />
          {me ? (
            <Link href="/dashboard" className="btn-primary btn-sm">{t.nav.dashboard}</Link>
          ) : (
            <>
              <Link href="/login" className={`hidden rounded-lg px-3 py-2 text-sm font-semibold sm:inline-flex ${dark ? 'text-white' : 'text-ink-900'}`}>{t.nav.signIn}</Link>
              <Link href="/signup" className="btn-primary btn-sm">{t.nav.signUp}</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export async function PublicFooter() {
  const { t } = await getMessages();
  return (
    <footer className="no-print border-t border-ink-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <BrandLink />
          <p className="mt-3 max-w-sm text-sm text-ink-500">{t.brand.tagline} {t.brand.company}</p>
          <p className="mt-2 text-xs text-ink-400">{t.landing.origin}</p>
        </div>
        <nav aria-label="Footer" className="grid gap-2 text-sm">
          <Link href="/demo" className="text-ink-700 hover:text-ink-950">{t.nav.demo}</Link>
          <Link href="/verify" className="text-ink-700 hover:text-ink-950">{t.nav.verify}</Link>
          <Link href="/signup" className="text-ink-700 hover:text-ink-950">{t.nav.signUp}</Link>
          <Link href="/login" className="text-ink-700 hover:text-ink-950">{t.nav.signIn}</Link>
        </nav>
        <p className="text-xs leading-relaxed text-ink-500">{t.landing.footerDisclaimer} {t.vath.disclaimer}</p>
      </div>
      <div className="border-t border-ink-100 py-4 text-center text-xs text-ink-400">© {new Date().getFullYear()} AINDEV TECH · SkillPass by AINDEV NEXUS</div>
    </footer>
  );
}
