import type { Messages } from '@/lib/i18n';
import type { Role } from '@/lib/types';

export type NavIcon =
  | 'home' | 'target' | 'plus' | 'user' | 'badge' | 'check' | 'users' | 'building' | 'bell' | 'chart' | 'shield' | 'list' | 'award' | 'alert' | 'book' | 'briefcase';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  badge?: number;
  /** Additional path prefixes that mark the item as active */
  match?: string[];
}

export function navFor(role: Role, t: Messages, counts: { validations: number; notifications: number }): NavItem[] {
  const notifications: NavItem = { href: '/notifications', label: t.nav.notifications, icon: 'bell', badge: counts.notifications };
  switch (role) {
    case 'student':
      return [
        { href: '/dashboard', label: t.nav.dashboard, icon: 'home' },
        { href: '/challenges', label: t.nav.discover, icon: 'target', match: ['/challenges'] },
        { href: '/challenges?scope=participating', label: t.nav.myChallenges, icon: 'briefcase', match: ['/workspace'] },
        { href: '/profile', label: t.nav.profile, icon: 'user' },
        { href: '/my-skillpass', label: t.nav.mySkillpass, icon: 'award' },
        notifications,
      ];
    case 'company':
      return [
        { href: '/dashboard', label: t.nav.dashboard, icon: 'home' },
        { href: '/challenges?scope=mine', label: t.nav.myChallenges, icon: 'target', match: ['/challenges', '/workspace'] },
        { href: '/challenges/new', label: t.challenges.create, icon: 'plus' },
        { href: '/validations', label: t.nav.validations, icon: 'check', badge: counts.validations },
        { href: '/talent', label: t.nav.talent, icon: 'users' },
        { href: '/organization', label: t.nav.organization, icon: 'building' },
        notifications,
      ];
    case 'supervisor':
      return [
        { href: '/dashboard', label: t.nav.dashboard, icon: 'home' },
        { href: '/validations', label: t.nav.validations, icon: 'check', badge: counts.validations },
        { href: '/challenges?scope=mine', label: t.nav.challenges, icon: 'target', match: ['/challenges', '/workspace'] },
        { href: '/talent', label: t.nav.talent, icon: 'users' },
        { href: '/organization', label: t.nav.organization, icon: 'building' },
        { href: '/profile', label: t.nav.profile, icon: 'user' },
        notifications,
      ];
    case 'university':
      return [
        { href: '/dashboard', label: t.nav.analytics, icon: 'chart' },
        { href: '/challenges', label: t.nav.challenges, icon: 'target' },
        { href: '/organization', label: t.nav.organization, icon: 'building' },
        { href: '/profile', label: t.nav.profile, icon: 'user' },
        notifications,
      ];
    case 'admin':
      return [
        { href: '/dashboard', label: t.dashboard.admin.sections.overview, icon: 'shield' },
        { href: '/admin/users', label: t.dashboard.admin.sections.users, icon: 'users' },
        { href: '/admin/organizations', label: t.dashboard.admin.sections.organizations, icon: 'building' },
        { href: '/challenges?scope=all', label: t.dashboard.admin.sections.challenges, icon: 'target', match: ['/challenges', '/workspace'] },
        { href: '/validations', label: t.nav.validations, icon: 'check', badge: counts.validations },
        { href: '/admin/credentials', label: t.dashboard.admin.sections.credentials, icon: 'award' },
        { href: '/admin/competencies', label: t.dashboard.admin.sections.competencies, icon: 'book' },
        { href: '/admin/incidents', label: t.dashboard.admin.sections.incidents, icon: 'alert' },
        { href: '/admin/audit', label: t.dashboard.admin.sections.audit, icon: 'list' },
        { href: '/talent', label: t.nav.talent, icon: 'users' },
      ];
  }
}
