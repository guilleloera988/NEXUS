import 'server-only';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UPLOAD_TYPES } from '@/lib/constants';
import type { Session } from './backend';
import { demoUploadsDir } from './demo-db';
import { maxUploadBytes } from './env';
import { AppError } from './errors';
import { supabaseServer } from './supabase';

const BUCKET = 'evidence';

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
      return !bytes.subarray(0, 4096).includes(0);
    default:
      return false;
  }
}

export function safeFileName(name: string) {
  const ext = (name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  const base = name.replace(/\.[^.]*$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'evidencia';
  return ext ? `${base}.${ext}` : base;
}

export interface StoredFile {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: string;
}

export async function storeEvidenceFile(session: Session, challengeId: string, file: File): Promise<StoredFile> {
  if (!file || typeof file.arrayBuffer !== 'function' || file.size === 0) throw new AppError('evidence_source_required', 400, 'file');
  if (file.size > maxUploadBytes()) throw new AppError('file_too_large', 413, 'file');
  const type = UPLOAD_TYPES[file.type];
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!type || !type.ext.includes(ext)) throw new AppError('invalid_file_type', 415, 'file');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!contentMatchesType(bytes, file.type)) throw new AppError('file_mismatch', 415, 'file');

  const name = safeFileName(file.name);
  const storagePath = `${session.userId}/${challengeId}/${randomBytes(4).toString('hex')}-${name}`;
  if (session.mode === 'demo') {
    const target = path.join(demoUploadsDir(session.demo.id), storagePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx' });
  } else {
    const supabase = await supabaseServer();
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, { contentType: file.type, upsert: false });
    if (error) {
      console.error('[skillpass] storage upload failed', error.message);
      throw new AppError('forbidden', 403, 'file');
    }
  }
  return { storage_path: storagePath, file_name: file.name.slice(0, 200), mime_type: file.type, size_bytes: file.size, kind: type.kind };
}

export async function removeEvidenceFile(session: Session, storagePath: string | null | undefined) {
  if (!storagePath) return;
  try {
    if (session.mode === 'demo') {
      await rm(resolveDemoPath(session.demo.id, storagePath), { force: true });
    } else {
      const supabase = await supabaseServer();
      await supabase.storage.from(BUCKET).remove([storagePath]);
    }
  } catch (error) {
    console.error('[skillpass] could not remove file', error instanceof Error ? error.message : error);
  }
}

function resolveDemoPath(demoId: string, storagePath: string) {
  const root = path.resolve(demoUploadsDir(demoId));
  const target = path.resolve(root, storagePath);
  if (!target.startsWith(root + path.sep)) throw new AppError('forbidden', 403);
  return target;
}

export async function readDemoFile(demoId: string, storagePath: string) {
  return readFile(resolveDemoPath(demoId, storagePath));
}

/** Short-lived signed URL; Storage RLS decides whether the caller may read the object. */
export async function signedEvidenceUrl(storagePath: string) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) throw new AppError('not_found', 404);
  return data.signedUrl;
}
