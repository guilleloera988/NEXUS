'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Award, Bell, BookOpen, Briefcase, Building2, ChartColumn, CheckCircle2, ChevronDown, Home, List, LogOut, Menu,
  Plus, Shield, Target, User, Users, X,
} from 'lucide-react';
import { logout } from '@/actions/auth';
import { BrandLink } from '@/components/ui/brand';
import { Avatar } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n/client';
import type { NavIcon, NavItem } from './nav';

const ICONS: Record<NavIcon, typeof Home> = {
  home: Home, target: Target, plus: Plus, user: User, badge: Award, check: CheckCircle2, users: Users, building: Building2, bell: Bell,
  chart: ChartColumn, shield: Shield, list: List, award: Award, alert: AlertTriangle, book: BookOpen, briefcase: Briefcase,
};

/** Picks the single most specific nav item for the current URL. */
function useActiveHref(items: NavItem[]) {
  const pathname = usePathname();
  const search = useSearchParams();
  let best: { href: string; score: number } = { href: '', score: 0 };
  for (const item of items) {
    const [path, query] = item.href.split('?');
    let score = 0;
    if (query) {
      const [key, value] = query.split('=');
      if (pathname === path && search.get(key) === value) score = 300 + path.length;
      else if ((item.match ?? []).some((m) => pathname.startsWith(m) && m !== path)) score = 40 + path.length;
    } else if (pathname === path) score = 200 + path.length;
    else if (path !== '/dashboard' && pathname.startsWith(`${path}/`)) score = 100 + path.length;
    else if ((item.match ?? []).some((m) => pathname.startsWith(m))) score = 20;
    if (score > best.score) best = { href: item.href, score };
  }
  return best.href;
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const activeHref = useActiveHref(items);
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.href === activeHref;
        return (
          <li key={item.href}>
            <Link href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active
                ? 'bg-gradient-to-r from-gold-300 to-gold-500 text-ink-950 shadow-[0_8px_20px_-12px_rgba(226,177,59,0.9)]'
                : 'text-ink-300 hover:bg-white/5 hover:text-white'}`}>
              <Icon className="size-[18px] shrink-0" aria-hidden />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge ? <span className={`rounded-full px-2 text-[11px] font-bold ${active ? 'bg-ink-950 text-gold-300' : 'bg-gold-500 text-ink-950'}`}>{item.badge}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar({ items, footer }: { items: NavItem[]; footer: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink-950 lg:flex">
      <div className="grid-bg flex h-16 items-center px-5"><BrandLink tone="light" href="/dashboard" /></div>
      <nav aria-label={t.nav.mainNav} className="flex-1 overflow-y-auto px-3 py-4"><NavList items={items} /></nav>
      <div className="border-t border-white/10 p-4">{footer}</div>
    </aside>
  );
}

export function MobileNav({ items, footer }: { items: NavItem[]; footer: React.ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) { setLastPath(pathname); setOpen(false); }
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost px-2.5" aria-label={t.nav.openMenu} aria-expanded={open} aria-controls="mobile-nav">
        <Menu className="size-5" aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t.nav.mainNav}>
          <button type="button" className="absolute inset-0 bg-ink-950/60" aria-label={t.nav.closeMenu} onClick={() => setOpen(false)} />
          <div id="mobile-nav" className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-ink-950 shadow-2xl">
            <div className="flex h-16 items-center justify-between px-4">
              <BrandLink tone="light" href="/dashboard" compact />
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-ink-300 hover:bg-white/10" aria-label={t.nav.closeMenu}><X className="size-5" aria-hidden /></button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-2"><NavList items={items} onNavigate={() => setOpen(false)} /></nav>
            <div className="border-t border-white/10 p-4">{footer}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function UserMenu({ name, roleLabel, links }: { name: string; roleLabel: string; links: { href: string; label: string }[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" aria-label={t.nav.userMenu}
        className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 hover:bg-ink-100">
        <Avatar name={name} size="sm" />
        <span className="hidden text-left sm:block">
          <span className="block max-w-40 truncate text-sm font-bold text-ink-950">{name}</span>
          <span className="block text-xs text-ink-500">{roleLabel}</span>
        </span>
        <ChevronDown className="hidden size-4 text-ink-500 sm:block" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-xl">
          {links.map((l) => (
            <Link key={l.href} role="menuitem" href={l.href} onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-ink-800 hover:bg-ink-50">{l.label}</Link>
          ))}
          <form action={logout} className="border-t border-ink-100">
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-danger-700 hover:bg-danger-50">
              <LogOut className="size-4" aria-hidden /> {t.nav.signOut}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
