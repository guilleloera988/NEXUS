import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Award, BadgeCheck, Clock, FlaskConical, ShieldCheck, UserRoundSearch, Users } from 'lucide-react';
import { PublicDemoGuide } from '@/components/public-demo-guide';
import { QrCode } from '@/components/qr-code';
import { PublicFooter, PublicHeader } from '@/components/shell/public-chrome';
import { BrandMark } from '@/components/ui/brand';
import { CopyButton, PrintButton } from '@/components/ui/interactive';
import { Avatar, Badge } from '@/components/ui/primitives';
import { competencyName, formatDate, formatHours } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/server';
import { publicRead } from '@/lib/server/backend';
import { isUuid } from '@/lib/server/demo-session';
import { publicUrl } from '@/lib/server/urls';
import type { PublicSkillPass } from '@/lib/types';

const SLUG = /^[a-z0-9][a-z0-9-]{2,90}$/;

async function load(slug: string, demo: string | null) {
  if (!SLUG.test(slug)) return null;
  return publicRead<PublicSkillPass>('sp_public_skillpass', { slug }, demo);
}

export async function generateMetadata({ params, searchParams }: PageProps<'/skillpass/[slug]'>): Promise<Metadata> {
  const { t } = await getMessages();
  const { slug } = await params;
  const demo = (await searchParams).demo;
  const data = await load(slug, typeof demo === 'string' && isUuid(demo) ? demo : null).catch(() => null);
  if (!data) return { title: t.publicPages.skillpassNotFound, robots: { index: false } };
  return {
    title: `${data.profile.full_name} · SkillPass`,
    description: `${data.profile.headline} · ${data.summary.verified_vath} VATH · ${data.summary.verified_projects} ${t.publicPages.verifiedProjects}`,
    robots: { index: !data.profile.is_demo, follow: false },
  };
}

