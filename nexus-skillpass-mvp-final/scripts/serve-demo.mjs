import { randomBytes } from 'node:crypto';
import { mkdir,readFile,writeFile,stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
if(process.env.VERCEL)throw Error('La DEMO de disco no es compatible con Vercel.');
await stat('.next/BUILD_ID').catch(()=>{throw Error('Ejecuta npm run build antes de npm run demo:serve.');});
const root=path.resolve(process.env.NEXUS_DEMO_DATA_DIR||'.demo-data');
await mkdir(root,{recursive:true});
const keyPath=path.join(root,'.session-key');
let key=process.env.NEXUS_DEMO_SECRET;
if(!key||key.length<32){
 try{key=await readFile(keyPath,'utf8');}catch{key=randomBytes(48).toString('hex');await writeFile(keyPath,key,{flag:'wx',mode:0o600});}
}
if(key.length<32)throw Error('La clave local de DEMO no es válida.');
const require=createRequire(import.meta.url);
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',process.env.PORT||'3000'],{stdio:'inherit',env:{...process.env,NEXUS_DEMO_ENABLED:'true',NEXUS_DEMO_SECRET:key}});
child.on('exit',code=>process.exit(code||0));
process.on('SIGINT',()=>child.kill('SIGINT'));
process.on('SIGTERM',()=>child.kill('SIGTERM'));
