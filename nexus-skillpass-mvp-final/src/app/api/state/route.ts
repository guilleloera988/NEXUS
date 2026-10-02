import { sessionBackend, databaseError } from '@/lib/backend';
import { errorResponse,json } from '@/lib/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET() {
  try {
    const backend=await sessionBackend();
    let snapshot;
    try { snapshot=await backend.rpc('nexus_snapshot'); } catch(error) { throw databaseError(error); }
    return json({mode:backend.mode,snapshot,demoId:backend.demoId});
  } catch(error) { return errorResponse(error); }
}
