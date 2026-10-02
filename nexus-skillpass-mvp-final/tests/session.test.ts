import { describe,it,expect } from 'vitest';
import { signDemo,verifyDemo } from '../src/lib/demo-session';
describe('Isolated demo sessions',()=>{
  it('authenticates signed roles but rejects tampering and public IDs',async()=>{
    const id='10000000-0000-4000-8000-000000000001';
    const token=await signDemo(id,'student');
    expect((await verifyDemo(token))?.role).toBe('student');
    expect(await verifyDemo(id)).toBeNull();
    const [payload,mac]=token.split('.');
    const forged=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(payload,'base64url').toString()),role:'admin'})).toString('base64url');
    expect(await verifyDemo(forged+'.'+mac)).toBeNull();
  });
});
