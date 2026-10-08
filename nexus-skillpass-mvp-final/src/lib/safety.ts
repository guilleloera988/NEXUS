/*
 * Small pure guards shared by Server Actions, route handlers and pages.
 * Kept free of server-only imports so they are unit-tested directly.
 */

const SENTINEL = 'http://next.invalid';

/** Same-origin relative path for post-login/demo redirects; anything else falls back. Blocks open redirects. */
export function safeNextPath(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || value.length > 512) return fallback;
  // Browsers drop tabs/newlines and treat "\" like "/", so "/\t/evil" or "/\evil" could become "//evil".
  if (!value.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(value) || value.startsWith('//')) return fallback;
  try {
    const url = new URL(value, SENTINEL);
    if (url.origin !== SENTINEL) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** One CSV field: always quoted, and spreadsheet formulas are neutralized (CSV injection). */
export function csvField(value: unknown): string {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV document with a UTF-8 BOM so spreadsheet apps read accents correctly. */
export function toCsv(rows: unknown[][]): string {
  return '﻿' + rows.map((row) => row.map(csvField).join(',')).join('\r\n');
}

/** Verifies the file content matches the declared type (magic numbers), so a renamed binary is rejected. */
export function contentMatchesType(bytes: Uint8Array, mime: string): boolean {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  const ascii = (offset: number, value: string) => [...value].every((ch, i) => bytes[offset + i] === ch.charCodeAt(0));
  switch (mime) {
    case 'application/pdf': return ascii(0, '%PDF');
    case 'image/png': return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'image/jpeg': return starts(0xff, 0xd8, 0xff);
    case 'image/gif': return ascii(0, 'GIF87a') || ascii(0, 'GIF89a');
    case 'image/webp': return ascii(0, 'RIFF') && ascii(8, 'WEBP');
    case 'application/zip':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return starts(0x50, 0x4b, 0x03, 0x04);
    case 'application/msword':
    case 'application/vnd.ms-powerpoint':
    case 'application/vnd.ms-excel':
      return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    case 'text/plain':
    case 'text/csv':
      return bytes.length > 0 && !bytes.subarray(0, 4096).includes(0);
    default:
      return false;
  }
}

/** ASCII-only, lowercase storage name that keeps a short extension. */
export function safeFileName(name: string): string {
  const leaf = name.split(/[\\/]/).pop() ?? '';
  const dot = leaf.lastIndexOf('.');
  const ext = dot > 0 ? leaf.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : '';
  const base = (dot > 0 ? leaf.slice(0, dot) : leaf).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'evidencia';
  return ext ? `${base}.${ext}` : base;
}
