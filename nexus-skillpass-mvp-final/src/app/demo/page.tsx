import type { Metadata } from 'next';
import Link from 'next/link';
import { FlaskConical, Info } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/shell/public-chrome';
import { Alert } from '@/components/ui/primitives';
import { DEMO_IDS, DEMO_PERSONA_KEYS } from '@/lib/demo-personas';
import { fmt } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/server';
import { demoMode } from '@/lib/server/env';
import { PersonaCard, StartGuided } from './demo-enter';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.demo.guided.title, description: t.demo.subtitle };
}

export default async function DemoPage() {
  const { t } = await getMessages();
  const mode = demoMode();
  return (
    <>
      <PublicHeader />
      <main id="main">
        <section className="relative overflow-hidden bg-ink-950 text-white">
          <div className="grid-bg absolute inset-0 opacity-60" aria-hidden />
          <div className="relative mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 sm:py-20">
            <span className="badge-dark mx-auto ring-1 ring-gold-400/40"><FlaskConical className="size-3.5" aria-hidden /> {t.demo.badge}</span>
            <h1 className="mt-5 text-3xl font-extrabold text-white sm:text-5xl">{t.demo.title}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-ink-300">{t.demo.subtitle}</p>
            <div className="mt-8 flex justify-center">{mode === 'off' ? null : <StartGuided />}</div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          {mode === 'off' ? (
            <Alert tone="gold" title={t.demo.disabled}>{t.demo.disabledText}</Alert>
          ) : (
            <>
              <h2 className="text-xl font-extrabold">{t.demo.orPick}</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {DEMO_PERSONA_KEYS.map((persona) => <PersonaCard key={persona} persona={persona} />)}
              </div>
            </>
          )}

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="flex items-center gap-2 font-bold"><Info className="size-5 text-gold-600" aria-hidden /> {t.demo.guided.title}</h2>
              <ol className="mt-3 grid gap-2 text-sm text-ink-600 sm:grid-cols-2">
                {t.demo.guided.steps.map((s, i) => <li key={s.title}><span className="font-bold text-ink-900">{i + 1}.</span> {s.title}</li>)}
              </ol>
            </div>
            <div className="card p-5">
              <h2 className="font-bold">{t.demo.badge}</h2>
              <p className="mt-2 text-sm text-ink-600">{t.demo.banner}</p>
              {mode === 'supabase' && (
                <div className="mt-4">
                  <p className="text-sm font-semibold">{t.demo.publicExamples}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li><Link className="link" href={`/skillpass/${DEMO_IDS.studentSlug}`}>{t.demo.exampleSkillpass}</Link></li>
                    <li><Link className="link" href={`/verify/${DEMO_IDS.seededCredential}`}>{fmt(t.demo.exampleCredential, { code: DEMO_IDS.seededCredential })}</Link></li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
