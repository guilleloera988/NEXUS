import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { I18nProvider } from '@/lib/i18n/client';
import { getMessages } from '@/lib/i18n/server';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

function baseUrl() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000');
  } catch {
    return new URL('http://127.0.0.1:3000');
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getMessages();
  return {
    metadataBase: baseUrl(),
    title: { default: `${t.meta.title} · ${t.landing.heroTitle}`, template: `%s · SkillPass` },
    description: t.meta.description,
    applicationName: 'SkillPass',
    openGraph: { title: t.meta.title, description: t.landing.heroSubtitle, type: 'website', locale: locale === 'es' ? 'es_MX' : 'en_US', siteName: 'SkillPass' },
    twitter: { card: 'summary_large_image', title: t.meta.title, description: t.landing.heroSubtitle },
  };
}

export const viewport: Viewport = { themeColor: '#08080a', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getMessages();
  return (
    <html lang={locale} className={jakarta.variable} data-scroll-behavior="smooth">
      <body className="min-h-dvh font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-ink-950 focus:px-4 focus:py-2 focus:text-white">
          {t.common.skipToContent}
        </a>
        <I18nProvider locale={locale} messages={t}>{children}</I18nProvider>
      </body>
    </html>
  );
}
