import { describe, expect, it } from 'vitest';
import { errorText } from '@/components/ui/form';
import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';

describe('errorText', () => {
  const state = (error: string, field?: string) => ({ ok: false as const, error, field, at: 1 });

  it('names the missing publish item when the database reports it', () => {
    expect(errorText(es, state('challenge_incomplete', 'conditions'))).toBe('Al reto le falta: condiciones de participación (necesario para publicarlo o mantenerlo publicado).');
    expect(errorText(en, state('field_required', 'task_id'))).toBe('Fill in the required field: related task.');
  });

  it('falls back to the full list when the database does not say which item is missing', () => {
    // Databases without migration 20261015000001 raise challenge_incomplete without DETAIL.
    expect(errorText(es, state('challenge_incomplete'))).toBe(es.errors.challenge_incomplete_any);
    expect(errorText(en, state('challenge_incomplete'))).toBe(en.errors.challenge_incomplete_any);
  });
});
