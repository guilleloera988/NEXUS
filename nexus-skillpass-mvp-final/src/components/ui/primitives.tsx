import Link from 'next/link';
import type { ReactNode } from 'react';
import { initials } from '@/lib/format';

export type Tone = 'neutral' | 'gold' | 'success' | 'warning' | 'danger' | 'info' | 'dark';

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`badge-${tone} ${className}`}>{children}</span>;
}

const TONES: Record<string, Tone> = {
  // challenge
  draft: 'neutral', published: 'info', recruiting: 'gold', active: 'success', under_review: 'warning', completed: 'dark', archived: 'neutral',
  // evidence / vath / applications / requests / outcomes
  submitted: 'info', reviewed: 'warning', approved: 'success', rejected: 'danger', verified: 'success', adjusted: 'warning',
  shortlisted: 'gold', accepted: 'success', withdrawn: 'neutral', pending: 'warning', cancelled: 'neutral',
  partially_approved: 'warning', changes_requested: 'warning', revoked: 'danger',
  todo: 'neutral', in_progress: 'info', done: 'success', open: 'warning', investigating: 'info', resolved: 'success', dismissed: 'neutral',
};
export const toneFor = (status: string | null | undefined): Tone => (status ? TONES[status] ?? 'neutral' : 'neutral');

export function StatusBadge({ status, label }: { status: string | null | undefined; label: string }) {
  return <Badge tone={toneFor(status)}>{label}</Badge>;
}

export function PageHeader({ kicker, title, subtitle, actions }: { kicker?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker && <p className="kicker mb-2">{kicker}</p>}
        <h1 className="text-2xl font-extrabold sm:text-[1.9rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm text-ink-500 sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = '', bodyClassName = 'card-pad', id }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string;
}) {
  return (
    <section className={`card ${className}`} id={id} aria-labelledby={title && id ? `${id}-title` : undefined}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4 sm:px-6">
          {title && <h2 id={id ? `${id}-title` : undefined} className="text-base font-bold">{title}</h2>}
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, icon, href, accent = false }: {
  label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; href?: string; accent?: boolean;
}) {
  const body = (
    <div className={`card flex h-full items-start gap-3.5 p-4 transition ${href ? 'hover:border-gold-300 hover:shadow-[var(--shadow-lift)]' : ''} ${accent ? 'bg-gold-50/60' : ''}`}>
      {icon && <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-950 text-gold-300" aria-hidden>{icon}</span>}
      <div className="min-w-0">
        <p className="text-2xl font-extrabold leading-tight text-ink-950 tabular-nums">{value}</p>
        <p className="text-sm font-medium text-ink-600">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block rounded-[var(--radius-card)]">{body}</Link> : body;
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-ink-50/60 px-6 py-10 text-center">
      {icon && <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-white text-gold-600 shadow-sm" aria-hidden>{icon}</span>}
      <p className="font-bold text-ink-900">{title}</p>
      {text && <p className="mt-1 max-w-md text-sm text-ink-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = 'info', title, children, className = '' }: { tone?: 'info' | 'warning' | 'success' | 'danger' | 'gold'; title?: string; children?: ReactNode; className?: string }) {
  const styles = {
    info: 'border-info-700/20 bg-info-50 text-info-700',
    warning: 'border-warning-700/20 bg-warning-50 text-warning-700',
    success: 'border-success-600/20 bg-success-50 text-success-700',
    danger: 'border-danger-600/25 bg-danger-50 text-danger-700',
    gold: 'border-gold-300 bg-gold-50 text-gold-800',
  }[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${styles} ${className}`}>
      {title && <p className="font-bold">{title}</p>}
      {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
    </div>
  );
}

export function Avatar({ name, size = 'md', tone = 'gold' }: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; tone?: 'gold' | 'dark' }) {
  const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-20 text-2xl' }[size];
  const tones = tone === 'gold' ? 'bg-gradient-to-br from-gold-200 via-gold-400 to-gold-600 text-ink-950' : 'bg-ink-950 text-gold-300';
  return <span className={`grid shrink-0 place-items-center rounded-full font-extrabold ${sizes} ${tones}`} aria-hidden>{initials(name)}</span>;
}

export function ProgressBar({ value, max = 100, label, tone = 'gold' }: { value: number; max?: number; label?: string; tone?: 'gold' | 'success' | 'dark' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color = { gold: 'bg-gradient-to-r from-gold-300 to-gold-500', success: 'bg-success-600', dark: 'bg-ink-900' }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={label}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressRing({ value, max = 100, size = 120, label, sublabel }: { value: number; max?: number; size?: number; label: ReactNode; sublabel?: string }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ring-gold" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f6dc90" />
            <stop offset="100%" stopColor="#c9962a" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ink-100)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ring-gold)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-extrabold tabular-nums text-ink-950">{label}</div>
        {sublabel && <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{sublabel}</div>}
      </div>
    </div>
  );
}

export function LinkTabs({ tabs, active, label }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 mb-5 overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-ink-200 px-1">
        {tabs.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link href={tab.href} scroll={false} aria-current={current ? 'page' : undefined}
                className={`relative -mb-px inline-flex items-center gap-2 rounded-t-lg px-3.5 py-2.5 text-sm font-semibold transition ${current ? 'text-ink-950' : 'text-ink-500 hover:text-ink-900'}`}>
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && <span className={`rounded-full px-1.5 text-[11px] ${current ? 'bg-gold-100 text-gold-800' : 'bg-ink-100 text-ink-600'}`}>{tab.count}</span>}
                {current && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gold-500" aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DefinitionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{item.label}</dt>
          <dd className="mt-0.5 text-sm text-ink-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
