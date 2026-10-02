import Link from 'next/link';
import type { ReactNode } from 'react';
import { Bell, FlaskConical, Search } from 'lucide-react';
import { exitDemo, switchPersona } from '@/actions/demo';
import { DEMO_PERSONA_KEYS, personaForUser } from '@/lib/demo-personas';
import { getMessages } from '@/lib/i18n/server';
import type { Me } from '@/lib/types';
import { GuidedDemo } from './guided-demo';
import { LocaleSwitch } from './locale-switch';
import { navFor } from './nav';
import { MobileNav, Sidebar, UserMenu } from './shell-client';

export async function AppShell({ me, children }: { me: Me; children: ReactNode }) {
  const { t, locale } = await getMessages();
  const role = me.profile.role;
  const items = navFor(role, t, { validations: me.pending_validations, notifications: me.unread_notifications });
  const org = me.memberships[0]?.organization;
  const isDemo = me.profile.is_demo;
  const persona = isDemo ? personaForUser(me.profile.id) : null;

  const footer = (
    <div className="text-xs text-ink-400">
      {org ? <p className="truncate font-semibold text-ink-200">{org.name}</p> : me.university ? <p className="truncate font-semibold text-ink-200">{me.university.name}</p> : null}
      <p className="mt-0.5">{t.roles[role]}{isDemo ? ` · ${t.common.demoData}` : ''}</p>
    </div>
  );

  const userLinks = [
    ...(role === 'student' ? [{ href: '/profile', label: t.nav.profile }, { href: '/my-skillpass', label: t.nav.mySkillpass }] : [{ href: '/profile', label: t.nav.profile }]),
    ...(['company', 'supervisor', 'university'].includes(role) ? [{ href: '/organization', label: t.nav.organization }] : []),
    { href: '/notifications', label: t.nav.notifications },
  ];

  return (
    <div className="min-h-dvh">
      <Sidebar items={items} footer={footer} />
      <div className="lg:pl-64">
        {isDemo && (
          <div className="no-print border-b border-gold-300/50 bg-gold-50">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
              <span className="badge-dark"><FlaskConical className="size-3.5" aria-hidden /> {t.demo.badge}</span>
              <p className="hidden flex-1 text-xs text-gold-800 md:block">{t.demo.banner}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-gold-800">{t.demo.switchPersona}:</span>
                {DEMO_PERSONA_KEYS.map((key) => (
                  <form key={key} action={switchPersona}>
                    <input type="hidden" name="persona" value={key} />
                    <input type="hidden" name="next" value="/dashboard" />
                    <button type="submit" disabled={key === persona} aria-pressed={key === persona}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${key === persona ? 'bg-ink-950 text-gold-200' : 'bg-white text-ink-800 ring-1 ring-gold-300 hover:bg-gold-100'}`}>
                      {t.roles[key]}
                    </button>
                  </form>
                ))}
                <form action={exitDemo}>
                  <button type="submit" className="rounded-full px-2.5 py-1 text-xs font-semibold text-gold-800 underline underline-offset-2">{t.demo.exit}</button>
                </form>
              </div>
            </div>
          </div>
        )}
        <header className="no-print sticky top-0 z-20 border-b border-ink-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
            <MobileNav items={items} footer={footer} />
            <form action="/challenges" method="get" role="search" className="relative hidden max-w-md flex-1 md:block">
              <label htmlFor="global-search" className="sr-only">{t.common.search}</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <input id="global-search" name="q" type="search" placeholder={t.challenges.searchPlaceholder} className="input bg-ink-50 pl-9" />
              {role !== 'student' && role !== 'university' && <input type="hidden" name="scope" value={role === 'admin' ? 'all' : 'mine'} />}
            </form>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <LocaleSwitch locale={locale} />
              <Link href="/notifications" className="relative rounded-xl p-2.5 text-ink-600 hover:bg-ink-100 hover:text-ink-950"
                aria-label={`${t.nav.notifications}${me.unread_notifications ? ` (${me.unread_notifications})` : ''}`}>
                <Bell className="size-5" aria-hidden />
                {me.unread_notifications > 0 && (
                  <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-danger-600 px-1 text-[10px] font-bold text-white">{me.unread_notifications}</span>
                )}
              </Link>
              <UserMenu name={me.profile.full_name} roleLabel={t.roles[role]} links={userLinks} />
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
      {isDemo && <GuidedDemo persona={persona} />}
    </div>
  );
}
