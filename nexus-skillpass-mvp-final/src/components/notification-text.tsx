import { fmt, type Messages } from '@/lib/i18n';
import type { NotificationItem } from '@/lib/types';

/** Renders a notification from its kind + parameters in the visitor's language. */
export function NotificationText({ item, t }: { item: NotificationItem; t: Messages }) {
  const kinds = t.notifications.kinds as Record<string, string>;
  const template = kinds[item.kind] ?? t.notifications.kinds.fallback;
  const params: Record<string, string | number> = { ...item.params };
  if (typeof params.outcome === 'string') params.outcome = (t.status.outcome as Record<string, string>)[params.outcome] ?? params.outcome;
  if (typeof params.status === 'string') {
    params.status = (t.status.challenge as Record<string, string>)[params.status] ?? (t.status.organization as Record<string, string>)[params.status] ?? params.status;
  }
  return <>{fmt(template, params)}</>;
}
