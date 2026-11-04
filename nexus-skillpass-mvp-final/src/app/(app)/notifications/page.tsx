import type { Metadata } from 'next';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { markNotificationsRead } from '@/actions/profile';
import { NotificationText } from '@/components/notification-text';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { formatDateTime, formatRelative } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/server';
import { read } from '@/lib/server/backend';
import type { NotificationItem } from '@/lib/types';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.notifications.title };
}

export default async function NotificationsPage() {
  const { t, locale } = await getMessages();
  const { items } = await read<{ items: NotificationItem[] }>('sp_notifications', { limit: 100 });
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <>
      <PageHeader title={t.notifications.title} subtitle={fmt(t.notifications.unread, { n: unread })}
        actions={unread > 0 ? <form action={markNotificationsRead}><button type="submit" className="btn-outline"><CheckCheck className="size-4" aria-hidden /> {t.notifications.markAll}</button></form> : undefined} />
      <Card bodyClassName="p-0">
        {items.length === 0 ? <div className="p-6"><EmptyState icon={<Bell className="size-6" />} title={t.notifications.empty} /></div> : (
          <ul className="divide-y divide-ink-100">
            {items.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${n.read_at ? '' : 'bg-gold-50/50'}`}>
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? 'bg-ink-200' : 'bg-gold-500'}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  {n.link ? <Link href={n.link} className={`hover:underline ${n.read_at ? 'text-ink-700' : 'font-semibold text-ink-950'}`}><NotificationText item={n} t={t} /></Link> : <p><NotificationText item={n} t={t} /></p>}
                  <p className="text-xs text-ink-400" title={formatDateTime(locale, n.created_at)}>{formatRelative(locale, n.created_at)}</p>
                </div>
                {!n.read_at && (
                  <form action={markNotificationsRead}><input type="hidden" name="id" value={n.id} /><button type="submit" className="btn-ghost btn-sm" aria-label={t.notifications.markAll}><CheckCheck className="size-4" aria-hidden /></button></form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
