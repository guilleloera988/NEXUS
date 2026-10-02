import { afterAll,beforeAll,describe,it,expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdir,mkdtemp,readFile,realpath,rm } from 'node:fs/promises';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { demoDb,demoRpc } from '../src/lib/demo-db';
import { DEMO_USERS,type Snapshot } from '../src/lib/types';
let root:string;
const base=path.resolve('.demo-data');
const previous=process.env.NEXUS_DEMO_DATA_DIR;
beforeAll(async()=>{await mkdir(base,{recursive:true});root=await mkdtemp(path.join(base,'test-runtime-'));process.env.NEXUS_DEMO_DATA_DIR=root;});
afterAll(async()=>{
 const cache=(globalThis as {nexusDbs?:Map<string,Promise<PGlite>>}).nexusDbs;
 if(cache){for(const pending of cache.values())await (await pending).close();cache.clear();}
 if(previous===undefined)delete process.env.NEXUS_DEMO_DATA_DIR;else process.env.NEXUS_DEMO_DATA_DIR=previous;
 const target=await realpath(root),safeBase=await realpath(base);
 if(path.dirname(target)!==safeBase||!path.basename(target).startsWith('test-runtime-'))throw Error('Refusing unsafe test cleanup');
 await rm(target,{recursive:true});
});
describe('Persistent isolated DEMO runtime',()=>{
 it('persists writes, applies all migrations, bounds open databases and isolates public access',async()=>{
  const first=randomUUID();await demoDb(first,true);
  await demoRpc(first,DEMO_USERS.student,'nexus_action',['update_profile',JSON.stringify({full_name:'Persisted DEMO Student',is_public:true})]);
  const second=randomUUID();await demoDb(second,true);
  const isolated=await demoRpc(second,DEMO_USERS.student,'nexus_snapshot') as Snapshot;
  expect(isolated.profile?.full_name).toBe('Ana Martínez');
  await demoDb(randomUUID(),true);await demoDb(randomUUID(),true);
  const cache=(globalThis as {nexusDbs?:Map<string,Promise<PGlite>>}).nexusDbs!;
  expect(cache.size).toBeLessThanOrEqual(3);expect(cache.has(first)).toBe(false);
  const restored=await demoRpc(first,DEMO_USERS.student,'nexus_snapshot') as Snapshot;
  expect(restored.profile?.full_name).toBe('Persisted DEMO Student');
  const publicData=await demoRpc(first,null,'nexus_public_skillpass',['ana-martinez-demo']) as Snapshot;
  expect(publicData.profile?.full_name).toBe('Persisted DEMO Student');
  expect(publicData.evidence.every(e=>e.is_public)).toBe(true);
  const applied=JSON.parse(await readFile(path.join(root,first,'.nexus-migrations.json'),'utf8'));
  expect(applied).toContain('202609300003_security.sql');
  await expect(demoRpc(first,null,'nexus_snapshot')).rejects.toThrow();
 });
});
