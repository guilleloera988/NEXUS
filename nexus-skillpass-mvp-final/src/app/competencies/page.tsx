import type { Metadata } from 'next';
import { BadgeCheck, Clock, ShieldCheck } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/shell/public-chrome';
import { SEED_COMPETENCIES, type PublicCompetency } from '@/lib/competency-catalog';
import { getMessages } from '@/lib/i18n/server';
import type { CompetencyCategory } from '@/lib/types';
import { publicRead } from '@/lib/server/backend';
import { credentialIssuer } from '@/lib/server/open-badges';
import { siteOrigin } from '@/lib/server/urls';

export const dynamic = 'force-dynamic';

const CATEGORIES: CompetencyCategory[] = ['technical', 'digital', 'business', 'human'];

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.framework.title, description: t.framework.intro };
}

/** The catalog from the database; the seed's catalog where the database does not offer it yet. */
async function catalog(): Promise<PublicCompetency[]> {
  const rows = await publicRead<PublicCompetency[]>('sp_public_competencies', {}).catch(() => null);
  return Array.isArray(rows) && rows.length > 0 ? rows : SEED_COMPETENCIES;
}

/**
 * The SkillPass competency framework: what each competency means and how it is verified. Open Badges link
 * here (Alignment.targetUrl = /competencies#<slug>), so every anchor is a competency slug.
 */
export default async function CompetencyFrameworkPage() {
  const { t, locale } = await getMessages();
  const F = t.framework;
  const competencies = await catalog();
  const issuer = credentialIssuer(await siteOrigin());
  const other = locale === 'es' ? 'en' : 'es';
  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="kicker">SkillPass by AINDEV NEXUS</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{F.title}</h1>
        <p className="mt-4 max-w-3xl leading-relaxed text-ink-700">{F.intro}</p>

        <section id="rubric" className="mt-10 scroll-mt-24">
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><BadgeCheck className="size-5 text-gold-700" aria-hidden /> {F.rubricTitle}</h2>
          <p className="mt-2 leading-relaxed text-ink-700">{F.rubricText}</p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-5">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <li key={n} id={`level-${n}`} className={`rounded-xl border p-3 text-sm ${n >= 3 ? 'border-success-600/30 bg-success-50/60' : 'border-ink-200 bg-white'}`}>
                <p className="font-bold">{n} · {t.rubric.levels[n].label}</p>
                <p className="mt-1 text-ink-600">{t.rubric.levels[n].hint}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="vath" className="mt-10 scroll-mt-24">
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><Clock className="size-5 text-gold-700" aria-hidden /> {F.vathTitle}</h2>
          <p className="mt-2 leading-relaxed text-ink-700">{F.vathText}</p>
        </section>

        <section id="catalog" className="mt-10 scroll-mt-24">
          <h2 className="text-xl font-extrabold">{F.catalogTitle}</h2>
          {CATEGORIES.map((category) => {
            const items = competencies.filter((k) => k.category === category);
            if (items.length === 0) return null;
            return (
              <div key={category} className="mt-6">
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-500">{t.enums.category[category]}</h3>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {items.map((k) => (
                    <li key={k.slug} id={k.slug} className="card scroll-mt-24 p-4">
                      <p className="font-bold text-ink-950">{locale === 'es' ? k.name_es : k.name_en}</p>
                      <p className="text-xs text-ink-400" lang={other}>{locale === 'es' ? k.name_en : k.name_es} · <code>{k.slug}</code></p>
                      <p className="mt-2 text-sm text-ink-700">{(locale === 'es' ? k.description_es : k.description_en) || '—'}</p>
                      {!k.is_active && <p className="mt-2 text-xs font-semibold text-ink-500">{F.inactive}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        {issuer && (
          <section id="open-badges" className="card card-pad mt-12 scroll-mt-24 text-sm">
            <h2 className="flex items-center gap-2 text-base font-extrabold"><ShieldCheck className="size-5 text-gold-700" aria-hidden /> {F.openBadgesTitle}</h2>
            <p className="mt-2 leading-relaxed text-ink-700">{F.openBadgesText}</p>
            <p className="mt-2 break-all font-mono text-xs"><a className="link" href="/.well-known/did.json">{issuer.did}</a></p>
          </section>
        )}
      </main>
      <PublicFooter />
    </>
  );
}
