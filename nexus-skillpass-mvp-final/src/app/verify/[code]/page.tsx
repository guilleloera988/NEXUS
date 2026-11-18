import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, ExternalLink, FileText, FlaskConical, Info, SearchX, ShieldAlert, ShieldCheck } from 'lucide-react';
import { CredentialCard } from '@/components/credential-card';
import { PublicDemoGuide } from '@/components/public-demo-guide';
import { PublicFooter, PublicHeader } from '@/components/shell/public-chrome';
import { CopyButton, PrintButton } from '@/components/ui/interactive';
import { formatDateTime } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/server';
import { publicRead } from '@/lib/server/backend';
import { isUuid } from '@/lib/server/demo-session';
import { publicUrl } from '@/lib/server/urls';
import type { PublicVerification } from '@/lib/types';

const CODE = /^SKP-\d{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;

async function load(code: string, demo: string | null) {
  if (!CODE.test(code)) return null;
  return publicRead<PublicVerification>('sp_public_credential', { code }, demo);
}

export async function generateMetadata({ params, searchParams }: PageProps<'/verify/[code]'>): Promise<Metadata> {
  const { t } = await getMessages();
  const code = decodeURIComponent((await params).code).toUpperCase();
  const demo = (await searchParams).demo;
  const data = await load(code, typeof demo === 'string' && isUuid(demo) ? demo : null).catch(() => null);
  return {
    title: `${t.publicPages.verifyTitle} · ${code}`,
    description: data ? `${data.holder.full_name} · ${data.credential.challenge_title ?? t.skillpass.confidentialProject}` : t.publicPages.notFound,
    robots: { index: false, follow: false },
  };
}

export default async function VerifyCredentialPage({ params, searchParams }: PageProps<'/verify/[code]'>) {
  const raw = decodeURIComponent((await params).code);
  const code = raw.toUpperCase().trim();
  if (code.length > 40) notFound();
  const demoParam = (await searchParams).demo;
  const demo = typeof demoParam === 'string' && isUuid(demoParam) ? demoParam : null;
  const { t, locale } = await getMessages();
  const P = t.publicPages;
  const data = await load(code, demo);
  const url = await publicUrl(`/verify/${code}`, demo);

  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {data?.credential.is_demo && (
          <p className="mb-4 flex items-center gap-2 rounded-xl border border-gold-300 bg-gold-50 px-4 py-2 text-sm font-semibold text-gold-800"><FlaskConical className="size-4" aria-hidden /> {P.demoNotice}</p>
        )}
        {!data ? (
          <section className="card p-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-ink-100 text-ink-600"><SearchX className="size-7" aria-hidden /></span>
            <h1 className="mt-4 text-2xl font-extrabold">{P.notFound}</h1>
            <p className="mx-auto mt-2 max-w-md text-ink-500">{P.notFoundText}</p>
            <p className="mt-3 font-mono text-sm text-ink-600">{code}</p>
            <Link href="/verify" className="btn-primary mt-6">{P.enterCode}</Link>
          </section>
        ) : (
          <>
            <section className={`mb-6 flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center ${data.verification.status === 'valid' ? 'border-success-600/30 bg-success-50' : 'border-danger-600/30 bg-danger-50'}`}
              role="status" aria-live="polite">
              <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${data.verification.status === 'valid' ? 'bg-success-600 text-white' : 'bg-danger-600 text-white'}`}>
                {data.verification.status === 'valid' ? <ShieldCheck className="size-6" aria-hidden /> : <ShieldAlert className="size-6" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className={`text-xl font-extrabold ${data.verification.status === 'valid' ? 'text-success-700' : 'text-danger-700'}`}>{data.verification.status === 'valid' ? P.valid : P.revoked}</h1>
                <p className="text-sm text-ink-700">{data.verification.status === 'valid' ? P.validText : P.revokedText}</p>
                <p className="mt-1 text-xs text-ink-500">{fmt(P.checkedAt, { date: formatDateTime(locale, data.verification.checked_at) })}</p>
              </div>
            </section>

            <CredentialCard credential={data.credential} holder={data.holder.full_name} subtitle={[data.holder.career, data.holder.university].filter(Boolean).join(' · ')}
              verifyUrl={url} t={t} locale={locale}
              actions={<>
                <CopyButton value={url} label={t.skillpass.copyLink} className="btn btn-sm border border-white/20 text-white hover:bg-white/10" />
                <PrintButton label={t.skillpass.print} className="btn-primary btn-sm" />
                {data.holder.skillpass_slug && (
                  <Link href={`/skillpass/${data.holder.skillpass_slug}${demo ? `?demo=${demo}` : ''}`} className="btn btn-sm border border-white/20 text-white hover:bg-white/10">{P.viewSkillpass}</Link>
                )}
              </>} />

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <section className="card card-pad">
                <h2 className="flex items-center gap-2 font-bold"><Info className="size-5 text-gold-600" aria-hidden /> {P.howVerified}</h2>
                <p className="mt-2 text-sm text-ink-600">{P.howVerifiedText}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-ink-700">
                  <li className="flex gap-2"><CheckCircle2 className="size-4 shrink-0 text-success-600" aria-hidden />{fmt(P.approvedEvidence, { n: data.credential.evidence_approved })}</li>
                  <li className="flex gap-2"><CheckCircle2 className="size-4 shrink-0 text-success-600" aria-hidden />{t.vath.long}: {data.credential.verified_hours} h</li>
                </ul>
                <p className="mt-3 text-xs text-ink-500">{P.notOfficial} {t.vath.disclaimer}</p>
              </section>
              <section className="card card-pad">
                <h2 className="font-bold">{t.skillpass.publicEvidence}</h2>
                {data.credential.public_evidence.length === 0 ? <p className="mt-2 text-sm text-ink-500">{data.credential.confidential ? t.skillpass.confidentialHelp : '—'}</p> : (
                  <ul className="mt-3 space-y-2">
                    {data.credential.public_evidence.map((e) => (
                      <li key={e.id}>
                        <a href={e.has_file ? `/api/public/evidence/${e.id}${demo ? `?demo=${demo}` : ''}` : e.url ?? '#'} target="_blank" rel="noopener noreferrer nofollow"
                          className="flex items-center gap-3 rounded-xl border border-ink-200 p-3 text-sm hover:border-gold-300">
                          {e.has_file ? <FileText className="size-4 text-ink-500" aria-hidden /> : <ExternalLink className="size-4 text-ink-500" aria-hidden />}
                          <span className="flex-1 font-semibold">{e.title}</span>
                          <span className="text-xs text-ink-500">{t.enums.evidenceKind[e.kind]}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </main>
      <PublicFooter />
      <PublicDemoGuide />
    </>
  );
}
