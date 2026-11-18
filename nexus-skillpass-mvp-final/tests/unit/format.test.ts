import { describe, expect, it } from 'vitest';
import { formatBytes, formatDate, formatHours, formatRelative, initials } from '@/lib/format';

describe('formatting', () => {
  it('formats calendar dates without timezone drift', () => {
    expect(formatDate('es', '2026-01-01')).toBe('1 ene 2026');
    expect(formatDate('en', '2026-12-31', 'long')).toBe('December 31, 2026');
    expect(formatDate('es', 'no-date')).toBe('—');
    expect(formatDate('es', null)).toBe('—');
  });
  it('formats fractional VATH hours', () => {
    expect(formatHours('es', 12.5)).toBe('12.5');
    expect(formatHours('en', '7.25')).toBe('7.25');
    expect(formatHours('es', null)).toBe('0');
  });
  it('formats relative times', () => {
    const now = Date.parse('2026-10-02T12:00:00Z');
    expect(formatRelative('en', '2026-10-02T11:30:00Z', now)).toBe('30 minutes ago');
    expect(formatRelative('es', '2026-10-01T12:00:00Z', now)).toBe('ayer');
  });
  it('builds initials ignoring academic titles', () => {
    expect(initials('Dra. Elena Vázquez')).toBe('EV');
    expect(initials('María Torres')).toBe('MT');
  });
  it('formats file sizes', () => {
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
