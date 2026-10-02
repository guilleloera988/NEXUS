import { NextRequest } from 'next/server';
import { sessionBackend,databaseError } from '@/lib/backend';
import { errorResponse,json,rateLimit,readBody } from '@/lib/http';
import { parseAction } from '@/lib/validation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest) {
  try {
    const {action,payload}=parseAction(await readBody(request));
    const backend=await sessionBackend();
    rateLimit('action:'+(backend.demoId||request.headers.get('x-forwarded-for')||'local'),120);
    let result;
    try { result=await backend.rpc('nexus_action',{action,payload}); } catch(error) { throw databaseError(error); }
    return json({result});
  } catch(error) { return errorResponse(error); }
}
