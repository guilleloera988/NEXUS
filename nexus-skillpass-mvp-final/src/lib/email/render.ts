import { dictionaries, fmt, type Locale } from '@/lib/i18n';
import { safeNextPath } from '@/lib/safety';

/*
 * E-mail notices (migration 20261114000001). One message per recipient with what is new for them, in their
 * language, as HTML and plain text. Everything that comes from the database is escaped: names, titles and
 * organization names are written by users.
 */
export interface EmailItem { id: string; kind: string; params: Record<string, unknown>; link: string; created_at: string }
export interface EmailBatch { batch_id: string; to: string; name: string | null; locale: Locale; items: EmailItem[] }
export interface RenderedEmail { subject: string; html: string; text: string }

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();

/** The same sentence the platform shows for a notice (see components/notification-text.tsx), plus invitations. */
export function noticeText(locale: Locale, item: Pick<EmailItem, 'kind' | 'params'>): string {
  const t = dictionaries[locale];
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(item.params ?? {})) {
    if (typeof value === 'string' || typeof value === 'number') params[key] = typeof value === 'string' ? oneLine(value).slice(0, 200) : value;
  }
  if (item.kind === 'invitation') {
    const role = (t.email.roles as Record<string, string>)[String(params.member_role)] ?? t.email.roles.staff;
    const organization = params.organization ?? 'SkillPass';
    return params.invited_by
      ? fmt(t.email.invitation, { inviter: params.invited_by, organization, role })
      : fmt(t.email.invitationAnonymous, { organization, role });
  }
  if (typeof params.outcome === 'string') params.outcome = (t.status.outcome as Record<string, string>)[params.outcome] ?? params.outcome;
  if (typeof params.status === 'string') {
    params.status = (t.status.challenge as Record<string, string>)[params.status] ?? (t.status.organization as Record<string, string>)[params.status] ?? params.status;
  }
  const kinds = t.notifications.kinds as Record<string, string>;
  // A placeholder the notice did not carry reads better as nothing than as "{student}".
  return oneLine(fmt(kinds[item.kind] ?? kinds.fallback, params).replace(/\{\w+\}/g, '…'));
}

/** `privacy`: whether the deployment publishes its privacy notice (the footer then links to it). */
export function renderEmail(batch: EmailBatch, origin: string, { privacy = false }: { privacy?: boolean } = {}): RenderedEmail {
  const locale: Locale = batch.locale === 'en' ? 'en' : 'es';
  const t = dictionaries[locale];
  const E = t.email;
  const base = origin.replace(/\/+$/, '');
  const url = (link: string, fallback: string) => `${base}${safeNextPath(link, fallback)}`;
  const items = batch.items.slice(0, 20);
  const lines = items.map((item) => noticeText(locale, item));
  const invitation = items.length === 1 && items[0].kind === 'invitation' ? items[0] : null;
  const organization = invitation ? oneLine(String(invitation.params.organization ?? 'SkillPass')).slice(0, 160) : '';

  const subject = (invitation ? fmt(E.invitationSubject, { organization })
    : items.length === 1 ? lines[0].replace(/\.$/, '') : fmt(E.subjectMany, { n: items.length })).slice(0, 150);
  const greeting = batch.name ? fmt(E.greeting, { name: oneLine(batch.name).split(' ')[0].slice(0, 60) }) : E.greetingAnonymous;
  const button = invitation ? { label: E.invitationOpen, href: url(invitation.link, '/signup') }
    : items.length === 1 ? { label: E.open, href: url(items[0].link, '/notifications') }
      : { label: E.openAll, href: url('/notifications', '/notifications') };
  const footer = invitation ? fmt(E.footerInvitation, { organization }) : E.footer;
  const body = invitation ? [lines[0], E.invitationHow] : items.length === 1 ? [lines[0]] : [E.introMany];
  const list = !invitation && items.length > 1 ? lines : [];

  const privacyUrl = privacy ? `${base}/legal/privacy` : null;

  const text = [greeting, '', ...body, ...list.map((line) => `- ${line}`), '', `${button.label}: ${button.href}`, '', '--', t.brand.full, footer,
    ...(privacyUrl ? [`${E.privacy}: ${privacyUrl}`] : [])].join('\n');
  const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f1f1f;">
<div style="max-width:560px;margin:0 auto;padding:24px 16px;">
  <p style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:.08em;color:#8a6d1a;">SKILLPASS <span style="color:#8c8c8c;font-weight:600;">BY AINDEV NEXUS</span></p>
  <div style="background:#ffffff;border:1px solid #e6e3da;border-radius:14px;padding:24px;">
    <p style="margin:0 0 12px;font-size:16px;">${escapeHtml(greeting)}</p>
    ${body.map((line) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;">${escapeHtml(line)}</p>`).join('\n    ')}
    ${list.length ? `<ul style="margin:0 0 12px;padding-left:20px;font-size:16px;line-height:1.5;">${list.map((line) => `<li style="margin:0 0 6px;">${escapeHtml(line)}</li>`).join('')}</ul>` : ''}
    <p style="margin:20px 0 4px;"><a href="${escapeHtml(button.href)}" style="display:inline-block;background:#e0b23c;color:#151515;font-weight:700;font-size:15px;text-decoration:none;padding:12px 20px;border-radius:10px;">${escapeHtml(button.label)}</a></p>
  </div>
  <p style="margin:16px 4px 0;font-size:12px;line-height:1.5;color:#7a7a7a;">${escapeHtml(footer)}${privacyUrl ? ` <a href="${escapeHtml(privacyUrl)}" style="color:#7a7a7a;">${escapeHtml(E.privacy)}</a>` : ''}</p>
</div>
</body></html>`;
  return { subject, html, text };
}
