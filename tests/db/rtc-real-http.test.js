import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {createDb} from '../../src/db.js';
import {registry} from '../../src/tools/index.js';
import {createRtcReadOnlyHttpHandler,rtcManifest} from '../../src/core/rtc-http.js';
import {splitResult} from '../../src/tools/result-rules.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';

const acct='acct_RTCSERVICE';
const generatePass=()=> 'rtc_pass_'+randomBytes(32).toString('base64url');
const mainPass=generatePass(),otherPass=generatePass(),
  expiredPass=generatePass(),legacyPass=generatePass();
let db,host,server;
const createResponseAdapter=res=>{
  res.status=n=>{res.statusCode=n;return res;};
  res.send=body=>{res.end(body);return res;};
};
async function makeServer(){
  const rtc=createRtcReadOnlyHttpHandler({db,registry});
  server=createServer(async(req,res)=>{
    createResponseAdapter(res);
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      req.query=Object.fromEntries(url.searchParams);
      if(req.method==='POST'){
        const chunks=[];
        for await(const chunk of req)chunks.push(chunk);
        req.rawBody=Buffer.concat(chunks);
        req.body=JSON.parse(req.rawBody.toString('utf8'));
      }
      if(url.pathname==='/api/contract'){
        res.setHeader('Cache-Control','no-store');
        res.setHeader('Content-Type','application/json');
        return res.status(200).send(JSON.stringify(rtcManifest(registry)));
      }
      if(url.pathname==='/api/whoami')
        return await rtc(req,res,'whoami');
      if(url.pathname==='/api/tools')
        return await rtc(req,res,'catalog');
      if(url.pathname.startsWith('/api/tools/')){
        const name=decodeURIComponent(url.pathname.slice('/api/tools/'.length));
        return await rtc(req,res,name==='_batch'?'batch':
          req.method==='GET'?'describe':'call',name);
      }
      if(url.pathname.startsWith('/api/results/'))
        return await rtc(req,res,'result',url.pathname.slice('/api/results/'.length));
      res.status(404).send('{}');
    }catch{
      if(!res.writableEnded)res.status(500).send('{"error":"test_transport_failed"}');
    }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  host='http://127.0.0.1:'+server.address().port;
}
async function http(path,{token,method='GET',body}={}){
  const response=await fetch(host+path,{method,
    headers:{...(token?{authorization:'Bearer '+token}:{}),
      ...(body!==undefined?{'content-type':'application/json'}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{})});
  return {status:response.status,data:await response.json(),
    challenge:response.headers.get('www-authenticate')};
}
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Disposable localhost PostgreSQL required');
  await openIsolatedSchema(dsn);
  db=createDb(neonShapedQuery());await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts (id,label,test_key_enc) VALUES($1,$2,$3)',
    [acct,'ISOLATED TEST','v1.fake']);
  for(const [id,token,areas] of [
    ['rtc-agent-wiremain',mainPass,['server','account']],
    ['rtc-agent-wireother',otherPass,['server']],
    ['rtc-agent-wireexpired',expiredPass,['server']],
    ['rtc-agent-wirelegacy',legacyPass,null]]){
    expect(await db.createRtcReadOnlyPass({id,account:acct,token,areas,
      expiresAt:new Date(Date.now()+3600000)})).toBe(true);
  }
  await rawQuery("UPDATE oauth_tokens SET expires_at=now()-interval '1 second' WHERE client_id=$1",
    ['rtc-agent-wireexpired']);
  await makeServer();
});
afterAll(async()=>{
  if(server)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await closeIsolatedSchema();
});
describe('actual Stripe RTC HTTP wire over isolated PostgreSQL',()=>{
  it('serves the real registry manifest while refusing missing or bad authorization',async()=>{
    const manifest=await http('/api/contract');
    expect(manifest.status).toBe(200);
    expect(manifest.data).toMatchObject({rtc:1,prefix:'stripe',
      access:'owner_scoped_passes_with_independent_LIVE_activation',
      profiles:['read_only','everyday','full']});
    // Public manifest describes the UNION of eligible RTC permissions, not
    // the restricted catalog a legacy read-only bearer is entitled to see.
    expect(manifest.data.counts.tools).toBeGreaterThan(0);
    expect(manifest.data.counts.writes).toBeGreaterThan(0);
    expect(manifest.data.counts.money).toBeGreaterThanOrEqual(0);
    expect(manifest.data.counts.money).toBeLessThanOrEqual(manifest.data.counts.writes);
    const missing=await http('/api/whoami');
    expect(missing.status).toBe(401);
    expect(missing.data.error.code).toBe('permission');
    expect(missing.challenge).toContain('Bearer');
    const wrong=await http('/api/whoami',{token:'connector_not_a_pass'});
    expect(wrong.status).toBe(401);
  });
  it('conforms manifest counts and metadata to the actual HTTP service catalog',async()=>{
    const manifest=await http('/api/contract');
    expect(manifest.status).toBe(200);
    const names=[];
    let offset=0;
    for(let page=0;page<20;page++){
      const reply=await http('/api/tools?listing=catalog&limit=100&offset='+offset,
        {token:legacyPass});
      expect(reply.status).toBe(200);
      expect(reply.data.ok).toBe(true);
      const catalog=reply.data.result;
      for(const tool of catalog.tools){
        names.push(tool.name);
        expect(tool).toMatchObject({profiles:['read_only'],
          writes:false,money:false,destructive:false,
          annotations:{readOnlyHint:true,destructiveHint:false}});
      }
      if(catalog.next===null)break;
      expect(catalog.next).toBeGreaterThan(offset);
      offset=catalog.next;
    }
    // Every legacy read-only tool must be in the public union; the union also
    // includes guarded TEST writes which this pass must NEVER discover.
    const allNames=new Set(registry.tools.map(t=>
      t.name.startsWith('stripe_')?t.name:'stripe_'+t.name));
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThan(0);
    expect(names.length).toBeLessThan(manifest.data.counts.tools);
    expect(names.every(name=>allNames.has(name))).toBe(true);
    const expectedReadOnly=registry.tools.filter(t=>
      t.writes===false&&t.profiles?.includes('read_only')&&
      t.money!==true&&t.moneySpec!=='provider-derived'&&
      t.safety!==String.fromCharCode(36)&&t.destructive!==true&&
      !['stripe_call','stripe_batch','stripe_search_tools',
        'stripe_describe_tool','api_search'].includes(t.name));
    expect(names).toHaveLength(expectedReadOnly.length);
    const actualAreas=new Set(names.map(name=>registry.tools.find(t=>
      (t.name.startsWith('stripe_')?t.name:'stripe_'+t.name)===name)?.area??'server'));
    expect(manifest.data.areas.every(area=>typeof area==='string')).toBe(true);
    expect([...actualAreas].every(area=>manifest.data.areas.includes(area))).toBe(true);
    expect(names).toContain('stripe_account_get');
    expect(names).not.toContain('stripe_call');
    expect(names).not.toContain('stripe_batch');
  });
  it('lists and executes real selected-account read metadata, but not any write',async()=>{
    const who=await http('/api/whoami',{token:mainPass});
    expect(who.status).toBe(200);
    expect(who.data.result).toMatchObject({account:acct,mode:'test',
      profile:'read_only',allowWrites:false,moneyLimitCents:0,
      areas:['server','account']});
    const searched=await http('/api/tools?listing=catalog&q=stripe_whoami&limit=10',
      {token:mainPass});
    expect(searched.status).toBe(200);
    expect(searched.data.result.tools.some(t=>t.name==='stripe_whoami')).toBe(true);
    const read=await http('/api/tools/stripe_whoami',
      {token:mainPass,method:'POST',body:{}});
    expect(read.status).toBe(200);
    expect(read.data.result).toMatchObject({account:acct,mode:'test',profile:'read_only'});
    const forbidden=registry.tools.find(t=>t.writes===true);
    expect(forbidden).toBeTruthy();
    const writeName=forbidden.name.startsWith('stripe_')?
      forbidden.name:'stripe_'+forbidden.name;
    const denied=await http('/api/tools/'+encodeURIComponent(writeName),
      {token:mainPass,method:'POST',body:{confirm:true,dryRun:false}});
    expect(denied.status).toBe(403);
    expect(denied.data.error.code).toBe('refused_by_guard');
  });
  it('enforces actual scoped result ownership between two different passes',async()=>{
    const id='res_'+randomBytes(18).toString('base64url');
    const row=await db.getRtcPassStatus(mainPass);
    await db.putScopedResult({handle:id,connection:row.result_scope,
      body:splitResult({payload:'x'.repeat(9000)}),summary:'isolated fixture',
      expiresAt:new Date(Date.now()+3600000)});
    const mine=await http('/api/results/'+id,{token:mainPass});
    expect(mine.status).toBe(200);
    expect(mine.data.result).toMatchObject({page:1,bytes:expect.any(Number),
      pages:expect.any(Number),content:expect.any(String),next:2});
    expect(mine.data.result.pages).toBeGreaterThan(1);
    expect(Buffer.byteLength(mine.data.result.content,'utf8')).toBeLessThanOrEqual(4096);
    const second=await http('/api/results/'+id+'?page=2',{token:mainPass});
    expect(second.status).toBe(200);
    expect(second.data.result.page).toBe(2);
    expect((await http('/api/results/'+id+'?page=0',{token:mainPass})).status).toBe(400);
    const wrong=await http('/api/results/'+id,{token:otherPass});
    expect(wrong.status).toBe(404);
    expect(wrong.data.error.code).toBe('not_found');
  });
  it('distinguishes expired from actively owner-revoked credentials',async()=>{
    const expired=await http('/api/whoami',{token:expiredPass});
    expect(expired.status).toBe(401);
    expect(expired.data.error.code).toBe('pass_expired');
    const id='E'.repeat(32);
    expect(await db.requestConnectionRevokeIntent({id,account:acct,
      clientId:'rtc-agent-wireother',expiresAt:new Date(Date.now()+600000)})).toBe(true);
    expect(await db.consumeConnectionRevokeIntent(id)).toBe(true);
    const revoked=await http('/api/whoami',{token:otherPass});
    expect(revoked.status).toBe(401);
    expect(revoked.data.error.code).toBe('pass_revoked');
  });
});

