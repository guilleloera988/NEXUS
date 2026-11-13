'use client';

import { useId } from 'react';
import { useI18n } from '@/lib/i18n/client';

/** Required checkbox: "I have read the privacy notice and I accept the terms", with both texts one click away. */
export function LegalConsent() {
  const { t } = useI18n();
  const id = useId();
  const L = t.legal;
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" name="legal" required className="checkbox" />
      <label htmlFor={id} className="text-sm text-ink-800">
        {L.consentRead} <a className="link" href="/legal/privacy" target="_blank" rel="noopener">{L.privacy}</a> {L.consentAccept}{' '}
        <a className="link" href="/legal/terms" target="_blank" rel="noopener">{L.terms}</a>.
      </label>
    </div>
  );
}
