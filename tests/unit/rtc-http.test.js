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
    expect(rtcManifest(registry)).toMatchObject({rtc:1,prefix:'stripe',
      profiles:['read_only'],counts:{tools:2,writes:0,money:0},areas:['account','server']});
    const spec=rtcOpenApi();
    expect(Object.keys(spec.paths)).toContain('/api/contract');
    expect(Object.keys(spec.paths)).toContain('/api/openapi.json');
    expect(spec.components.securitySchemes.rtcTestPass).toMatchObject({
      type:'http',scheme:'bearer'});
    expect(spec.security).toEqual([{rtcTestPass:[]}]);
    expect(spec.paths['/api/contract'].get.security).toEqual([]);
    expect(spec.paths['/api/openapi.json'].get.security).toEqual([]);
    expect(spec.paths['/api/tools/{name}'].post.requestBody.required).toBe(true);
    expect(spec.paths['/api/tools/_batch'].post.requestBody.content[
      'application/json'].schema.properties.calls.maxItems).toBe(10);
    for(const entry of Object.values(spec.paths))for(const operation of Object.values(entry)){
      expect(operation.responses[200]).toBeDefined();
    }
    const {handler}=await fixture(),r=res();
    await handler(req('GET',{limit:'100',listing:'catalog'}),r,'catalog');
    expect(r.body.ok).toBe(true);
    expect(r.body.result.tools.map(t=>t.name)).toEqual(['stripe_whoami','stripe_account_get']);
    expect(r.body.result.tools.every(t=>t.annotations.readOnlyHint)).toBe(true);
    expect(registry.tools[1].name).toBe('account_get');
    expect(r.body.result.tools.every(t=>
      t.profiles.length===1&&t.profiles[0]==='read_only')).toBe(true);
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

describe('RTC actual Stripe money contract metadata',()=>{
  it('recognizes provider-derived money tools, including mislabelled read metadata',async()=>{
    const {db}=await fixture();
    const hidden={name:'masked_money',description:'Must never appear or execute',
      area:'money',writes:false,profiles:['read_only'],moneySpec:'provider-derived',
      safety:'$',inputSchema:{type:'object',properties:{}}};
    const localRegistry={tools:[...registry.tools,hidden],handlers:{...registry.handlers,
      masked_money:async()=>{throw Error('MONEY TOOL EXECUTED');}}};
    expect(rtcManifest(localRegistry).counts).toMatchObject({
      tools:2,writes:0,money:0});
    const handler=createRtcReadOnlyHttpHandler({db,registry:localRegistry});
    const catalog=res();await handler(req('GET',{listing:'catalog'}),catalog,'catalog');
    expect(catalog.body.result.tools.map(t=>t.name)).not.toContain('stripe_masked_money');
    const denied=res();
    await handler(req('POST',{},{}),denied,'call','stripe_masked_money');
    expect(denied.statusCode).toBe(403);
    expect(denied.body.error.code).toBe('refused_by_guard');
  });
});

describe('RTC HTTPS truthful fields/detail schema and guard',()=>{
  it('advertises string and array fields without changing MCP registry',async()=>{
    const {handler}=await fixture(),response=res();
    await handler(req('GET'),response,'describe','stripe_account_get');
    expect(response.statusCode).toBe(200);
    const field=response.body.result.inputSchema.properties.fields;
    expect(field.oneOf.map(v=>v.type)).toEqual(['string','array']);
    expect(field.oneOf[1]).toMatchObject({minItems:1,maxItems:12,uniqueItems:true});
    expect(registry.tools[1].inputSchema.properties.fields).toBeUndefined();
  });
  it('refuses malformed detail and field selectors before running any handler',async()=>{
    const {db}=await fixture();let calls=0;
    const handler=createRtcReadOnlyHttpHandler({db,registry:{tools:registry.tools,
      handlers:{...registry.handlers,account_get:async()=>{
        calls++;return {content:[{type:'text',text:'{}'}]};}}}});
    for(const bad of [
      {detail:'everything'},{fields:27},{fields:null},
      {fields:['__proto__']},{fields:['safe','safe']},
      {fields:'safe,,other'},{fields:'constructor.name'}
    ]){
      const response=res();
      await handler(req('POST',{},bad),response,'call','stripe_account_get');
      expect(response.statusCode).toBe(400);
      expect(response.body.error.code).toBe('invalid_args');
    }
    expect(calls).toBe(0);
    const good=res();await handler(req('POST',{}, {fields:['safe'],
      detail:'full'}),good,'call','stripe_account_get');
    expect(good.statusCode).toBe(200);
    expect(calls).toBe(1);
  });
});

describe('RTC batch shared rate accounting',()=>{
  it('charges ten reads per batch and rejects a thirteenth batch',async()=>{
    const {handler}=await fixture();
    const calls=Array.from({length:10},()=>({name:'stripe_account_get',args:{}}));
    for(let i=0;i<12;i++){
      const r=res();await handler(req('POST',{}, {calls}),r,'batch');
      expect(r.statusCode).toBe(200);
      expect(r.body.result.count).toBe(10);
    }
    const denied=res();await handler(req('POST',{}, {calls}),denied,'batch');
    expect(denied.statusCode).toBe(429);
    expect(denied.body.error.code).toBe('rate_limited');
    expect(denied.headers['Retry-After']).toBe('60');
  });
});

