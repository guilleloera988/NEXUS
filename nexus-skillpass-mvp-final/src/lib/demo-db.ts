import { PGlite } from '@electric-sql/pglite';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from './http';
import { demoRoot, isDemoEnabled, isUuid } from './demo-session';

const globalDemo=globalThis as unknown as {nexusDbs?:Map<string,Promise<PGlite>>; nexusDemoQueue?:Promise<unknown>};
const databases=globalDemo.nexusDbs ||= new Map();
// Serialize the local demo's operations so an idle database can be closed safely.
// Production Supabase concurrency is unaffected by this local resource bound.
function serial<T>(job:()=>Promise<T>):Promise<T> {
  const next=(globalDemo.nexusDemoQueue||Promise.resolve()).catch(()=>undefined).then(job);
  globalDemo.nexusDemoQueue=next.catch(()=>undefined);
  return next;
}
async function openDemoDb(id:string,create=false):Promise<PGlite> {
  if(!isDemoEnabled()) throw new AppError('DEMO local deshabilitada en este despliegue.',503);
  if(!isUuid(id)) throw new AppError('DEMO inválida.',404);
  const dir=path.join(demoRoot(),id);
  if(!databases.has(id)) {
    const open=(async()=>{
      if(databases.size>=3){
        const oldest=databases.keys().next().value;
        if(oldest){const idle=databases.get(oldest)!;databases.delete(oldest);await (await idle).close();}
      }
      if(!create) { try { await stat(path.join(dir,'PG_VERSION')); } catch { throw new AppError('Esta DEMO no existe o expiró. Abre /demo para comenzar.',404); } }
      await mkdir(demoRoot(),{recursive:true});
      if(create) {
        const dirs=(await readdir(demoRoot(),{withFileTypes:true})).filter(f=>f.isDirectory());
        if(dirs.length>=Number(process.env.NEXUS_DEMO_MAX_SESSIONS||30)) throw new AppError('Se alcanzó la capacidad local de DEMO. Consulta la limpieza en README.',503);
      }
      const db=new PGlite(dir);
      await db.waitReady;
      try {
        const check=await db.query<{exists:boolean}>("select to_regclass('public.profiles') is not null as exists");
        const existing=Boolean(check.rows[0]?.exists);
        const manifest=path.join(dir,'.nexus-migrations.json');
        let applied:string[]=[];
        try { applied=JSON.parse(await readFile(manifest,'utf8')) as string[]; }
        catch {
          if(existing){
            applied=['202609290001_nexus.sql'];
            const v2=await db.query<{exists:boolean}>("select to_regclass('public.student_skills') is not null as exists");
            if(v2.rows[0]?.exists)applied.push('202609290002_observability.sql');
          }
        }
        if(!existing)await db.exec(await readFile(path.join(process.cwd(),'supabase','demo-bootstrap.sql'),'utf8'));
        const files=(await readdir(path.join(process.cwd(),'supabase','migrations'))).filter(f=>f.endsWith('.sql')).sort();
        for(const file of files)if(!applied.includes(file)){
          const source=await readFile(path.join(process.cwd(),'supabase','migrations',file),'utf8');
          await db.transaction(async tx=>{await tx.exec(source);});
          applied.push(file);
          await writeFile(manifest,JSON.stringify(applied));
        }
        if(!existing)await db.exec(await readFile(path.join(process.cwd(),'supabase','seed.sql'),'utf8'));
      } catch(error) { await db.close(); throw error; }
      return db;
    })();
    databases.set(id,open);
    open.catch(()=>databases.delete(id));
  }
  return databases.get(id)!;
}
export async function demoDb(id:string,create=false):Promise<void> {await serial(async()=>{await openDemoDb(id,create);});}
export async function demoRpc(id:string,actor:string|null,fn:'nexus_snapshot'|'nexus_action'|'nexus_public_skillpass'|'nexus_public_credential',params:unknown[]=[]) {
  return serial(async()=>{
  const db=await openDemoDb(id);
  return db.transaction(async tx=>{
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)",[actor||'']);
    await tx.exec(actor?'set local role authenticated':'set local role anon');
    const args=fn==='nexus_action'?'$1::text,$2::jsonb':fn==='nexus_public_credential'?'$1::uuid':fn==='nexus_public_skillpass'?'$1::text':'';
    const result=await tx.query<{result:unknown}>(`select public.${fn}(${args}) as result`,params);
    return result.rows[0]?.result??null;
  });
  });
}
