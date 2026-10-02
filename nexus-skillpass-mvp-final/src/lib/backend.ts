import { cookies } from 'next/headers';
import { DEMO_COOKIE, verifyDemo, isUuid } from './demo-session';
import { demoRpc } from './demo-db';
import { DEMO_USERS, type Snapshot } from './types';
import { supabaseServer } from './supabase';
import { AppError } from './http';

export async function sessionBackend() {
  const demo=await verifyDemo((await cookies()).get(DEMO_COOKIE)?.value);
  if(demo) return {mode:'demo' as const,demoId:demo.id,rpc:async(fn:'nexus_snapshot'|'nexus_action',params:Record<string,unknown>={})=>demoRpc(demo.id,DEMO_USERS[demo.role],fn,fn==='nexus_action'?[params.action,JSON.stringify(params.payload)]:[])};
  const supabase=await supabaseServer();
  const {data,error}=await supabase.auth.getUser();
  if(error || !data.user) throw new AppError('Inicia sesión para continuar.',401);
  return {mode:'supabase' as const,demoId:undefined,rpc:async(fn:'nexus_snapshot'|'nexus_action',params:Record<string,unknown>={})=>{
    const {data,error}=await supabase.rpc(fn,params);
    if(error) throw databaseError(error);
    return data;
  }};
}
export function databaseError(error:unknown):AppError {
  const e=error as {code?:string;message?:string};
  if(e instanceof AppError) return e;
  if(e.code==='42501' || e.code==='P0001') return new AppError(e.message || 'Operación no autorizada.',403);
  if(e.code?.startsWith('22') || e.code?.startsWith('23') || e.code==='P0002') return new AppError('Datos inválidos, duplicados o estado incompatible. Actualiza la página y revisa los campos.',400);
  console.error('Database operation failed',e.code,e.message);
  return new AppError('La base de datos no pudo completar la operación.',500);
}
export async function publicSnapshot(kind:'slug'|'credential',value:string,demoId:string|null) {
  if(kind==='credential' && !isUuid(value)) return {mode:demoId?'demo':'supabase',snapshot:null};
  if(value.length>180) throw new AppError('Identificador inválido.',400);
  const fn=kind==='slug'?'nexus_public_skillpass':'nexus_public_credential';
  let snapshot:unknown;
  if(demoId) snapshot=await demoRpc(demoId,null,fn,[value]);
  else {
    const supabase=await supabaseServer();
    const {data,error}=await supabase.rpc(fn,kind==='slug'?{p_slug:value}:{p_id:value});
    if(error) throw databaseError(error);
    snapshot=data;
  }
  return {mode:demoId?'demo':'supabase',snapshot:snapshot as Snapshot|null,demoId:demoId||undefined};
}
