import {describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createRtcReadOnlyHttpHandler} from '../../src/core/rtc-http.js';
import {defineWrite} from '../../src/tools/write.js';
const A='acct_RTCOWNER26';
const makeToken=()=> 'rtc_pass_'+randomBytes(32).toString('base64url');
function req(token,method='GET',body,query={}){
  const serialized=body===undefined?null:JSON.stringify(body);
  return {method,query,body,headers:{authorization:'Bearer '+token,
    ...(serialized?{'content-length':String(Buffer.byteLength(serialized))}:{})}};
}
function res(){return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},
  send(body){this.body=JSON.parse(body);return this;}};}
async function fixture({allowWrites=false,rate=120,moneyLimitCents=0,profile='full'}={}){
  const db=createFakeDb({accounts:[{id:A}]});
  await db.saveTestKey({account:A,label:'TEST',ciphertext:'v1.mock',
    kind:'restricted',last4:'FAKE'});
  const token=makeToken(),store={id:'obj_RTCTEST',livemode:false,
    metadata:{note:'before'}};
  let applied=0;
  const native=defineWrite({
    name:'rtc_fixture_safe_write',
    read:async()=>({...store,metadata:{...store.metadata}}),
    summarize:()=> 'TEST guarded nonmoney settings update',
    apply:async()=>{applied++;store.metadata.note='after';},
    readAfter:async()=>({...store,metadata:{...store.metadata}}),
    verify:(_before,after)=>after.id===store.id&&
      after.metadata.note==='after',
    resultId:(_before,after)=>after.id
  });
  const writeTool={...native.tool,name:'rtc_fixture_safe_write',
    area:'payments',profiles:['full'],writes:true,
    writeContract:'defineWrite-v1',safety:'P',moneySpec:null};
  const readTool={name:'stripe_whoami',area:'server',writes:false,
    profiles:['read_only','everyday','full'],
    description:'Read selected TEST identity',inputSchema:{type:'object',properties:{}}};
  const registry={tools:[readTool,writeTool],
    handlers:{stripe_whoami:async(_a,ctx)=>({content:[{type:'text',
      text:JSON.stringify({account:ctx.connection.stripeAccount,mode:'test'})}]}),
    rtc_fixture_safe_write:native.handler}};
  await db.createRtcPass({id:'rtc-agent-ownerfixed',account:A,token,
    mode:'test',profile,areas:['server','payments'],allowWrites,moneyLimitCents,
    rateLimitPerMinute:rate,expiresAt:new Date(Date.now()+86_400_000)});
  return {db,token,registry,handler:createRtcReadOnlyHttpHandler({db,registry}),
    applied:()=>applied};
}
describe('R-2 HTTPS calls preserve native original TEST writer boundaries',()=>{
  it('passes owner-selected write preview+confirm through original native defineWrite with readback',async()=>{
    const f=await fixture({allowWrites:true});
    const who=res();
    await f.handler(req(f.token),who,'whoami');
    expect(who.body).toMatchObject({ok:true,
      result:{mode:'test',profile:'full',allowWrites:true}});
    const catalog=res();
    await f.handler(req(f.token,'GET',undefined,{listing:'catalog'}),catalog,'catalog');
    expect(catalog.body.result.tools).toEqual(expect.arrayContaining([
      expect.objectContaining({name:'stripe_rtc_fixture_safe_write',writes:true})
    ]));
    const preview=res();
    await f.handler(req(f.token,'POST',{}),preview,'call',
      'stripe_rtc_fixture_safe_write');
    expect(preview.statusCode).toBe(200);
    expect(preview.body.result).toMatchObject({done:false,needsConfirmation:true});
    expect(f.applied()).toBe(0);
    const confirmed=res();
    await f.handler(req(f.token,'POST',{confirm:true,requestKey:'rtc-original-guard'}),
      confirmed,'call','stripe_rtc_fixture_safe_write');
    expect(confirmed.body.result).toMatchObject({done:true,confirmed:true});
    expect(f.applied()).toBe(1);
  });
  it('denies writes on otherwise full pass without explicit allowWrites, even nested in batch',async()=>{
    const f=await fixture({allowWrites:false});
    for(const [route,name,body] of [
      ['call','stripe_rtc_fixture_safe_write',{}],
      ['batch',undefined,{calls:[{name:'stripe_rtc_fixture_safe_write',args:{}}]}]
    ]){
      const result=res();
      await f.handler(req(f.token,'POST',body),result,route,name);
      expect(result.statusCode).toBe(route==='call'?403:400);
      expect(result.body.ok).toBe(false);
    }
    expect(f.applied()).toBe(0);
  });
  it('enforces selected pass rate atomically across two handler instances sharing one database',async()=>{
    const f=await fixture({allowWrites:false,rate:5});
    const second=createRtcReadOnlyHttpHandler({db:f.db,registry:f.registry});
    const calls=Array.from({length:12},(_,i)=>{
      const output=res();
      const handler=i%2?f.handler:second;
      return handler(req(f.token),output,'whoami').then(()=>output);
    });
    const done=await Promise.all(calls);
    expect(done.filter(x=>x.statusCode===200)).toHaveLength(5);
    expect(done.filter(x=>x.statusCode===429)).toHaveLength(7);
    expect(done.filter(x=>x.statusCode===429).every(x=>
      x.body.error.code==='rate_limited'&&x.headers['Retry-After']==='60'))
      .toBe(true);
  });
});
