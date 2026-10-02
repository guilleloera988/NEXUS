import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Role } from './types';
import { AppError } from './http';

export const DEMO_COOKIE='nexus_demo';
export const DEMO_TTL=8*60*60;
export const isDemoEnabled=()=>process.env.NEXUS_DEMO_ENABLED!=='false' && !process.env.VERCEL;
export const demoRoot=()=>path.resolve(process.env.NEXUS_DEMO_DATA_DIR || '.demo-data');
export const isUuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export interface DemoSession { id:string; role:Role; exp:number }
let keyPromise:Promise<string>|undefined;
async function secret() {
  if(process.env.NEXUS_DEMO_SECRET && process.env.NEXUS_DEMO_SECRET.length>=32) return process.env.NEXUS_DEMO_SECRET;
  if(process.env.NODE_ENV==='production') throw new AppError('DEMO no configurada: define NEXUS_DEMO_SECRET de al menos 32 caracteres o usa desarrollo local.',503);
  if(!keyPromise) keyPromise=(async()=>{
    await mkdir(demoRoot(),{recursive:true});
    const file=path.join(demoRoot(),'.session-key');
    try { return await readFile(file,'utf8'); } catch {
      const value=randomBytes(48).toString('hex');
      try { await writeFile(file,value,{flag:'wx',mode:0o600}); return value; }
      catch { return readFile(file,'utf8'); }
    }
  })();
  return keyPromise;
}
export async function signDemo(id:string,role:Role) {
  const session:DemoSession={id,role,exp:Math.floor(Date.now()/1000)+DEMO_TTL};
  const payload=Buffer.from(JSON.stringify(session)).toString('base64url');
  return payload+'.'+createHmac('sha256',await secret()).update(payload).digest('base64url');
}
export async function verifyDemo(token:string|undefined):Promise<DemoSession|null> {
  if(!token || !isDemoEnabled() || token.length>1024) return null;
  try {
    const [payload,mac,...rest]=token.split('.');
    if(!payload || !mac || rest.length) return null;
    const expected=createHmac('sha256',await secret()).update(payload).digest();
    const actual=Buffer.from(mac,'base64url');
    if(actual.length!==expected.length || !timingSafeEqual(actual,expected)) return null;
    const session=JSON.parse(Buffer.from(payload,'base64url').toString()) as DemoSession;
    if(!isUuid(session.id) || !['student','supervisor','university','admin'].includes(session.role) || !Number.isFinite(session.exp) || session.exp<Date.now()/1000) return null;
    return session;
  } catch { return null; }
}
export const newDemoId=()=>randomUUID();
