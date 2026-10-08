import 'server-only';
import { NextResponse } from 'next/server';
import { readDemoFile, signedEvidenceUrl } from './storage';

const INLINE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/**
 * Streams an evidence file. Inline only for PDF/images; everything else downloads.
 * A restrictive CSP sandbox prevents uploaded content from executing in our origin.
 */
export async function evidenceFileResponse(file: { storage_path: string; file_name: string | null; mime_type: string | null }, demoId: string | null) {
  if (!demoId) return NextResponse.redirect(await signedEvidenceUrl(file.storage_path), 302);
  const bytes = await readDemoFile(demoId, file.storage_path);
  const mime = file.mime_type ?? 'application/octet-stream';
  const name = (file.file_name ?? 'evidence').replace(/[^\w.\- ]/g, '_');
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `${INLINE.has(mime) ? 'inline' : 'attachment'}; filename="${name}"`,
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
