import {describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createRtcReadOnlyHttpHandler} from '../../src/core/rtc-http.js';
const account='acct_TESTPREFLIGHT';
const token='rtc_pass_'+randomBytes(32).toString('base64url');
const response=()=>({statusCode:200,body:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this;},
  status(s){this.statusCode=s;return this;},
  send(body){this.body=JSON.parse(body);return this;}});
const request=body=>({method:'POST',body,query:{},
  headers:{authorization:'Bearer '+token,
    'content-length':String(Buffer.byteLength(JSON.stringify(body)))}});
async function fixture(){
  const db=createFakeDb({accounts:[{id:account}]});
  await db.saveTestKey({account,label:'TEST',ciphertext:'v1.fake',
    kind:'restricted',last4:'FAKE'});
  await db.createRtcReadOnlyPass({id:'rtc-agent-preflight123',account,token,
    expiresAt:new Date(Date.now()+3600000)});
  let providerReads=0;
  const registry={tools:[{name:'prefetch_read',description:'Safe read',
    area:'account',writes:false,profiles:['read_only'],
    inputSchema:{type:'object',properties:{}}}],
  handlers:{prefetch_read:async()=>{
    providerReads++;
    return {content:[{type:'text',text:JSON.stringify({
      available:true,private:'secret',number:providerReads})}]};
  }}};
  return {handler:createRtcReadOnlyHttpHandler({db,registry}),
    readCount:()=>providerReads};
}
const good={name:'stripe_prefetch_read',args:{fields:['available']}};
describe('RTC batch preflight before any provider reads',()=>{
  it('does not run the first valid read when a later call has invalid details',async()=>{
    const f=await fixture();
    for(const invalid of [
      {name:'stripe_prefetch_read',args:{detail:'wrong'}},
      {name:'stripe_prefetch_read',args:{fields:['available',42]}},
      {name:'stripe_prefetch_read',args:{fields:[]}},
      {name:'stripe_prefetch_read',args:{fields:{field:'available'}}}
    ]){
      const r=response();await f.handler(request({calls:[good,invalid]}),r,'batch');
      expect(r.statusCode).toBe(400);
      expect(r.body.error.code).toBe('invalid_args');
      expect(f.readCount()).toBe(0);
    }
  });
  it('runs every independently valid read with normalized RTC array fields',async()=>{
    const f=await fixture(),r=response();
    await f.handler(request({calls:[good,good]}),r,'batch');
    expect(r.statusCode).toBe(200);
    expect(r.body.result.count).toBe(2);
    expect(f.readCount()).toBe(2);
    expect(r.body.result.results.every(x=>x.result.available===true)).toBe(true);
    expect(r.body.result.results.every(x=>!('private' in x.result))).toBe(true);
  });
});

describe('RTC parsed HTTP body byte-cap provider isolation',()=>{
  it('refuses oversized structured JSON before running any TEST handler',async()=>{
    const f=await fixture();
    const oversized={calls:[good],padding:'x'.repeat(17*1024)};
    const r=response();
    const bad=request(oversized);
    bad.headers['content-length']='2';
    await f.handler(bad,r,'batch');
    expect(r.statusCode).toBe(400);
    expect(r.body.error.code).toBe('invalid_args');
    expect(f.readCount()).toBe(0);
  });
});
