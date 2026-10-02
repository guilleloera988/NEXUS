import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Award, BadgeCheck, Briefcase, CalendarDays, Clock, GraduationCap, MapPin, Pencil, Sparkles } from 'lucide-react';
import { StaffProfileForm, StudentProfileForm } from '@/components/profile-client';
import { BrandMark } from '@/components/ui/brand';
import { Avatar, Badge, Card, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { competencyName, formatHours } from '@/lib/format';
import { getMessages } from '@/lib/i18n/server';
import { getMe, read } from '@/lib/server/backend';
import type { Lookups, SkillPassMe } from '@/lib/types';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.nav.profile };
}

interface TalentProfile {
  assignments: { challenge_id: string; title: string; status: string; organization_name: string }[];
}

export default async function ProfilePage({ searchParams }: PageProps<'/profile'>) {
  const me = await getMe();
  if (!me) redirect('/login');
  const { t, locale } = await getMessages();
  const P = t.profile;
  const editing = (await searchParams).edit === '1';

  if (me.profile.role !== 'student') {
    return (
      <>
        <PageHeader kicker={t.roles[me.profile.role]} title={P.staffTitle} />
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title={P.editTitle} className="lg:col-span-2"><StaffProfileForm profile={me.profile} /></Card>
          <Card title={t.nav.organization}>
            {me.memberships.length === 0 ? <p className="text-sm text-ink-500">{t.organization.none}</p> : (
              <ul className="space-y-2">
                {me.memberships.map((m) => (
                  <li key={m.organization_id} className="text-sm">
                    <p className="font-semibold">{m.organization.name}</p>
                    <p className="text-xs text-ink-500">{t.enums.memberRole[m.member_role as keyof typeof t.enums.memberRole]} · {t.status.organization[m.organization.verification_status]}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </>
    );
  }

  const [pass, talent, lookups] = await Promise.all([
    read<SkillPassMe>('sp_skillpass_me'),
    read<TalentProfile>('sp_talent_profile', { student_id: me.profile.id }),
    editing ? read<Lookups>('sp_lookups') : Promise.resolve(null),
  ]);
  const p = pass.profile;
  const verifiedIds = new Set(pass.verified_competencies.map((c) => c.id));

  if (editing && lookups) {
    return (
      <>
        <PageHeader kicker={t.nav.profile} title={P.editTitle} actions={<Link href="/profile" className="btn-outline">{t.common.cancel}</Link>} />
        <div className="card card-pad"><StudentProfileForm profile={p} lookups={lookups} declared={pass.declared_skills.map((c) => c.id)} /></div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={P.title} subtitle={P.subtitle} actions={<Link href="/profile?edit=1" className="btn-dark"><Pencil className="size-4" aria-hidden /> {P.edit}</Link>} />
      <section className="card mb-6 grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={p.full_name} size="xl" />
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-2xl font-extrabold">{p.full_name}{pass.totals.verified_projects > 0 && <BadgeCheck className="size-6 text-gold-600" aria-label={P.verifiedBadge} />}</h2>
            {p.headline && <p className="text-ink-600">{p.headline}</p>}
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
              {p.career && <div className="flex items-center gap-1.5"><GraduationCap className="size-4 text-ink-400" aria-hidden /><dt className="sr-only">{t.onboarding.student.career}</dt><dd>{p.career}</dd></div>}
              {p.university && <div className="flex items-center gap-1.5"><Briefcase className="size-4 text-ink-400" aria-hidden /><dt className="sr-only">{t.onboarding.student.university}</dt><dd>{p.university}</dd></div>}
              {p.semester && <div className="flex items-center gap-1.5"><CalendarDays className="size-4 text-ink-400" aria-hidden /><dt className="sr-only">{t.onboarding.student.semester}</dt><dd>{t.onboarding.student.semester} {p.semester}</dd></div>}
              {p.location && <div className="flex items-center gap-1.5"><MapPin className="size-4 text-ink-400" aria-hidden /><dt className="sr-only">{t.onboarding.student.location}</dt><dd>{p.location}</dd></div>}
            </dl>
            {p.bio && <p className="mt-3 max-w-2xl text-sm italic text-ink-600">“{p.bio}”</p>}
          </div>
        </div>
        <Link href="/my-skillpass" className="relative block overflow-hidden rounded-2xl bg-gradient-to-br from-ink-800 to-ink-950 p-5 text-white gold-ring">
          <div className="flex items-center gap-2"><BrandMark size={34} /><span className="text-sm font-extrabold tracking-wide">SKILL<span className="gold-text">PASS</span></span></div>
          <p className="mt-4 font-bold">{p.full_name}</p>
          <p className="text-xs text-ink-400">{[p.career, p.university].filter(Boolean).join(' · ')}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xl font-extrabold text-gold-300">{formatHours(locale, pass.totals.credentialed_vath)}</p><p className="text-[10px] text-ink-400">VATH</p></div>
            <div><p className="text-xl font-extrabold text-gold-300">{pass.totals.verified_projects}</p><p className="text-[10px] text-ink-400">{t.skillpass.verifiedProjects}</p></div>
            <div><p className="text-xl font-extrabold text-gold-300">{pass.totals.verified_competencies}</p><p className="text-[10px] text-ink-400">{t.skillpass.verifiedCompetencies}</p></div>
          </div>
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><BadgeCheck className="size-5 text-success-600" aria-hidden />{P.verifiedSkills}</span>}>
          <p className="mb-3 text-xs text-ink-500">{P.verifiedExplain}</p>
          {pass.verified_competencies.length === 0 ? <p className="text-sm text-ink-500">{P.noVerified}</p> : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {pass.verified_competencies.map((c) => (
                <li key={c.id} className="rounded-xl border border-success-600/25 bg-success-50/60 px-3 py-2">
                  <p className="text-sm font-bold">{competencyName(locale, c)}</p>
                  <p className="text-xs text-success-700">{P.verifiedBadge} · {t.rubric.level} {c.level} · {t.rubric.levels[c.level as 1 | 2 | 3 | 4 | 5].label}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2"><Sparkles className="size-5 text-ink-400" aria-hidden />{P.declaredSkills}</span>}>
          <p className="mb-3 text-xs text-ink-500">{P.declaredExplain}</p>
          <div className="flex flex-wrap gap-2">
            {pass.declared_skills.map((c) => (
              <Badge key={c.id} tone="neutral">{competencyName(locale, c)} · {verifiedIds.has(c.id) ? P.verifiedBadge : P.declaredBadge}</Badge>
            ))}
            {pass.declared_skills.length === 0 && <p className="text-sm text-ink-500">—</p>}
          </div>
          <h3 className="mb-2 mt-5 text-sm font-bold">{P.interests}</h3>
          <div className="flex flex-wrap gap-2">{p.interests.map((i) => <Badge key={i} tone="gold">{t.enums.interests[i as keyof typeof t.enums.interests] ?? i}</Badge>)}</div>
        </Card>
        <Card title={P.challenges}>
          {talent.assignments.length === 0 ? <p className="text-sm text-ink-500">{t.dashboard.student.noChallenges}</p> : (
            <ul className="space-y-3">
              {talent.assignments.map((a) => (
                <li key={a.challenge_id} className="flex items-center justify-between gap-2">
                  <Link href={`/workspace/${a.challenge_id}`} className="min-w-0 hover:underline"><p className="truncate text-sm font-semibold">{a.title}</p><p className="text-xs text-ink-500">{a.organization_name}</p></Link>
                  <StatusBadge status={a.status} label={t.status.assignment[a.status as keyof typeof t.status.assignment]} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="VATH · SkillPass">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-ink-50 p-4"><Clock className="size-5 text-gold-600" aria-hidden /><p className="mt-1 text-2xl font-extrabold">{formatHours(locale, pass.totals.verified_vath)}</p><p className="text-xs text-ink-500">{t.skillpass.totals.verified}</p></div>
            <div className="rounded-xl bg-ink-50 p-4"><Award className="size-5 text-gold-600" aria-hidden /><p className="mt-1 text-2xl font-extrabold">{pass.credentials.filter((c) => c.status === 'active').length}</p><p className="text-xs text-ink-500">{t.dashboard.student.credentials}</p></div>
          </div>
          <Link href="/my-skillpass" className="btn-primary mt-4 w-full">{t.dashboard.student.openSkillpass}</Link>
        </Card>
      </div>
    </>
  );
}
