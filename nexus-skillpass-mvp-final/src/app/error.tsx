'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => { console.error('[skillpass] render error', error.digest ?? error.message); }, [error]);
  const expired = /demo_expired/.test(error.message);
  return (
    <main id="main" className="grid min-h-[70vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-danger-50 text-danger-700"><AlertTriangle className="size-7" aria-hidden /></span>
        <h1 className="text-2xl font-extrabold">{t.errors.title}</h1>
        <p className="mt-2 text-ink-500">{expired ? t.errors.demoExpired : t.errors.text}</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-ink-400">ref: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={reset} className="btn-primary">{t.common.retry}</button>
          <Link href={expired ? '/demo' : '/'} className="btn-outline">{expired ? t.nav.demo : t.errors.goHome}</Link>
        </div>
      </div>
    </main>
  );
}
