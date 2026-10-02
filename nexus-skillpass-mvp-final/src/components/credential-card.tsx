import type { ReactNode } from 'react';
import { BadgeCheck, CalendarDays, ShieldAlert, ShieldCheck } from 'lucide-react';
import { competencyName, formatDate, formatHours } from '@/lib/format';
import { fmt, type Locale, type Messages } from '@/lib/i18n';
import type { PublicCredential } from '@/lib/types';
import { QrCode } from './qr-code';
import { BrandMark } from './ui/brand';

/** Verifiable credential, styled after the SkillPass reference design (deep black + metallic gold). */
export async function CredentialCard({ credential, holder, subtitle, verifyUrl, t, locale, actions }: {
  credential: PublicCredential; holder: string; subtitle?: string | null; verifyUrl: string; t: Messages; locale: Locale; actions?: ReactNode;
}) {
  const revoked = credential.status === 'revoked';
  const title = credential.confidential ? t.skillpass.confidentialProject : credential.challenge_title;
  return (
    <article className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-5 text-white sm:p-7 ${revoked ? 'opacity-90' : 'gold-ring'}`}>
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-gold-500/15 blur-3xl" aria-hidden />
      <div className="relative">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark size={46} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold-300">{t.skillpass.credentialCard}</p>
              <p className="text-lg font-extrabold tracking-wide">SKILL<span className="gold-text">PASS</span></p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${revoked ? 'bg-danger-600/20 text-red-200 ring-1 ring-red-300/40' : 'bg-gold-400/15 text-gold-200 ring-1 ring-gold-400/50'}`}>
            {revoked ? <ShieldAlert className="size-4" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
            {revoked ? t.status.credential.revoked : t.publicPages.valid}
          </span>
        </header>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="text-2xl font-extrabold sm:text-3xl">{holder}</p>
            {subtitle && <p className="mt-0.5 text-sm text-ink-300">{subtitle}</p>}
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-400">{t.publicPages.project}</p>
            <p className="text-lg font-bold text-gold-100">{title}</p>
            <p className="text-sm text-ink-300">
              {credential.confidential ? (credential.industry ? t.enums.industries[credential.industry as keyof typeof t.enums.industries] ?? credential.industry : '') : credential.organization_name}
              {credential.start_date ? ` · ${formatDate(locale, credential.start_date)} – ${formatDate(locale, credential.end_date)}` : ''}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-sm">
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-ink-400">{t.skillpass.verifiedHours}</p>
                <p className="text-2xl font-extrabold text-gold-300">{formatHours(locale, credential.verified_hours)}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-ink-400">{t.skillpass.verifiedCompetencies}</p>
                <p className="text-2xl font-extrabold text-gold-300">{credential.competencies.length}</p>
              </div>
            </div>
            {credential.competencies.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={t.skillpass.verifiedCompetencies}>
                {credential.competencies.map((c) => (
                  <li key={c.slug} className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                    <BadgeCheck className="size-3.5" aria-hidden /> {competencyName(locale, c)} · {t.rubric.level} {c.level}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col items-center gap-2">
            <QrCode value={verifyUrl} size={160} label={fmt(t.skillpass.qrAlt, { url: verifyUrl })} />
            <p className="text-[11px] text-ink-400">{t.publicPages.scan}</p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 border-t border-white/10 pt-4 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-ink-400">{t.skillpass.credentialId}</dt><dd className="font-mono font-semibold tracking-wide">{credential.code}</dd></div>
          <div><dt className="text-xs text-ink-400">{t.skillpass.issued}</dt><dd className="font-semibold"><CalendarDays className="mr-1 inline size-3.5 text-ink-400" aria-hidden />{formatDate(locale, credential.issued_at, 'long')}</dd></div>
          <div><dt className="text-xs text-ink-400">{t.skillpass.validatedBy}</dt><dd className="font-semibold">{credential.supervisor_name}{credential.supervisor_title ? <span className="block text-xs font-normal text-ink-400">{credential.supervisor_title}</span> : null}</dd></div>
        </dl>
        <p className="mt-3 text-[11px] text-ink-500">{t.skillpass.issuer}: {credential.issuer}{credential.is_demo ? ` · ${t.demo.badge}` : ''}{revoked && credential.revoked_at ? ` · ${fmt(t.skillpass.revokedOn, { date: formatDate(locale, credential.revoked_at) })}` : ''}</p>
        {actions && <div className="no-print mt-5 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </article>
  );
}
