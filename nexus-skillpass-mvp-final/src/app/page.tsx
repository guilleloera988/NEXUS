import Link from 'next/link';
import {
  ArrowRight, BadgeCheck, Building2, Check, ClipboardCheck, FileCheck2, GraduationCap, Hammer, Scale, ShieldCheck, Sparkles, Target, UserRound, X,
} from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/shell/public-chrome';
import { BrandMark } from '@/components/ui/brand';
import { getMessages } from '@/lib/i18n/server';

export default async function Landing() {
  const { t } = await getMessages();
  const L = t.landing;
  const workflow = [
    { key: 'challenge', icon: Target, ...L.workflow.challenge },
    { key: 'work', icon: Hammer, ...L.workflow.work },
    { key: 'evidence', icon: FileCheck2, ...L.workflow.evidence },
    { key: 'validation', icon: ClipboardCheck, ...L.workflow.validation },
    { key: 'verified', icon: BadgeCheck, ...L.workflow.verified },
    { key: 'opportunity', icon: Sparkles, ...L.workflow.opportunity },
  ];
  const audiences = [
    { icon: UserRound, ...L.students, href: '/signup?type=student' },
    { icon: GraduationCap, ...L.universities, href: '/signup?type=university' },
    { icon: Building2, ...L.companies, href: '/signup?type=company' },
  ];
  const principleIcons = [Scale, ShieldCheck, FileCheck2, BadgeCheck];

  return (
    <>
      <PublicHeader tone="dark" />
      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-ink-950 text-white">
          <div className="grid-bg absolute inset-0 opacity-60" aria-hidden />
          <div className="absolute -right-40 -top-40 size-[34rem] rounded-full bg-gold-500/20 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-300">{L.eyebrow}</p>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] text-white sm:text-6xl">
                <span className="gold-text">{L.heroTitle}</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-ink-300 sm:text-xl">{L.heroSubtitle}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#como-funciona" className="btn-primary btn-lg">{L.ctaPrimary} <ArrowRight className="size-5" aria-hidden /></a>
                <Link href="/demo" className="btn btn-lg border border-white/20 text-white hover:bg-white/10">{L.ctaSecondary}</Link>
              </div>
              <p className="mt-8 text-sm text-ink-400">{L.heroNote}</p>
            </div>

            {/* Illustrative credential (clearly labelled example; no QR because it would not resolve) */}
            <div className="relative mx-auto w-full max-w-md" aria-hidden>
              <div className="gold-ring relative rounded-3xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <BrandMark size={44} />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-300">{t.skillpass.credentialCard}</p>
                      <p className="text-lg font-extrabold tracking-wide">SKILL<span className="gold-text">PASS</span></p>
                    </div>
                  </div>
                  <span className="rounded-full border border-gold-400/50 px-2 py-0.5 text-[10px] font-bold uppercase text-gold-200">{t.demo.badge}</span>
                </div>
                <div className="mt-6 rounded-2xl bg-white/5 p-4">
                  <p className="text-xl font-bold">María Torres</p>
                  <p className="text-sm text-ink-400">Ingeniería en Sistemas · Demo University</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-ink-400">{t.skillpass.verifiedHours}</p><p className="text-2xl font-extrabold text-gold-300">34</p></div>
                    <div><p className="text-ink-400">{t.skillpass.verifiedCompetencies}</p><p className="text-2xl font-extrabold text-gold-300">4</p></div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {['Business Intelligence', 'Data Analysis', 'SQL', 'Communication'].map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full bg-success-50/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                      <Check className="size-3" /> {c}
                    </span>
                  ))}
                </div>
                <p className="mt-5 font-mono text-xs text-ink-400">ID SKP-2026-4A7C-91D2 · Nova Manufacturing (DEMO)</p>
              </div>
            </div>
          </div>
        </section>

        {/* The question */}
        <section className="border-b border-ink-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6">
            <p className="kicker">{L.questionTitle}</p>
            <p className="mt-4 text-2xl font-extrabold leading-snug text-ink-950 sm:text-3xl">“{L.question}”</p>
          </div>
        </section>

        {/* Workflow */}
        <section id="como-funciona" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-extrabold">{L.workflowTitle}</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {workflow.map((step, i) => (
              <li key={step.key} className="card relative p-5">
                <span className="absolute right-4 top-4 text-xs font-bold text-ink-300">{String(i + 1).padStart(2, '0')}</span>
                <span className="grid size-11 place-items-center rounded-xl bg-ink-950 text-gold-300"><step.icon className="size-5" aria-hidden /></span>
                <h3 className="mt-4 font-bold">{step.title}</h3>
                <p className="mt-1 text-sm text-ink-500">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Audiences */}
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-extrabold">{L.audiencesTitle}</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {audiences.map((a) => (
                <article key={a.title} className="card flex flex-col p-6">
                  <span className="grid size-12 place-items-center rounded-2xl bg-gold-100 text-gold-800"><a.icon className="size-6" aria-hidden /></span>
                  <h3 className="mt-4 text-xl font-bold">{a.title}</h3>
                  <p className="mt-2 flex-1 text-ink-600">{a.text}</p>
                  <Link href={a.href} className="link mt-5 inline-flex items-center gap-1 text-sm">{a.cta} <ArrowRight className="size-4" aria-hidden /></Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Why SkillPass */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="kicker">{L.whyTitle}</p>
          <h2 className="mt-2 text-3xl font-extrabold">{L.whySubtitle}</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="card p-6">
              <h3 className="text-lg font-bold text-ink-700">{L.selfReported.title}</h3>
              <ul className="mt-4 space-y-3">
                {L.selfReported.items.map((item) => (
                  <li key={item} className="flex gap-3 text-ink-600"><X className="mt-0.5 size-5 shrink-0 text-ink-400" aria-hidden />{item}</li>
                ))}
              </ul>
            </div>
            <div className="card-dark p-6 gold-ring">
              <h3 className="text-lg font-bold text-gold-300">{L.verifiedApplied.title}</h3>
              <ul className="mt-4 space-y-3">
                {L.verifiedApplied.items.map((item) => (
                  <li key={item} className="flex gap-3 text-ink-100"><BadgeCheck className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden />{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="card p-6">
              <p className="kicker">{t.vath.name} · {t.vath.long}</p>
              <p className="mt-2 text-lg font-semibold text-ink-900">{t.vath.definition}</p>
              <p className="mt-2 text-sm text-ink-500">{t.vath.disclaimer}</p>
            </div>
            <div className="card p-6">
              <h3 className="font-bold">{L.notTitle}</h3>
              <ul className="mt-3 grid gap-2 text-sm text-ink-600">
                {L.notItems.map((item) => <li key={item} className="flex gap-2"><X className="size-4 shrink-0 text-ink-400" aria-hidden />{item}</li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* Principles */}
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-extrabold">{L.principlesTitle}</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {L.principles.map((p, i) => {
                const Icon = principleIcons[i] ?? ShieldCheck;
                return (
                  <article key={p.title} className="rounded-2xl border border-ink-200 p-5">
                    <Icon className="size-6 text-gold-600" aria-hidden />
                    <h3 className="mt-3 font-bold">{p.title}</h3>
                    <p className="mt-1 text-sm text-ink-600">{p.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Model */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="kicker">{L.modelTitle}</p>
          <h2 className="mt-2 text-3xl font-extrabold">{L.modelSubtitle}</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {L.model.map((m) => (
              <article key={m.title} className="card p-6">
                <h3 className="font-bold">{m.title}</h3>
                <p className="mt-2 text-sm text-ink-600">{m.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 pb-16 sm:px-6">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-ink-950 px-6 py-12 text-center text-white sm:px-12">
            <div className="grid-bg absolute inset-0 opacity-50" aria-hidden />
            <div className="relative">
              <h2 className="mx-auto max-w-3xl text-3xl font-extrabold text-white sm:text-4xl">{L.finalTitle}</h2>
              <p className="mt-3 text-ink-300">{L.finalText}</p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href="/demo" className="btn-primary btn-lg">{L.ctaSecondary} <ArrowRight className="size-5" aria-hidden /></Link>
                <Link href="/verify" className="btn btn-lg border border-white/20 text-white hover:bg-white/10">{t.nav.verify}</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
