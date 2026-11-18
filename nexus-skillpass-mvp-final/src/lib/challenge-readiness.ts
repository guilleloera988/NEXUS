/*
 * What a challenge still needs before it can leave draft (published / open call).
 * Mirrors public.sp_challenge_publish_missing (migration 20261015000001): same items, same order,
 * so the first item listed here is the one the database reports.
 */
export const PUBLISH_REQUIREMENTS = [
  'summary', 'description', 'industry', 'location', 'conditions', 'competencies', 'deliverables', 'supervisor_id', 'start_date',
] as const;
export type PublishRequirement = (typeof PUBLISH_REQUIREMENTS)[number];

/** A move into an open call (draft -> published, or into recruiting) needs every requirement. */
export const opensChallenge = (from: string, to: string) => to === 'recruiting' || (from === 'draft' && to === 'published');

export type PublishCandidate = {
  summary?: string | null; description?: string | null; industry?: string | null; modality?: string | null; location?: string | null;
  conditions?: string | null; supervisor_id?: string | null; start_date?: string | null; end_date?: string | null;
};

// Same characters as the SQL helper (JS \s plus U+0085 and U+200B), whatever the database locale.
const blank = (value: string | null | undefined) => !value || /^[\s\u0085\u200b]*$/.test(value);

export function missingForPublish(c: PublishCandidate, counts: { competencies: number; deliverables: number }): PublishRequirement[] {
  const missing: Record<PublishRequirement, boolean> = {
    summary: blank(c.summary),
    description: blank(c.description),
    industry: blank(c.industry),
    location: c.modality !== 'remote' && blank(c.location),
    conditions: blank(c.conditions),
    competencies: counts.competencies === 0,
    deliverables: counts.deliverables === 0,
    supervisor_id: blank(c.supervisor_id),
    start_date: blank(c.start_date) || blank(c.end_date),
  };
  return PUBLISH_REQUIREMENTS.filter((key) => missing[key]);
}
