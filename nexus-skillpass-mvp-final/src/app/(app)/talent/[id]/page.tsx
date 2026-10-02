import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, BadgeCheck, ShieldCheck } from 'lucide-react';
import { InviteToChallengeForm } from '@/components/profile-client';
import { Avatar, Badge, Card, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { competencyName, formatDate, formatHours } from '@/lib/format';
import { getMessages } from '@/lib/i18n/server';
import { getMe, read } from '@/lib/server/backend';
import type { Competency, PublicCredential } from '@/lib/types';

interface Talent {
  profile: { id: string; full_name: string; headline: string; bio: string; career: string; semester: number | null; location: string; interests: string[]; availability: string; hours_per_week: number | null; slug: string; skillpass_public: boolean; is_demo: boolean; university: string | null };
  declared_skills: Competency[];
  credentials: PublicCredential[];
  assignments: { challenge_id: string; title: string; status: string; organization_name: string }[];
  can_invite: boolean;
  invitable_challenges: { id: string; title: string }[];
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.talent.profileTitle };
}

export default async function TalentProfilePage({ params }: PageProps<'/talent/[id]'>) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await getMe();
  if (!me) redirect('/login');
  const data = await read<Talent | null>('sp_talent_profile', { student_id: id });
  if (!data) notFound();
  const { t, locale } = await getMessages();
  const p = data.profile;
  const verified = new Map<string, { slug: string; name_es: string; name_en: string; level: number }>();
  for (const c of data.credentials) for (const k of c.competencies) if ((verified.get(k.slug)?.level ?? 0) < k.level) verified.set(k.slug, k);
  const totalVath = data.credentials.reduce((a, c) => a + Number(c.verified_hours), 0);
  return (
    <>
      <Link href="/talent" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-950"><ArrowLeft className="size-4" aria-hidden /> {t.talent.title}</Link>
      <PageHeader kicker={t.talent.profileTitle} title={p.full_name} subtitle={[p.headline, p.career, p.university].filter(Boolean).join(' · ')} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={p.full_name} size="lg" />
              <div className="flex-1">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="success"><BadgeCheck className="size-3.5" aria-hidden />{formatHours(locale, totalVath)} VATH</Badge>
                  <Badge tone="dark">{data.credentials.length} {t.dashboard.student.credentials.toLowerCase()}</Badge>
                  <Badge tone="neutral">{t.enums.availability[p.availability as keyof typeof t.enums.availability]}</Badge>
                  {p.is_demo && <Badge tone="gold">DEMO</Badge>}
                </div>
                {p.bio && <p className="mt-3 text-sm text-ink-700"><span className="text-xs font-semibold uppercase text-ink-500">{t.publicPages.aboutSelfDeclared}:</span> {p.bio}</p>}
              </div>
            </div>
          </Card>
          <Card title={t.publicPages.verifiedProjects}>
            {data.credentials.length === 0 ? <p className="text-sm text-ink-500">—</p> : (
              <ul className="space-y-3">
                {data.credentials.map((c) => (
                  <li key={c.code} className="rounded-xl border border-ink-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="font-bold">{c.confidential ? t.skillpass.confidentialProject : c.challenge_title}</p><p className="text-xs text-ink-500">{c.organization_name} · {formatDate(locale, c.issued_at)}</p></div>
                      <Badge tone="success"><ShieldCheck className="size-3.5" aria-hidden />{formatHours(locale, c.verified_hours)} h</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">{c.competencies.map((k) => <Badge key={k.slug}>{competencyName(locale, k)} · {k.level}</Badge>)}</div>
                    <p className="mt-2 text-xs text-ink-500">{t.skillpass.validatedBy}: {c.supervisor_name} · <span className="font-mono">{c.code}</span></p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          {data.can_invite && data.invitable_challenges.length > 0 && (
            <Card title={t.talent.invite}><InviteToChallengeForm studentId={p.id} challenges={data.invitable_challenges} /></Card>
          )}
          <Card title={t.profile.verifiedSkills}>
            <div className="flex flex-wrap gap-1.5">{[...verified.values()].map((k) => <Badge key={k.slug} tone="success">{competencyName(locale, k)} · {k.level}</Badge>)}{verified.size === 0 && <span className="text-sm text-ink-500">—</span>}</div>
          </Card>
          <Card title={t.profile.declaredSkills}>
            <p className="mb-2 text-xs text-ink-500">{t.profile.declaredExplain}</p>
            <div className="flex flex-wrap gap-1.5">{data.declared_skills.map((k) => <Badge key={k.id} tone="neutral">{competencyName(locale, k)}</Badge>)}</div>
          </Card>
          <Card title={t.profile.challenges}>
            <ul className="space-y-2">
              {data.assignments.map((a) => (
                <li key={a.challenge_id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{a.title}</span><StatusBadge status={a.status} label={t.status.assignment[a.status as keyof typeof t.status.assignment]} /></li>
              ))}
              {data.assignments.length === 0 && <li className="text-sm text-ink-500">—</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
