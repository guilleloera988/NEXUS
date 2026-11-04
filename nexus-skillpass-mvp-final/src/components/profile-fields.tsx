'use client';

import { AVAILABILITY, INTERESTS } from '@/lib/constants';
import { competencyName } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/client';
import type { Competency, Lookups, MyUniversity, Profile } from '@/lib/types';
import { ChipGroup, Field } from './ui/form';

/** Student profile inputs shared by onboarding and profile editing. */
export function StudentProfileFields({ profile, lookups, declared, membership }: {
  profile: Profile; lookups: Lookups; declared: string[];
  /** null on databases without migration 20261103000001 (no verification there). */
  membership: MyUniversity | null;
}) {
  const { t, locale } = useI18n();
  const O = t.onboarding.student;
  const M = O.membership;
  // The current university or request stays selected, even if it is not in the list (under re-verification),
  // so saving the profile again neither withdraws a request nor drops a link.
  const current = membership?.university ?? null;
  const request = membership?.request ?? null;
  const chosen = profile.university_id ?? request?.university_id ?? '';
  const options = lookups.universities.map((u) => ({ value: u.id, label: u.campus ? `${u.name} · ${u.campus}` : u.name }));
  const chosenName = current?.name ?? request?.name;
  if (chosen && chosenName && !options.some((o) => o.value === chosen)) options.unshift({ value: chosen, label: chosenName });
  const verifiedText = current?.verified_via
    ? { email_domain: M.verified_email_domain, university: M.verified_university, admin: M.verified_admin, seed: M.verified_seed }[current.verified_via]
    : undefined;
  const status = current
    ? (verifiedText ? { tone: 'text-success-700', text: verifiedText } : null)
    : request
      ? { tone: request.status === 'pending' ? 'text-warning-700' : 'text-danger-700', text: fmt(M[request.status], { university: request.name }) }
      : null;
  const byCategory = (['technical', 'digital', 'business', 'human'] as const).map((category) => ({
    category,
    items: lookups.competencies.filter((c: Competency) => c.category === category),
  }));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.auth.fullName} name="full_name" defaultValue={profile.full_name} required maxLength={160} autoComplete="name" />
        <Field label={O.location} name="location" defaultValue={profile.location} maxLength={120} autoComplete="address-level2" />
        <Field label={O.headline} name="headline" defaultValue={profile.headline} placeholder={O.headlinePlaceholder} maxLength={160} className="sm:col-span-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
        <Field as="select" label={O.university} name="university_id" defaultValue={chosen} placeholder={O.noUniversity}
          options={options} help={O.universityHelp} />
        <Field label={O.career} name="career" defaultValue={profile.career} maxLength={160} />
        <Field label={O.semester} name="semester" type="number" min={1} max={20} defaultValue={profile.semester ?? ''} inputMode="numeric" />
      </div>
      {status && <p className={`-mt-3 text-sm font-medium ${status.tone}`}>{status.text}</p>}
      <ChipGroup name="interests" legend={O.interests} help={O.interestsHelp} max={6} defaultValues={profile.interests}
        options={INTERESTS.map((key) => ({ value: key, label: t.enums.interests[key] }))} />
      <fieldset>
        <legend className="label">{O.skills}</legend>
        <p className="help -mt-1 mb-3">{O.skillsHelp}</p>
        <div className="space-y-3">
          {byCategory.map(({ category, items }) => (
            <div key={category}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">{t.enums.category[category]}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((c) => (
                  <label key={c.id} className="cursor-pointer">
                    <input type="checkbox" name="skill_ids" value={c.id} defaultChecked={declared.includes(c.id)} className="peer sr-only" />
                    <span className="inline-flex items-center rounded-full border border-ink-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 transition peer-checked:border-gold-500 peer-checked:bg-gold-50 peer-checked:text-gold-800 peer-focus-visible:ring-4 peer-focus-visible:ring-gold-200">
                      {competencyName(locale, c)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field as="select" label={O.availability} name="availability" defaultValue={profile.availability}
          options={AVAILABILITY.map((a) => ({ value: a, label: t.enums.availability[a] }))} />
        <Field label={O.hoursPerWeek} name="hours_per_week" type="number" min={1} max={60} defaultValue={profile.hours_per_week ?? ''} inputMode="numeric" />
      </div>
      <Field as="textarea" label={O.bio} name="bio" defaultValue={profile.bio} maxLength={1200} rows={4} />
    </div>
  );
}
