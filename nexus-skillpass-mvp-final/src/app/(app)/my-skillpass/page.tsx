import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Award, BadgeCheck, Clock, ExternalLink, Eye, EyeOff, Globe, Lock, Users } from 'lucide-react';
import { setCredentialVerification } from '@/actions/profile';
import { CredentialCard } from '@/components/credential-card';
import { PrivacyForm } from '@/components/skillpass-client';
import { CopyButton, PrintButton } from '@/components/ui/interactive';
import { Alert, Badge, Card, EmptyState, LinkTabs, PageHeader, StatCard } from '@/components/ui/primitives';
import { competencyName, formatHours } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/server';
import { getMe, read } from '@/lib/server/backend';
import { publicUrl } from '@/lib/server/urls';
import type { SkillPassMe } from '@/lib/types';
import { ReportIncidentForm } from '@/components/profile-client';

const TABS = ['credentials', 'competencies', 'progress', 'privacy'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.skillpass.myTitle };
}

export default async function MySkillPassPage({ searchParams }: PageProps<'/my-skillpass'>) {
  const me = await getMe();
  if (!me) redirect('/login');
  if (me.profile.role !== 'student') redirect('/profile');
  const { t, locale } = await getMessages();
  const S = t.skillpass;
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(String(sp.tab)) ? String(sp.tab) : 'credentials';
  const data = await read<SkillPassMe>('sp_skillpass_me');
  const p = data.profile;
  const demoId = me.mode === 'demo' ? me.demoId : null;
  const skillpassUrl = await publicUrl(`/skillpass/${p.slug}`, demoId);
  const credentials = await Promise.all(data.credentials.map(async (c) => ({ c, url: await publicUrl(`/verify/${c.code}`, demoId) })));
  const subtitle = [p.career, p.university].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader kicker="SkillPass" title={S.myTitle} subtitle={S.mySubtitle}
        actions={<>
          {p.skillpass_public && <a href={skillpassUrl} target="_blank" rel="noopener" className="btn-primary"><ExternalLink className="size-4" aria-hidden /> {S.viewOnline}</a>}
          <CopyButton value={skillpassUrl} label={S.copyLink} className="btn-outline" />
        </>} />

      <Alert tone={p.skillpass_public ? 'success' : 'warning'} className="mb-5">
        <span className="inline-flex items-center gap-2">{p.skillpass_public ? <Globe className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}{p.skillpass_public ? S.pageIsPublic : S.pageIsPrivate}</span>
        {' '}<Link href="/my-skillpass?tab=privacy" className="link ml-1 text-sm">{S.tabs.privacy}</Link>
      </Alert>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Clock className="size-5" />} label={S.totals.credentialed} value={formatHours(locale, data.totals.credentialed_vath)} accent />
        <StatCard icon={<Clock className="size-5" />} label={S.totals.verified} value={formatHours(locale, data.totals.verified_vath)} />
        <StatCard icon={<Award className="size-5" />} label={S.verifiedProjects} value={data.totals.verified_projects} />
        <StatCard icon={<BadgeCheck className="size-5" />} label={S.verifiedCompetencies} value={data.totals.verified_competencies} />
      </div>

      <LinkTabs label={S.myTitle} active={tab} tabs={TABS.map((k) => ({ key: k, label: S.tabs[k], href: `/my-skillpass?tab=${k}`, count: k === 'credentials' ? data.credentials.length : undefined }))} />

      {tab === 'credentials' && (
        data.credentials.length === 0 ? (
          <EmptyState icon={<Award className="size-6" />} title={S.noCredentials} text={S.noCredentialsText} action={<Link href="/challenges" className="btn-primary btn-sm">{t.dashboard.student.explore}</Link>} />
        ) : (
          <div className="space-y-6">
            {credentials.map(({ c, url }) => (
              <div key={c.code}>
                <CredentialCard credential={c} holder={p.full_name} subtitle={subtitle} verifyUrl={url} t={t} locale={locale}
                  actions={<>
                    <a href={url} target="_blank" rel="noopener" className="btn btn-sm border border-white/20 text-white hover:bg-white/10"><ExternalLink className="size-4" aria-hidden /> {S.viewOnline}</a>
                    <CopyButton value={url} label={S.copyLink} className="btn btn-sm border border-white/20 text-white hover:bg-white/10" />
                    <PrintButton label={S.print} className="btn-primary btn-sm" />
                  </>} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm">
                  <span className="inline-flex items-center gap-2 text-ink-700">
                    {c.verification_enabled ? <Eye className="size-4 text-success-600" aria-hidden /> : <EyeOff className="size-4 text-ink-400" aria-hidden />}
                    {c.verification_enabled ? S.credentialPublic : S.credentialHidden}
                    {c.confidential && <Badge tone="neutral">{S.confidentialProject}: {c.real_challenge_title}</Badge>}
                  </span>
                  {c.status === 'active' && (
                    <form action={setCredentialVerification}>
                      <input type="hidden" name="credential_id" value={c.id} />
                      <input type="hidden" name="enabled" value={c.verification_enabled ? 'false' : 'true'} />
                      <button type="submit" className="btn-outline btn-sm">{c.verification_enabled ? S.disableVerification : S.enableVerification}</button>
                    </form>
                  )}
                </div>
                {c.public_evidence.length > 0 && (
                  <p className="mt-2 text-xs text-ink-500">{S.publicEvidence}: {c.public_evidence.map((e) => e.title).join(', ')}</p>
                )}
              </div>
            ))}
            <p className="text-xs text-ink-500">{S.makeEvidencePublicHint} {S.verificationNote}</p>
          </div>
        )
      )}

      {tab === 'competencies' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title={S.verifiedCompetencies} className="lg:col-span-2">
            {data.verified_competencies.length === 0 ? <p className="text-sm text-ink-500">{t.profile.noVerified}</p> : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.verified_competencies.map((c) => (
                  <li key={c.id} className="rounded-xl border border-success-600/25 bg-success-50/50 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-ink-950">{competencyName(locale, c)}</p>
                      <Badge tone="success"><BadgeCheck className="size-3.5" aria-hidden />{t.profile.verifiedBadge}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-700">{t.rubric.level} {c.level} · {t.rubric.levels[c.level as 1 | 2 | 3 | 4 | 5].label}</p>
                    <p className="text-xs text-ink-500">{fmt(S.competencyFrom, { n: c.challenges })} · {t.enums.category[c.category]}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-ink-500">{t.rubric.verifiedRule}</p>
          </Card>
          <div className="space-y-6">
            <Card title={S.developing}>
              <p className="mb-3 text-xs text-ink-500">{S.developingHelp}</p>
              {data.developing.length === 0 ? <p className="text-sm text-ink-500">—</p> : (
                <ul className="space-y-2">{data.developing.map((c) => <li key={c.id} className="flex justify-between text-sm"><span>{competencyName(locale, c)}</span><Badge tone="warning">{t.rubric.level} {c.level}</Badge></li>)}</ul>
              )}
            </Card>
            <Card title={S.declared}>
              <p className="mb-3 text-xs text-ink-500">{S.declaredHelp}</p>
              <div className="flex flex-wrap gap-1.5">{data.declared_skills.map((c) => <Badge key={c.id} tone="neutral">{competencyName(locale, c)}</Badge>)}</div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'progress' && (
        <Card title={S.inProgress}>
          <p className="mb-4 text-sm text-ink-500">{S.inProgressHelp}</p>
          {data.in_progress.length === 0 ? <p className="text-sm text-ink-500">—</p> : (
            <ul className="divide-y divide-ink-100">
              {data.in_progress.map((x) => (
                <li key={x.challenge_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><Link href={`/workspace/${x.challenge_id}`} className="font-semibold hover:underline">{x.title}</Link><p className="text-xs text-ink-500">{x.organization_name}</p></div>
                  <div className="flex gap-2">
                    <Badge tone="success">{formatHours(locale, x.verified_hours)} h {t.status.vath.verified.toLowerCase()}</Badge>
                    {x.pending_hours > 0 && <Badge tone="warning">{fmt(S.pendingHours, { hours: formatHours(locale, x.pending_hours) })}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'privacy' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title={S.privacyTitle} className="lg:col-span-2"><PrivacyForm profile={p} /></Card>
          <div className="space-y-6">
            <Card title={S.publicUrl}>
              <p className="break-all rounded-lg bg-ink-50 p-3 font-mono text-xs text-ink-700">{skillpassUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton value={skillpassUrl} label={S.copyLink} />
                {p.skillpass_public && <a href={skillpassUrl} target="_blank" rel="noopener" className="btn-outline btn-sm"><Users className="size-4" aria-hidden /> {S.viewOnline}</a>}
              </div>
            </Card>
            <Card title={t.incidents.title}><ReportIncidentForm entityType="credential" /></Card>
          </div>
        </div>
      )}
    </>
  );
}
