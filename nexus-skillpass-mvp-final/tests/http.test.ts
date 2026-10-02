import { describe,it,expect } from 'vitest';
import { NextRequest } from 'next/server';
import { readBody } from '../src/lib/http';
describe('HTTP origin and bounded JSON bodies',()=>{
 const make=(body:string,origin='http://127.0.0.1:3000')=>new NextRequest('http://localhost:3000/api/actions',{method:'POST',headers:{origin,host:'127.0.0.1:3000','content-type':'application/json'},body});
 it('accepts the browser Host origin despite internal Next origin normalization',async()=>{await expect(readBody(make('{"value":"dato"}'))).resolves.toEqual({value:'dato'});});
 it('rejects a hostile origin',async()=>{await expect(readBody(make('{}','https://attacker.example'))).rejects.toMatchObject({status:403});});
 it('limits bytes even with missing content-length and multibyte input',async()=>{await expect(readBody(make(JSON.stringify({text:'ñ'.repeat(13000)})))).rejects.toMatchObject({status:413});});
 it('reports malformed JSON safely',async()=>{await expect(readBody(make('{'))).rejects.toMatchObject({status:400});});
});
