import { describe,it,expect } from 'vitest';
import { authSchema,parseAction } from '../src/lib/validation';
const id='10000000-0000-4000-8000-000000000001';
describe('Server input boundaries',()=>{
  it('rejects role injection on registration',()=>{expect(()=>authSchema.parse({intent:'signup',email:'user@example.com',password:'long-password',full_name:'User',role:'admin'})).toThrow();});
  it('rejects unknown privileged actions',()=>{expect(()=>parseAction({action:'set_admin',payload:{}})).toThrow();});
  it.each(['javascript:alert(1)','http://example.com','https://user:password@example.com'])('rejects unsafe evidence URL %s',url=>{expect(()=>parseAction({action:'add_evidence',payload:{experience_id:id,title:'Report',description:'Evidence',url,kind:'url',is_public:false}})).toThrow();});
  it('rejects impossible dates and inverted period',()=>{for(const [start_date,end_date] of [['2026-02-31','2026-03-05'],['2026-05-10','2026-04-01']]) expect(()=>parseAction({action:'create_experience',payload:{organization_id:id,title:'Test',description:'An applied experience',responsibilities:'Analyse',deliverables:'Report',start_date,end_date,hours:10,skill_ids:[id]}})).toThrow();});
  it('rejects forged verification/profile flags',()=>{expect(()=>parseAction({action:'update_profile',payload:{full_name:'Test',is_public:true,role:'admin'}})).toThrow();});
  it('accepts minimum valid evidence',()=>{expect(parseAction({action:'add_evidence',payload:{experience_id:id,title:'Report',description:'Evidence',url:'https://example.com/report',kind:'document',is_public:false}}).action).toBe('add_evidence');});
});