describe('legacy unscoped RTC pass with genuine HTTP and PostgreSQL',()=>{
  it('retains direct TEST read yet cannot invoke MCP meta dispatch',async()=>{
    const row=await db.getRtcPassStatus(legacyPass);
    expect(row.areas).toBeNull();
    const direct=await http('/api/tools/stripe_whoami',
      {token:legacyPass,method:'POST',body:{}});
    expect(direct.status).toBe(200);
    expect(direct.data.result).toMatchObject({account:acct,mode:'test'});
    const catalog=await http('/api/tools?listing=catalog&limit=100',
      {token:legacyPass});
    expect(catalog.status).toBe(200);
    expect(catalog.data.result.tools.some(t=>t.name==='stripe_whoami')).toBe(true);
    for(const meta of ['stripe_call','stripe_batch','stripe_search_tools',
      'stripe_describe_tool']){
      expect(catalog.data.result.tools.some(t=>t.name===meta)).toBe(false);
      const denied=await http('/api/tools/'+meta,
        {token:legacyPass,method:'POST',body:{}});
      expect(denied.status).toBe(403);
      expect(denied.data.error.code).toBe('refused_by_guard');
    }
    const batch=await http('/api/tools/_batch',{token:legacyPass,
      method:'POST',body:{calls:[{name:'stripe_call',args:{name:'stripe_whoami'}}]}});
    expect(batch.status).toBe(400);
    expect(batch.data.error.code).toBe('invalid_args');
  });
});
