import { NextResponse, type NextRequest } from 'next/server';
import { publicRead } from '@/lib/server/backend';
import { evidenceFileResponse } from '@/lib/server/file-response';
import { isUuid } from '@/lib/server/demo-session';

/** File of evidence the student explicitly published on an active, verifiable credential. */
export async function GET(request: NextRequest, ctx: RouteContext<'/api/public/evidence/[id]'>) {
  const { id } = await ctx.params;
  const demo = request.nextUrl.searchParams.get('demo');
  if (!isUuid(id) || (demo && !isUuid(demo))) return new NextResponse('Not found', { status: 404 });
  try {
    const file = await publicRead<{ storage_path: string; file_name: string | null; mime_type: string | null }>('sp_public_evidence_file', { evidence_id: id }, demo);
    if (!file?.storage_path) return new NextResponse('Not found', { status: 404 });
    return await evidenceFileResponse(file, demo);
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
