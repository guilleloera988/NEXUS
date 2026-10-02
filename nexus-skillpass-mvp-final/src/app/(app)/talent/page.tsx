import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BadgeCheck, Lock, Users } from 'lucide-react';
import { Alert, Avatar, Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { AVAILABILITY } from '@/lib/constants';
import { competencyName, formatHours } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/server';
import { getMe, read } from '@/lib/server/backend';
import type { Competency, Lookups } from '@/lib/types';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.talent.title };
}

interface TalentItem {
  id: string; full_name: string; headline: string; career: string; semester: number | null; availability: string; hours_per_week: number | null; is_demo: boolean;
  university: string | null; verified_vath: number; credentials: number;
  verified_competencies: { id: string; slug: string; name_es: string; name_en: string; level: number }[]; declared_skills: Competency[];
}

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

export default async function TalentPage({ searchParams }: PageProps<'/talent'>) {
  const me = await getMe();
  if (!me) redirect('/login');
  const { t, locale } = await getMessages();
  const T = t.talent;
  const sp = await searchParams;
  const filters = {
    q: one(sp.q).slice(0, 100), competency_id: /^[0-9a-f-]{36}$/i.test(one(sp.competency_id)) ? one(sp.competency_id) : '',
    verified_only: one(sp.verified_only) === 'on', min_vath: /^\d{1,4}$/.test(one(sp.min_vath)) ? one(sp.min_vath) : '',
    career: one(sp.career).slice(0, 80), university_id: /^[0-9a-f-]{36}$/i.test(one(sp.university_id)) ? one(sp.university_id) : '',
    availability: (AVAILABILITY as readonly string[]).includes(one(sp.availability)) ? one(sp.availability) : '', sort: one(sp.sort) === 'vath' ? 'vath' : 'name',
  };
  const [result, lookups] = await Promise.all([read<{ allowed: boolean; items: TalentItem[] }>('sp_talent', filters), read<Lookups>('sp_lookups')]);

  return (
    <>
      <PageHeader title={T.title} subtitle={T.subtitle} />
      {!result.allowed ? <EmptyState icon={<Lock className="size-6" />} title={T.notAllowed} /> : (
        <>
          <form method="get" className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" role="search">
            <div className="lg:col-span-2"><label htmlFor="t-q" className="label">{t.common.search}</label><input id="t-q" name="q" type="search" defaultValue={filters.q} placeholder={T.search} className="input" /></div>
            <div><label htmlFor="t-comp" className="label">{t.challenges.competency}</label>
              <select id="t-comp" name="competency_id" defaultValue={filters.competency_id} className="select"><option value="">{t.challenges.anyCompetency}</option>
                {lookups.competencies.map((c) => <option key={c.id} value={c.id}>{competencyName(locale, c)}</option>)}</select></div>
            <div><label htmlFor="t-min" className="label">{T.minVath}</label><input id="t-min" name="min_vath" type="number" min={0} max={9999} defaultValue={filters.min_vath} className="input" /></div>
            <div><label htmlFor="t-career" className="label">{T.career}</label><input id="t-career" name="career" defaultValue={filters.career} className="input" /></div>
            <div><label htmlFor="t-uni" className="label">{T.university}</label>
              <select id="t-uni" name="university_id" defaultValue={filters.university_id} className="select"><option value="">{T.anyUniversity}</option>
                {lookups.universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            <div><label htmlFor="t-av" className="label">{T.availability}</label>
              <select id="t-av" name="availability" defaultValue={filters.availability} className="select"><option value="">{T.anyAvailability}</option>
                {AVAILABILITY.map((a) => <option key={a} value={a}>{t.enums.availability[a]}</option>)}</select></div>
            <div><label htmlFor="t-sort" className="label">{T.sort}</label>
              <select id="t-sort" name="sort" defaultValue={filters.sort} className="select"><option value="name">{T.sortName}</option><option value="vath">{T.sortVath}</option></select></div>
            <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" name="verified_only" defaultChecked={filters.verified_only} className="checkbox" /> {T.verifiedOnly}</label>
            <div className="flex gap-2 sm:col-span-2 sm:justify-end"><button type="submit" className="btn-dark">{t.common.filter}</button><Link href="/talent" className="btn-ghost">{t.common.clear}</Link></div>
          </form>
          <Alert tone="info" className="mb-5">{T.rankingNote}</Alert>
          {result.items.length === 0 ? <EmptyState icon={<Users className="size-6" />} title={T.empty} /> : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.items.map((s) => (
                <li key={s.id} className="card flex flex-col p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={s.full_name} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{s.full_name}</p>
                      <p className="text-xs text-ink-500">{[s.career, s.university].filter(Boolean).join(' · ')}</p>
                      <p className="text-xs text-ink-500">{t.enums.availability[s.availability as keyof typeof t.enums.availability]}{s.hours_per_week ? ` · ${s.hours_per_week} h/sem` : ''}</p>
                    </div>
                    {s.is_demo && <Badge tone="gold">DEMO</Badge>}
                  </div>
                  <div className="mt-3 flex gap-2 text-sm">
                    <Badge tone="success"><BadgeCheck className="size-3.5" aria-hidden />{formatHours(locale, s.verified_vath)} VATH</Badge>
                    <Badge tone="dark">{fmt(T.credentials, { n: s.credentials })}</Badge>
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-500">{T.verified}</p>
                  <div className="mt-1 flex flex-wrap gap-1">{s.verified_competencies.length ? s.verified_competencies.map((c) => <Badge key={c.slug} tone="success">{competencyName(locale, c)} · {c.level}</Badge>) : <span className="text-xs text-ink-400">—</span>}</div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-500">{T.declared}</p>
                  <div className="mt-1 flex flex-wrap gap-1">{s.declared_skills.slice(0, 6).map((c) => <Badge key={c.id} tone="neutral">{competencyName(locale, c)}</Badge>)}</div>
                  <Link href={`/talent/${s.id}`} className="btn-outline btn-sm mt-auto self-start pt-2">{T.viewProfile}</Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
