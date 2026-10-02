import { NextRequest } from 'next/server';
import { publicSnapshot } from '@/lib/backend';
import { AppError,errorResponse,json,rateLimit } from '@/lib/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest) {
  try {
    rateLimit('public:'+(request.headers.get('x-forwarded-for')||'local'),180);
    const query=request.nextUrl.searchParams;
    const slug=query.get('slug'),credential=query.get('credential');
    if((!slug&&!credential)||(slug&&credential)) throw new AppError('Especifica una credencial o un SkillPass.');
    return json(await publicSnapshot(slug?'slug':'credential',(slug||credential)!,query.get('demo')));
  } catch(error) { return errorResponse(error); }
}
