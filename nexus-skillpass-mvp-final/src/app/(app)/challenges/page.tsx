import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, SearchX } from 'lucide-react';
import { ChallengeCardView } from '@/components/challenge-card';
import { EmptyState, LinkTabs, PageHeader } from '@/components/ui/primitives';
import { CHALLENGE_STATUSES, INDUSTRIES, MODALITIES } from '@/lib/constants';
import { competencyName } from '@/lib/format';
import { getMessages } from '@/lib/i18n/server';
import { getMe, read } from '@/lib/server/backend';
import type { ChallengeCard, Lookups } from '@/lib/types';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.nav.challenges };
}

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

export default async function ChallengesPage({ searchParams }: PageProps<'/challenges'>) {
  const me = await getMe();
  if (!me) redirect('/login');
  const { t, locale } = await getMessages();
  const params = await searchParams;
  const role = me.profile.role;
  const defaultScope = role === 'company' || role === 'supervisor' ? 'mine' : role === 'admin' ? 'all' : 'discover';
  const requested = one(params.scope);
  const allowed = role === 'student' ? ['discover', 'participating'] : role === 'admin' ? ['all', 'discover'] : role === 'university' ? ['discover'] : ['mine', 'discover'];
  const scope = allowed.includes(requested) ? requested : defaultScope;
  const filters = {
    q: one(params.q).slice(0, 100), industry: one(params.industry), modality: one(params.modality),
    competency_id: /^[0-9a-f-]{36}$/i.test(one(params.competency_id)) ? one(params.competency_id) : '',
    status: (CHALLENGE_STATUSES as readonly string[]).includes(one(params.status)) ? one(params.status) : '',
  };
  const [list, lookups] = await Promise.all([
    read<{ items: ChallengeCard[] }>('sp_challenges', { scope, ...filters }),
    read<Lookups>('sp_lookups'),
  ]);
  const titles: Record<string, [string, string]> = {
    discover: [t.challenges.discoverTitle, t.challenges.discoverSubtitle],
    participating: [t.challenges.participatingTitle, t.challenges.discoverSubtitle],
    mine: [t.challenges.mineTitle, t.challenges.mineSubtitle],
    all: [t.dashboard.admin.sections.challenges, t.dashboard.admin.subtitle],
  };
  const canCreate = role === 'company';
  const hasFilters = Object.values(filters).some(Boolean);
  const tabs = allowed.length > 1 ? allowed.map((key) => ({
    key, href: `/challenges?scope=${key}`,
    label: key === 'discover' ? t.nav.discover : key === 'participating' ? t.nav.myChallenges : key === 'mine' ? t.nav.myChallenges : t.common.all,
  })) : null;

  return (
    <>
      <PageHeader title={titles[scope][0]} subtitle={titles[scope][1]}
        actions={canCreate ? <Link href="/challenges/new" className="btn-primary"><Plus className="size-4" aria-hidden /> {t.challenges.create}</Link> : undefined} />
      {tabs && <LinkTabs tabs={tabs} active={scope} label={t.nav.challenges} />}

      <form method="get" className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]" role="search">
        <input type="hidden" name="scope" value={scope} />
        <div>
          <label htmlFor="f-q" className="sr-only">{t.common.search}</label>
          <input id="f-q" name="q" type="search" defaultValue={filters.q} placeholder={t.challenges.searchPlaceholder} className="input" />
        </div>
        <div>
          <label htmlFor="f-industry" className="sr-only">{t.challenges.industry}</label>
          <select id="f-industry" name="industry" defaultValue={filters.industry} className="select">
            <option value="">{t.challenges.anyIndustry}</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{t.enums.industries[i]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-modality" className="sr-only">{t.challenges.modality}</label>
          <select id="f-modality" name="modality" defaultValue={filters.modality} className="select">
            <option value="">{t.challenges.anyModality}</option>
            {MODALITIES.map((m) => <option key={m} value={m}>{t.enums.modality[m]}</option>)}
          </select>
        </div>
        {scope === 'mine' || scope === 'all' ? (
          <div>
            <label htmlFor="f-status" className="sr-only">{t.challenges.statusFilter}</label>
            <select id="f-status" name="status" defaultValue={filters.status} className="select">
              <option value="">{t.challenges.anyStatus}</option>
              {CHALLENGE_STATUSES.map((s) => <option key={s} value={s}>{t.status.challenge[s]}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="f-comp" className="sr-only">{t.challenges.competency}</label>
            <select id="f-comp" name="competency_id" defaultValue={filters.competency_id} className="select">
              <option value="">{t.challenges.anyCompetency}</option>
              {lookups.competencies.map((c) => <option key={c.id} value={c.id}>{competencyName(locale, c)}</option>)}
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn-dark flex-1">{t.common.filter}</button>
          {hasFilters && <Link href={`/challenges?scope=${scope}`} className="btn-ghost">{t.common.clear}</Link>}
        </div>
      </form>

      {list.items.length === 0 ? (
        <EmptyState icon={<SearchX className="size-6" />} title={t.challenges.noResults} text={hasFilters ? t.challenges.noResultsText : undefined}
          action={canCreate && !hasFilters ? <Link href="/challenges/new" className="btn-primary btn-sm">{t.challenges.create}</Link> : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.items.map((c) => <ChallengeCardView key={c.id} c={c} t={t} locale={locale} showMatch={role === 'student'} />)}
        </div>
      )}
    </>
  );
}
