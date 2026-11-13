import Link from 'next/link';
import { PublicFooter, PublicHeader } from '@/components/shell/public-chrome';
import { fmt, type Locale } from '@/lib/i18n';
import type { Messages } from '@/lib/i18n';
import { LEGAL_VERSION, legalVersionDate, type LegalDocument, type LegalEntity } from '@/lib/legal/config';

/** A legal text as a public page: summary, contents, numbered sections, and where to write. */
export function LegalDocumentPage({ doc, entity, locale, t, other }: {
  doc: LegalDocument; entity: LegalEntity; locale: Locale; t: Messages; other: { href: string; label: string };
}) {
  const L = t.legal;
  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="kicker">SkillPass by AINDEV NEXUS</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-ink-500">{fmt(L.version, { date: legalVersionDate(locale), version: LEGAL_VERSION })}</p>
        {locale === 'en' && <p className="mt-2 text-sm text-ink-500">{L.languageNote}</p>}
        <p className="mt-6 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3 text-ink-800">{doc.summary}</p>

        <nav aria-label={L.contents} className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">{L.contents}</h2>
          <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {doc.sections.map((s) => <li key={s.id}><a className="link" href={`#${s.id}`}>{s.title}</a></li>)}
          </ol>
        </nav>

        {doc.sections.map((s) => (
          <section key={s.id} id={s.id} className="mt-10 scroll-mt-24">
            <h2 className="text-xl font-extrabold">{s.title}</h2>
            {s.blocks.map((block, i) => (typeof block === 'string'
              ? <p key={i} className="mt-3 leading-relaxed text-ink-700">{block}</p>
              : <ul key={i} className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-ink-700">{block.list.map((item) => <li key={item}>{item}</li>)}</ul>))}
          </section>
        ))}

        <aside className="card card-pad mt-12 text-sm">
          <p className="font-bold">{entity.name}</p>
          <p className="mt-1 text-ink-600">{entity.address}</p>
          <p className="mt-1"><a className="link" href={`mailto:${entity.email}`}>{entity.email}</a></p>
          <p className="mt-4 text-ink-600">{L.seeAlso} <Link className="link" href={other.href}>{other.label}</Link></p>
        </aside>
      </main>
      <PublicFooter />
    </>
  );
}