export default async function PublicSkillPassPage({ params, searchParams }: PageProps<'/skillpass/[slug]'>) {
  const { slug } = await params;
  const demoParam = (await searchParams).demo;
  const demo = typeof demoParam === 'string' && isUuid(demoParam) ? demoParam : null;
  if (!SLUG.test(slug)) notFound();
  const { t, locale } = await getMessages();
  const P = t.publicPages;
  const data = await load(slug, demo);
  const url = await publicUrl(`/skillpass/${slug}`, demo);
  const suffix = demo ? `?demo=${demo}` : '';

  if (!data) {
    return (
      <>
        <PublicHeader />
        <main id="main" className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-4 py-16 text-center">
          <div>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-ink-100 text-ink-600"><UserRoundSearch className="size-7" aria-hidden /></span>
            <h1 className="mt-4 text-2xl font-extrabold">{P.skillpassNotFound}</h1>
            <p className="mt-2 text-ink-500">{P.skillpassNotFoundText}</p>
            <Link href="/verify" className="btn-primary mt-6">{P.enterCode}</Link>
          </div>
        </main>
        <PublicFooter />
      </>
    );
  }
  const p = data.profile;
  return (
    <>
      <PublicHeader />
      <main id="main">
        {p.is_demo && <p className="flex items-center justify-center gap-2 bg-gold-50 px-4 py-2 text-sm font-semibold text-gold-800"><FlaskConical className="size-4" aria-hidden /> {P.demoNotice}</p>}
        <section className="relative overflow-hidden bg-ink-950 text-white">
          <div className="grid-bg absolute inset-0 opacity-50" aria-hidden />
          <div className="absolute -right-32 -top-32 size-96 rounded-full bg-gold-500/20 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] md:py-14">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-gold-300"><BrandMark size={28} /> {P.verifiedExperience}</div>
              <div className="mt-5 flex items-center gap-4">
                <Avatar name={p.full_name} size="xl" />
                <div className="min-w-0">
                  <h1 className="text-3xl font-extrabold text-white sm:text-4xl">{p.full_name}</h1>
                  {p.headline && <p className="mt-1 text-ink-300">{p.headline}</p>}
                  <p className="mt-1 text-sm text-ink-400">{[p.career, p.university].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
              <dl className="mt-8 grid max-w-xl grid-cols-3 gap-3">
                <div className="rounded-2xl bg-white/5 p-4"><dt className="text-xs text-ink-400"><Clock className="mb-1 size-4 text-gold-300" aria-hidden />{t.skillpass.verifiedHours}</dt><dd className="text-2xl font-extrabold text-gold-300">{formatHours(locale, data.summary.verified_vath)}</dd></div>
                <div className="rounded-2xl bg-white/5 p-4"><dt className="text-xs text-ink-400"><Award className="mb-1 size-4 text-gold-300" aria-hidden />{t.skillpass.verifiedProjects}</dt><dd className="text-2xl font-extrabold text-gold-300">{data.summary.verified_projects}</dd></div>
                <div className="rounded-2xl bg-white/5 p-4"><dt className="text-xs text-ink-400"><Users className="mb-1 size-4 text-gold-300" aria-hidden />{t.skillpass.validators}</dt><dd className="text-2xl font-extrabold text-gold-300">{data.summary.validators}</dd></div>
              </dl>
            </div>
            <div className="flex flex-col items-center gap-3">
              <QrCode value={url} size={168} label={fmt(t.skillpass.qrAlt, { url })} />
              <div className="no-print flex gap-2">
                <CopyButton value={url} label={t.skillpass.copyLink} className="btn btn-sm border border-white/20 text-white hover:bg-white/10" />
                <PrintButton label={t.skillpass.print} className="btn-primary btn-sm" />
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-3">
          <section className="card card-pad lg:col-span-2" aria-labelledby="projects">
            <h2 id="projects" className="text-lg font-bold">{P.verifiedProjects}</h2>
            {data.credentials.length === 0 ? <p className="mt-3 text-sm text-ink-500">—</p> : (
              <ul className="mt-4 space-y-4">
                {data.credentials.map((c) => (
                  <li key={c.code} className="rounded-2xl border border-ink-200 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-bold">{c.confidential ? t.skillpass.confidentialProject : c.challenge_title}</p>
                        <p className="text-sm text-ink-500">{c.confidential ? '' : c.organization_name}{c.start_date ? ` · ${formatDate(locale, c.start_date)} – ${formatDate(locale, c.end_date)}` : ''}</p>
                      </div>
                      <Badge tone="success"><ShieldCheck className="size-3.5" aria-hidden />{formatHours(locale, c.verified_hours)} VATH</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.competencies.map((k) => <Badge key={k.slug} tone="neutral"><BadgeCheck className="size-3 text-success-600" aria-hidden />{competencyName(locale, k)} · {k.level}</Badge>)}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
                      <span>{t.skillpass.validatedBy}: <span className="font-semibold text-ink-800">{c.supervisor_name ?? t.skillpass.confidentialValidator}</span>{c.supervisor_title ? ` · ${c.supervisor_title}` : ''}</span>
                      <Link href={`/verify/${c.code}${suffix}`} className="link font-mono">{c.code} →</Link>
                    </div>
                    {c.public_evidence.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {c.public_evidence.map((e) => (
                          <li key={e.id}><a className="btn-outline btn-sm" target="_blank" rel="noopener noreferrer nofollow" href={e.has_file ? `/api/public/evidence/${e.id}${suffix}` : e.url ?? '#'}>{e.title}</a></li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="space-y-6">
            <section className="card card-pad" aria-labelledby="competencies">
              <h2 id="competencies" className="text-lg font-bold">{P.verifiedCompetencies}</h2>
              <ul className="mt-3 space-y-2.5">
                {data.competencies.map((k) => (
                  <li key={k.slug}>
                    <div className="flex items-center justify-between text-sm"><span className="font-semibold">{competencyName(locale, k)}</span><span className="text-xs text-ink-500">{t.rubric.level} {k.level}/5</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-ink-100" aria-hidden><div className="h-full rounded-full bg-gold-500" style={{ width: `${(k.level / 5) * 100}%` }} /></div>
                  </li>
                ))}
                {data.competencies.length === 0 && <li className="text-sm text-ink-500">—</li>}
              </ul>
              <p className="mt-3 text-xs text-ink-500">{t.rubric.verifiedRule}</p>
            </section>
            {p.bio && (
              <section className="card card-pad">
                <h2 className="text-lg font-bold">{P.aboutSelfDeclared}</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{p.bio}</p>
              </section>
            )}
            <p className="text-xs text-ink-500">{fmt(P.member, { date: formatDate(locale, p.member_since) })}. {P.notOfficial}</p>
          </div>
        </div>
      </main>
      <PublicFooter />
      <PublicDemoGuide />
    </>
  );
}