describe('RTC HTTP Bearer challenge and pass byte boundaries',()=>{
  it('accepts case-insensitive schemes but retains exact TEST pass bytes',async()=>{
    const {handler}=await fixture();
    for(const scheme of ['bearer','BEARER','bEaReR']){
      const request=req();request.headers.authorization=scheme+'  '+pass;
      const response=res();await handler(request,response,'whoami');
      expect(response.statusCode).toBe(200);
    }
    for(const authorization of ['Basic '+pass,'Bearer RTC_PASS_'+pass.slice(9),
      'Bearer '+pass+' other','Bearer\n'+pass]){
      const request=req();request.headers.authorization=authorization;
      const response=res();await handler(request,response,'whoami');
      expect(response.statusCode).toBe(401);
      expect(response.headers['WWW-Authenticate']).toContain('Bearer realm=');
    }
  });
  it('sends a challenge for unknown and owner-revoked pass without echoing a secret',async()=>{
    const {handler,db}=await fixture();
    const unknown=res();await handler(req('GET',{},undefined,
      'rtc_pass_'+randomBytes(32).toString('base64url')),unknown,'whoami');
    expect(unknown.statusCode).toBe(401);
    expect(unknown.headers['WWW-Authenticate']).toContain('invalid_token');
    const intent='J'.repeat(32);
    expect(await db.requestConnectionRevokeIntent({id:intent,account,
      clientId:'rtc-agent-test1234',expiresAt:new Date(Date.now()+600000)})).toBe(true);
    expect(await db.consumeConnectionRevokeIntent(intent)).toBe(true);
    const revoked=res();await handler(req(),revoked,'whoami');
    expect(revoked.statusCode).toBe(401);
    expect(revoked.headers['WWW-Authenticate']).toContain('invalid_token');
    expect(JSON.stringify(revoked.headers)).not.toContain(pass);
  });
});

describe('RTC strict catalog and saved result pagination',()=>{
  it('accepts ordinary decimal pagination and case-insensitive discovery search',async()=>{
    const {handler}=await fixture();
    const r=res();await handler(req('GET',{limit:'20',offset:'0',
      q:'STRIPE_ACCOUNT_GET',listing:'catalog'}),r,'catalog');
    expect(r.statusCode).toBe(200);
    expect(r.body.result.tools.map(t=>t.name)).toEqual(['stripe_account_get']);
  });
  it('refuses coerced numeric catalog selectors',async()=>{
    const {handler}=await fixture();
    for(const query of [
      {limit:''},{limit:'0x10'},{limit:'1e2'},{limit:null},
      {limit:['2']},{limit:' 2'},{limit:'01'},
      {offset:'-0'},{offset:'2e1'},{offset:true},
      {offset:'999999999999999999999'}
    ]){
      const response=res();await handler(req('GET',query),response,'catalog');
      expect(response.statusCode).toBe(400);
      expect(response.body.error.code).toBe('invalid_args');
    }
  });
  it('refuses coerced result pages before reading private handles',async()=>{
    const {handler}=await fixture();
    const handle='res_'+'a'.repeat(24);
    for(const page of ['',null,[],true,'0x0','1e0','01',' 0','-0']){
      const response=res();await handler(req('GET',{page}),response,'result',handle);
      expect(response.statusCode).toBe(400);
      expect(response.body.error.code).toBe('invalid_args');
    }
  });
});

describe('RTC legacy unscoped pass never tunnels through MCP meta dispatch',()=>{
  it('keeps direct TEST reads but removes every delegated discovery/call door',async()=>{
    const {db}=await fixture();let unsafeCalls=0;
    const delegators=['stripe_call','stripe_batch','stripe_search_tools',
      'stripe_describe_tool','api_search'];
    const extra=delegators.map(name=>({name,area:'server',writes:false,
      description:'Delegating MCP tool '+name,profiles:['read_only'],
      inputSchema:{type:'object',properties:{}}}));
    const handlers=Object.fromEntries(delegators.map(name=>[name,async()=>{
      unsafeCalls++;return {content:[{type:'text',text:'{}'}]};
    }]));
    const http=createRtcReadOnlyHttpHandler({db,registry:{
      tools:[...registry.tools,...extra],handlers:{...registry.handlers,...handlers}}});
    const catalog=res();await http(req('GET',{listing:'catalog',limit:'100'}),
      catalog,'catalog');
    expect(catalog.statusCode).toBe(200);
    const names=catalog.body.result.tools.map(t=>t.name);
    expect(names).toContain('stripe_account_get');
    for(const name of delegators){
      const alias=name.startsWith('stripe_')?name:'stripe_'+name;
      expect(names).not.toContain(alias);
      const response=res();await http(req('POST',{},{}),response,'call',alias);
      expect(response.statusCode).toBe(403);
    }
    const batch=res();await http(req('POST',{},
      {calls:[{name:'stripe_call',args:{name:'stripe_account_get'}}]}),batch,'batch');
    expect(batch.statusCode).toBe(400);
    const direct=res();await http(req('POST',{},{}),direct,'call','stripe_account_get');
    expect(direct.statusCode).toBe(200);
    expect(unsafeCalls).toBe(0);
  });
});
