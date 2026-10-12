import {describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createRtcReadOnlyHttpHandler,rtcManifest,rtcOpenApi}
  from '../../src/core/rtc-http.js';
const account='acct_TESTHTTPRTC';
const pass='rtc_pass_'+randomBytes(32).toString('base64url');
const tools=[
  {name:'stripe_whoami',description:'Read TEST owner identity',
    area:'server',writes:false,profiles:['read_only'],inputSchema:{type:'object',properties:{}}},
  {name:'account_get',description:'Read account details',area:'account',
    writes:false,profiles:['read_only'],inputSchema:{type:'object',properties:{}}},
  {name:'unsafe_write',description:'Update payment',area:'payments',
    writes:true,profiles:['read_only'],inputSchema:{type:'object',properties:{}}}
];
const registry={tools,handlers:{
  stripe_whoami:async(_args,{connection})=>({content:[{type:'text',text:JSON.stringify({
    mode:connection.mode,profile:connection.profile})}]}),
  account_get:async()=>({content:[{type:'text',text:JSON.stringify({available:true})}]}),
  unsafe_write:async()=>{throw Error('MUST NEVER CALL');}
}};
function req(method='GET',query={},body,token=pass){
  const text=body===undefined?undefined:JSON.stringify(body);
  return {method,query,body,headers:{authorization:'Bearer '+token,
    ...(text?{'content-length':String(Buffer.byteLength(text))}: {})}};
}
function res(){return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},send(x){this.body=JSON.parse(x);return this;}};}
async function fixture(){
  const db=createFakeDb({accounts:[{id:account}]});
  await db.saveTestKey({account,label:'TEST',ciphertext:'v1.fake',kind:'restricted',last4:'FAKE'});
  await db.createRtcReadOnlyPass({id:'rtc-agent-test1234',account,token:pass,
    expiresAt:new Date(Date.now()+86400000)});
  return {db,handler:createRtcReadOnlyHttpHandler({db,registry})};
}
describe('RTC 1 HTTPS TEST-only pass boundary',()=>{
  it('publishes safe prefixed discovery without changing registered MCP names',async()=>{
    expect(rtcManifest(registry)).toMatchObject({rtc:1,prefix:'stripe',counts:{tools:3,writes:1}});
    expect(Object.keys(rtcOpenApi().paths)).toContain('/api/contract');
    const {handler}=await fixture(),r=res();
    await handler(req('GET',{limit:'100',listing:'catalog'}),r,'catalog');
    expect(r.body.ok).toBe(true);
    expect(r.body.result.tools.map(t=>t.name)).toEqual(['stripe_whoami','stripe_account_get']);
    expect(r.body.result.tools.every(t=>t.annotations.readOnlyHint)).toBe(true);
    expect(registry.tools[1].name).toBe('account_get');
  });
  it('permits only genuine TEST metadata reads and guarded batch',async()=>{
    const {handler}=await fixture();
    for(const [route,name,method,body] of [
      ['whoami',undefined,'GET',undefined],
      ['call','stripe_whoami','POST',{}],
      ['batch',undefined,'POST',{calls:[{name:'stripe_account_get',args:{}}]}]
    ]){
      const r=res();await handler(req(method,{},body),r,route,name);
      expect(r.statusCode).toBe(200);
      expect(r.body.ok).toBe(true);
    }
    const denied=res();
    await handler(req('POST',{},{}),denied,'call','stripe_unsafe_write');
    expect(denied.statusCode).toBe(403);
    const indirect=res();
    await handler(req('POST',{}, {calls:[{name:'stripe_unsafe_write'}]}),indirect,'batch');
    expect(indirect.statusCode).toBe(400);
  });
  it('rejects bearer connector tokens, expired, revoked and missing account',async()=>{
    const {db,handler}=await fixture();
    const bad=res();await handler(req('GET',{},undefined,'connector_123'),bad,'whoami');
    expect(bad.statusCode).toBe(401);
    const id='C'.repeat(32);
    expect(await db.requestConnectionRevokeIntent({id,account,
      clientId:'rtc-agent-test1234',expiresAt:new Date(Date.now()+600000)})).toBe(true);
    expect(await db.consumeConnectionRevokeIntent(id)).toBe(true);
    const revoked=res();await handler(req(),revoked,'whoami');
    expect(revoked.body.error.code).toBe('pass_revoked');
    expect(revoked.statusCode).toBe(401);
  });

  it('enforces area grants on catalog, direct reads, describe and batch',async()=>{
    const {db}=await fixture();
    const scopedDb={...db,async getRtcPassStatus(token){
      const original=await db.getRtcPassStatus(token);
      return original?{...original,areas:['account']}:original;
    }};
    const localRegistry={tools:[...registry.tools,
      {name:'stripe_call',description:'Delegate to another tool',area:'account',
        writes:false,profiles:['read_only']},
      {name:'risky_read',description:'Misclassified money operation',
        area:'account',writes:false,money:true,profiles:['read_only']}],
      handlers:{...registry.handlers,
        stripe_call:async()=>{throw Error('DELEGATION MUST BE BLOCKED');},
        risky_read:async()=>{throw Error('MONEY MUST BE BLOCKED');}}};
    const scoped=createRtcReadOnlyHttpHandler({db:scopedDb,registry:localRegistry});
    const catalog=res();await scoped(req('GET',{limit:'100'}),catalog,'catalog');
    expect(catalog.body.result.tools.map(t=>t.name)).toContain('stripe_account_get');
    expect(catalog.body.result.tools.map(t=>t.name)).not.toContain('stripe_call');
    expect(catalog.body.result.tools.map(t=>t.name)).not.toContain('stripe_risky_read');
    const allowed=res();
    await scoped(req('POST',{},{}),allowed,'call','stripe_account_get');
    expect(allowed.statusCode).toBe(200);
    for(const [route,name,method,args] of [
      ['describe','stripe_unsafe_write','GET',undefined],
      ['call','stripe_risky_read','POST',{}],
      ['call','stripe_call','POST',{name:'unsafe_write'}],
      ['batch',undefined,'POST',{calls:[{name:'stripe_call',args:{}}]}]
    ]){
      const r=res();await scoped(req(method,{},args),r,route,name);
      expect(r.statusCode).toBeGreaterThanOrEqual(400);
    }
  });
  it('fails closed if a stored pass has a malformed area grant',async()=>{
    const {db}=await fixture();
    const corrupt={...db,async getRtcPassStatus(token){
      return {...await db.getRtcPassStatus(token),areas:'payments'};
    }};
    const r=res();
    await createRtcReadOnlyHttpHandler({db:corrupt,registry})(req(),r,'whoami');
    expect(r.statusCode).toBe(403);
  });

  it('pages actual filtered catalog without repeats or lost tools',async()=>{
    const {handler}=await fixture();
    const a=res(),b=res(),empty=res();
    await handler(req('GET',{limit:'1',offset:'0'}),a,'catalog');
    await handler(req('GET',{limit:'1',offset:'1'}),b,'catalog');
    await handler(req('GET',{limit:'1',offset:'200'}),empty,'catalog');
    expect(a.body.result.tools).toHaveLength(1);
    expect(b.body.result.tools).toHaveLength(1);
    expect(a.body.result.tools[0].name).not.toBe(b.body.result.tools[0].name);
    expect(a.body.result.next).toBe(1);
    expect(b.body.result.next).toBe(null);
    expect(empty.body.result.tools).toHaveLength(0);
    for(const query of [{offset:'-1'},{offset:'1.5'},{audience:'administrator'}]){
      const invalid=res();await handler(req('GET',query),invalid,'catalog');
      expect(invalid.body.error.code).toBe('invalid_args');
    }
  });
  it('normalizes RTC array projections without changing legacy MCP syntax',async()=>{
    const projectedRegistry={tools:registry.tools,handlers:{...registry.handlers,
      account_get:async(args)=>({content:[{type:'text',
        text:JSON.stringify({available:true,unrelated:'private',requested:args.fields})}]})}};
    const {db}=await fixture();
    const handler=createRtcReadOnlyHttpHandler({db,registry:projectedRegistry});
    const good=res();
    await handler(req('POST',{}, {fields:['available']}),good,'call','stripe_account_get');
    expect(good.statusCode).toBe(200);
    expect(good.body.result).toEqual({available:true});
    for(const fields of [[],Array(13).fill('available'),['available',99]]){
      const invalid=res();
      await handler(req('POST',{}, {fields}),invalid,'call','stripe_account_get');
      expect(invalid.statusCode).toBe(400);
      expect(invalid.body.error.code).toBe('invalid_args');
    }
  });
  it('shares rate state across handler instances and refuses 121st call',async()=>{
    const {db,handler}=await fixture();
    const sibling=createRtcReadOnlyHttpHandler({db,registry});
    const calls=Array.from({length:122},(_,i)=>
      (async()=>{const r=res();await (i%2?handler:sibling)(req(),r,'whoami');
        return r.statusCode;})());
    const codes=await Promise.all(calls);
    expect(codes.filter(x=>x===200)).toHaveLength(120);
    expect(codes.filter(x=>x===429)).toHaveLength(2);
  });
});

describe('RTC 1 read-failure status accuracy',()=>{
  it('reports a provider read failure as service_error/503 for direct and batch',async()=>{
    const {db}=await fixture();
    const failing=createRtcReadOnlyHttpHandler({db,registry:{
      tools:registry.tools,handlers:{...registry.handlers,
        account_get:async()=>({isError:true,content:[
          {type:'text',text:'Private provider failure — never echo this'}]})}
    }});
    for(const [route,name,body] of [
      ['call','stripe_account_get',{}],
      ['batch',undefined,{calls:[{name:'stripe_account_get',args:{}}]}]
    ]){
      const r=res();await failing(req('POST',{},body),r,route,name);
      expect(r.statusCode).toBe(503);
      expect(r.body).toMatchObject({ok:false,error:{code:'service_error'}});
      expect(JSON.stringify(r.body)).not.toContain('Private provider failure');
    }
  });
  it('preserves invalid_args/400 for bad projection inside batch',async()=>{
    const {handler}=await fixture(),r=res();
    await handler(req('POST',{}, {calls:[{name:'stripe_account_get',
      args:{fields:[]}}]}),r,'batch');
    expect(r.statusCode).toBe(400);
    expect(r.body.error.code).toBe('invalid_args');
  });
});
