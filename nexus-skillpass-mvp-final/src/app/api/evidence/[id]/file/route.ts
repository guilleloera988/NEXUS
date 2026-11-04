import { NextResponse, type NextRequest } from 'next/server';
import { getSession, read } from '@/lib/server/backend';
import { AppError } from '@/lib/server/errors';
import { evidenceFileResponse } from '@/lib/server/file-response';
import { getMessages } from '@/lib/i18n/server';

/** Evidence file for a signed-in user. Visibility comes from RLS on public.evidence (sp_evidence_file). */
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/evidence/[id]/file'>) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 });
  try {
    const session = await getSession();
    if (!session) return new NextResponse('Unauthorized', { status: 401 });
    const file = await read<{ storage_path: string | null; file_name: string | null; mime_type: string | null; quarantined?: boolean } | null>('sp_evidence_file', { evidence_id: id });
    if (!file?.storage_path) return new NextResponse('Not found', { status: 404 });
    // Never scanned while the antivirus is required: only its owner may open it (Storage RLS says the same).
    if (file.quarantined) {
      const { t } = await getMessages();
      return new NextResponse(t.errors.file_quarantined, { status: 423, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    return await evidenceFileResponse({ ...file, storage_path: file.storage_path }, session.mode === 'demo' ? session.demo.id : null);
  } catch (error) {
    const status = error instanceof AppError ? error.status : 404;
    return new NextResponse(status === 401 ? 'Unauthorized' : 'Not found', { status: status === 401 ? 401 : 404 });
  }
}
