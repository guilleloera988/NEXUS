import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BrandLink } from '@/components/ui/brand';
import { LocaleSwitch } from '@/components/shell/locale-switch';
import { getMessages } from '@/lib/i18n/server';
import { getMe, read } from '@/lib/server/backend';
import type { Lookups, SkillPassMe } from '@/lib/types';
import { OnboardingForm } from './onboarding-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.onboarding.title };
}

export default async function OnboardingPage() {
  const me = await getMe();
  if (!me) redirect('/login?next=/onboarding');
  if (me.profile.onboarding_completed) redirect('/dashboard');
  const { t, locale } = await getMessages();
  const lookups = await read<Lookups>('sp_lookups');
  const declared = me.profile.role === 'student'
    ? ((await read<SkillPassMe | null>('sp_skillpass_me'))?.declared_skills ?? []).map((c) => c.id)
    : [];
  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <BrandLink />
          <LocaleSwitch locale={locale} />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <p className="kicker">{t.roles[me.profile.role]}</p>
        <h1 className="mt-2 text-3xl font-extrabold">{t.onboarding.title}</h1>
        <p className="mt-1 text-ink-500">{t.onboarding.subtitle}</p>
        <div className="card card-pad mt-6">
          <OnboardingForm profile={me.profile} lookups={lookups} declared={declared} needsOrganization={me.memberships.length === 0} />
        </div>
      </main>
    </div>
  );
}
