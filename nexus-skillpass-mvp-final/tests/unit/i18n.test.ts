import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dictionaries, fmt } from '@/lib/i18n';
import { GUIDE_STEPS } from '@/lib/guide';

type Tree = { [key: string]: unknown };
function keys(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => keys(v, `${prefix}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value as Tree).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}
function leaves(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(leaves);
  if (value && typeof value === 'object') return Object.values(value as Tree).flatMap(leaves);
  return typeof value === 'string' ? [value] : [];
}

describe('dictionaries', () => {
  it('Spanish and English expose exactly the same keys', () => {
    expect(keys(dictionaries.en).sort()).toEqual(keys(dictionaries.es).sort());
  });

  it('placeholders match between languages', () => {
    const es = keys(dictionaries.es);
    const get = (tree: unknown, key: string) => key.split(/\.|\[(\d+)\]/).filter(Boolean).reduce<unknown>((acc, k) => (acc as Tree)?.[k], tree);
    for (const key of es) {
      const a = String(get(dictionaries.es, key)).match(/\{\w+\}/g)?.sort() ?? [];
      const b = String(get(dictionaries.en, key)).match(/\{\w+\}/g)?.sort() ?? [];
      expect(b, key).toEqual(a);
    }
  });

  it('has no empty messages', () => {
    for (const locale of ['es', 'en'] as const) expect(leaves(dictionaries[locale]).filter((s) => !s.trim())).toEqual([]);
  });

  it('every error key raised by the database has a translation', () => {
    const dir = path.resolve(import.meta.dirname, '../../supabase/migrations');
    const sqlText = readdirSync(dir).map((f) => readFileSync(path.join(dir, f), 'utf8')).join('\n');
    const raised = new Set([...sqlText.matchAll(/sp_(?:raise|forbidden)\('([a-z_]+)'/g)].map((m) => m[1]));
    expect(raised.size).toBeGreaterThan(20);
    for (const locale of ['es', 'en'] as const) {
      const missing = [...raised].filter((k) => !(k in dictionaries[locale].errors));
      expect(missing, locale).toEqual([]);
    }
  });

  it('every notification kind emitted by the database has a template', () => {
    const dir = path.resolve(import.meta.dirname, '../../supabase/migrations');
    const sqlText = readdirSync(dir).map((f) => readFileSync(path.join(dir, f), 'utf8')).join('\n');
    const kinds = new Set([...sqlText.matchAll(/sp_notify\([^,]+,\s*'([a-z_]+)'/g)].map((m) => m[1]));
    expect(kinds.size).toBeGreaterThan(5);
    for (const locale of ['es', 'en'] as const) {
      const templates = dictionaries[locale].notifications.kinds as Record<string, string>;
      expect([...kinds].filter((k) => !(k in templates)), locale).toEqual([]);
    }
  });

  it('the guided demo has a message for each of its 9 steps', () => {
    expect(GUIDE_STEPS).toHaveLength(9);
    for (const locale of ['es', 'en'] as const) expect(dictionaries[locale].demo.guided.steps).toHaveLength(9);
  });

  it('never markets rule-based matching as AI', () => {
    for (const locale of ['es', 'en'] as const) {
      expect(leaves(dictionaries[locale]).filter((s) => /AI Match|IA Match|Match con IA|AI-powered/i.test(s))).toEqual([]);
    }
  });
});

describe('fmt', () => {
  it('replaces known placeholders and leaves unknown ones', () => {
    expect(fmt('{n} de {total} · {x}', { n: 1, total: 9 })).toBe('1 de 9 · {x}');
    expect(fmt('{a}', { a: 0 })).toBe('0');
  });
});
