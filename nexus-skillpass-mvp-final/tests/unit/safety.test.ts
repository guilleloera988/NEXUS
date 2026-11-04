import { describe, expect, it } from 'vitest';
import { contentMatchesType, csvField, safeFileName, safeNextPath, toCsv } from '@/lib/safety';

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])));

describe('safeNextPath (open-redirect guard)', () => {
  it('keeps same-origin relative paths with query and hash', () => {
    expect(safeNextPath('/workspace/abc?tab=evidence#x')).toBe('/workspace/abc?tab=evidence#x');
    expect(safeNextPath('/dashboard?guide=1')).toBe('/dashboard?guide=1');
  });
  it.each([
    'https://evil.example', '//evil.example', '/\\evil.example', '\\\\evil.example', '/\t/evil.example', '/\n/evil.example',
    'javascript:alert(1)', 'evil.example', '', null, undefined, `/${'a'.repeat(600)}`,
  ])('rejects %j', (value) => {
    expect(safeNextPath(value as string)).toBe('/dashboard');
  });
  it('supports a custom fallback', () => {
    expect(safeNextPath('https://evil.example', '/demo')).toBe('/demo');
  });
});

describe('CSV export', () => {
  it('quotes fields and escapes quotes', () => {
    expect(csvField('Ana "La" Pérez')).toBe('"Ana ""La"" Pérez"');
    expect(csvField(null)).toBe('""');
    expect(csvField(12.5)).toBe('"12.5"');
  });
  it.each(['=HYPERLINK("x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd'])('neutralizes formula %j', (value) => {
    expect(csvField(value).startsWith(`"'`)).toBe(true);
  });
  it('builds a BOM-prefixed CRLF document', () => {
    expect(toCsv([['a', 'b'], [1, true]])).toBe('﻿"a","b"\r\n"1","true"');
  });
});

describe('upload content sniffing', () => {
  it('accepts real signatures', () => {
    expect(contentMatchesType(bytes('%PDF-1.7'), 'application/pdf')).toBe(true);
    expect(contentMatchesType(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a), 'image/png')).toBe(true);
    expect(contentMatchesType(bytes(0xff, 0xd8, 0xff, 0xe0), 'image/jpeg')).toBe(true);
    expect(contentMatchesType(bytes('RIFF', 0, 0, 0, 0, 'WEBP'), 'image/webp')).toBe(true);
    expect(contentMatchesType(bytes('PK', 3, 4), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    expect(contentMatchesType(bytes('hola, mundo'), 'text/plain')).toBe(true);
  });
  it('rejects renamed or binary content', () => {
    expect(contentMatchesType(bytes('MZ', 0x90, 0), 'application/pdf')).toBe(false);
    expect(contentMatchesType(bytes('%PDF'), 'image/png')).toBe(false);
    expect(contentMatchesType(bytes('<html><script>'), 'image/jpeg')).toBe(false);
    expect(contentMatchesType(bytes('abc', 0, 'def'), 'text/csv')).toBe(false);
    expect(contentMatchesType(bytes(), 'text/plain')).toBe(false);
  });
  it('rejects types outside the allow-list', () => {
    expect(contentMatchesType(bytes('<svg onload=alert(1)>'), 'image/svg+xml')).toBe(false);
    expect(contentMatchesType(bytes('<html>'), 'text/html')).toBe(false);
  });
});

describe('safeFileName', () => {
  it('normalizes accents, spaces and separators', () => {
    expect(safeFileName('Presentación Final (v2).PDF')).toBe('presentacion-final-v2.pdf');
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\Users\\ana\\cv final.pdf')).toBe('cv-final.pdf');
    expect(safeFileName('.env')).toBe('env');
    expect(safeFileName('???.png')).toBe('evidencia.png');
    expect(safeFileName('README')).toBe('readme');
  });
  it('bounds length', () => {
    expect(safeFileName(`${'x'.repeat(300)}.docx`).length).toBeLessThanOrEqual(85);
  });
});
