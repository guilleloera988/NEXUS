import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLISH_REQUIREMENTS, missingForPublish, opensChallenge, type PublishCandidate } from '@/lib/challenge-readiness';
import { dictionaries } from '@/lib/i18n';

const complete: PublishCandidate = {
  summary: 'Digitalizar la lista de verificación de calidad.', description: 'Reto de prueba.', industry: 'manufacturing',
  modality: 'hybrid', location: 'Aguascalientes, Ags.', conditions: 'Visitas a planta acordadas.',
  supervisor_id: '10000000-0000-4000-8000-000000000002', start_date: '2026-09-01', end_date: '2026-12-15',
};
const counts = { competencies: 2, deliverables: 1 };
const ALL = ['summary', 'description', 'industry', 'location', 'conditions', 'competencies', 'deliverables', 'supervisor_id', 'start_date'];

describe('missingForPublish', () => {
  it('reports nothing for a complete challenge', () => {
    expect(missingForPublish(complete, counts)).toEqual([]);
  });

  it('lists every item in the fixed order, whatever the shape of the input', () => {
    expect(PUBLISH_REQUIREMENTS).toEqual(ALL);
    expect(missingForPublish({}, { competencies: 0, deliverables: 0 })).toEqual(ALL);
    const blank = { summary: null, description: null, industry: null, modality: 'onsite', location: null, conditions: null, supervisor_id: null, start_date: null, end_date: null };
    expect(missingForPublish(blank, { competencies: 0, deliverables: 0 })).toEqual(ALL);
    // Key order of the candidate does not matter: the first item is always the one the database reports.
    const reversed = { end_date: complete.end_date, start_date: '', supervisor_id: complete.supervisor_id, conditions: '', location: complete.location,
      modality: complete.modality, industry: complete.industry, description: complete.description, summary: '' };
    expect(missingForPublish(reversed, counts)).toEqual(['summary', 'conditions', 'start_date']);
    expect(missingForPublish(complete, { competencies: 0, deliverables: 0 })).toEqual(['competencies', 'deliverables']);
  });

  it('needs a location unless the challenge is remote', () => {
    for (const location of ['', null, undefined]) {
      expect(missingForPublish({ ...complete, modality: 'remote', location }, counts)).toEqual([]);
      expect(missingForPublish({ ...complete, modality: 'hybrid', location }, counts)).toEqual(['location']);
      expect(missingForPublish({ ...complete, modality: 'onsite', location }, counts)).toEqual(['location']);
      // A missing modality is not treated as remote.
      expect(missingForPublish({ ...complete, modality: undefined, location }, counts)).toEqual(['location']);
    }
  });

  it('treats whitespace-only text as blank', () => {
    // Same set as the SQL helper, whatever the database locale: JS \s plus U+0085 (NEL) and U+200B.
    for (const value of [' ', '   ', '\t', '\n  \n', '\u00a0', '\u0085', '\u200b', '\u2003', '\u3000', '\ufeff']) {
      for (const key of ['summary', 'description', 'industry', 'location', 'conditions', 'supervisor_id'] as const) {
        expect(missingForPublish({ ...complete, [key]: value }, counts), `${key}=${JSON.stringify(value)}`).toEqual([key]);
      }
      expect(missingForPublish({ ...complete, start_date: value }, counts)).toEqual(['start_date']);
      expect(missingForPublish({ ...complete, end_date: value }, counts)).toEqual(['start_date']);
      expect(missingForPublish({ ...complete, modality: 'remote', location: value }, counts)).toEqual([]);
    }
  });

  it('keeps visible text next to blank characters', () => {
    for (const value of ['x', '\u00a0x', 'x\u0085', ' a ']) expect(missingForPublish({ ...complete, summary: value }, counts)).toEqual([]);
  });

  it('opening means draft -> published or any move into recruiting', () => {
    expect([opensChallenge('draft', 'published'), opensChallenge('draft', 'recruiting'), opensChallenge('published', 'recruiting'),
      opensChallenge('active', 'recruiting')]).toEqual([true, true, true, true]);
    expect([opensChallenge('recruiting', 'published'), opensChallenge('published', 'active'), opensChallenge('draft', 'archived'),
      opensChallenge('active', 'under_review')]).toEqual([false, false, false, false]);
  });

  it('reports both dates as one item', () => {
    expect(missingForPublish({ ...complete, start_date: null }, counts)).toEqual(['start_date']);
    expect(missingForPublish({ ...complete, end_date: null }, counts)).toEqual(['start_date']);
    expect(missingForPublish({ ...complete, start_date: '', end_date: '' }, counts)).toEqual(['start_date']);
  });

  it('follows the order of public.sp_challenge_publish_missing in the latest migration that defines it', () => {
    const dir = path.resolve(import.meta.dirname, '../../supabase/migrations');
    const bodies = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
      .flatMap((f) => [...readFileSync(path.join(dir, f), 'utf8').matchAll(/function public\.sp_challenge_publish_missing\([\s\S]*?\n\$\$;/g)].map((m) => m[0]));
    expect(bodies.length).toBeGreaterThan(0);
    const order = [...bodies.at(-1)!.matchAll(/then '([a-z_]+)' end/g)].map((m) => m[1]);
    expect(order).toEqual([...PUBLISH_REQUIREMENTS]);
  });

  it('every item, and every field the new checks raise, has a label in both languages', () => {
    for (const locale of ['es', 'en'] as const) {
      const fields = dictionaries[locale].fields as Record<string, string>;
      for (const key of [...PUBLISH_REQUIREMENTS, 'task_id', 'deliverable_id', 'website']) expect(fields[key], `${locale}.fields.${key}`).toBeTruthy();
      const errors = dictionaries[locale].errors as Record<string, string>;
      expect(errors.challenge_incomplete).toContain('{field}');
      expect(errors.field_required).toContain('{field}');
    }
  });
});
