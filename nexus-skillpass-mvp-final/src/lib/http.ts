import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class AppError extends Error { constructor(message:string, public status=400) { super(message); } }
export function json(value:unknown,status=200) { return NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow'}}); }
export function errorResponse(error:unknown) {
  if(error instanceof AppError) return json({error:error.message},error.status);
  if(error instanceof ZodError) return json({error:'Revisa los datos: '+error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')},400);
  console.error('NEXUS request failed', error instanceof Error ? error.message : 'unknown error');
  return json({error:'No se pudo completar la operación. Intenta de nuevo.'},500);
}
export async function readBody(request:NextRequest) {
  const origin=request.headers.get('origin');
  const allowed=process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.headers.get('host') || request.nextUrl.host}`;
  if(!origin || origin !== new URL(allowed).origin) throw new AppError('Solicitud de otro origen no permitida.',403);
  if(!request.headers.get('content-type')?.startsWith('application/json')) throw new AppError('Se requiere JSON.',415);
  if(Number(request.headers.get('content-length')||0)>24000) throw new AppError('Solicitud demasiado grande.',413);
  const reader=request.body?.getReader();
  if(!reader)throw new AppError('JSON inválido.');
  const chunks:Uint8Array[]=[];
  let length=0;
  while(true){
    const {value,done}=await reader.read();
    if(done)break;
    length+=value.byteLength;
    if(length>24000){await reader.cancel();throw new AppError('Solicitud demasiado grande.',413);}
    chunks.push(value);
  }
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; } catch { throw new AppError('JSON inválido.'); }
}
const buckets=new Map<string,{count:number,until:number}>();
export function rateLimit(key:string,limit:number,windowMs=60000) {
  const now=Date.now();
  if(buckets.size>5000) for(const [k,v] of buckets) if(v.until<now) buckets.delete(k);
  const entry=buckets.get(key);
  if(!entry || entry.until<now) { buckets.set(key,{count:1,until:now+windowMs}); return; }
  entry.count++;
  if(entry.count>limit) throw new AppError('Demasiadas solicitudes. Espera un momento.',429);
}
