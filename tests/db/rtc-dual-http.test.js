import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {createDb} from '../../src/db.js';
import {registry} from '../../src/tools/index.js';
import {createRtcReadOnlyHttpHandler} from '../../src/core/rtc-http.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';

// Genuine, independent HTTP listening sockets/handler instances and separate
// DB adapters against the same disposable PostgreSQL state. Not two OS processes
// or a deployed Toolkit Hub route; those acceptance gates remain separate.
const account='acct_RTCDUALWIRE';
const makeToken=()=> 'rtc_pass_'+randomBytes(32).toString('base64url');
const limitPass=makeToken(),readPass=makeToken();
const peers=[];
let db;
function nodeReply(res){
  res.status=code=>{res.statusCode=code;return res;};
  res.send=body=>{res.end(body);return res;};
}
async function startPeer(database){
  const handler=createRtcReadOnlyHttpHandler({db:database,registry});
  const server=createServer(async(req,res)=>{
    nodeReply(res);
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      req.query=Object.fromEntries(url.searchParams);
      if(req.method==='POST'){
        const parts=[];
        for await(const part of req)parts.push(part);
        req.rawBody=Buffer.concat(parts);
        req.body=JSON.parse(req.rawBody.toString('utf8'));
      }
      if(url.pathname==='/api/whoami')
        return await handler(req,res,'whoami');
      if(url.pathname==='/api/tools')
        return await handler(req,res,'catalog');
      if(url.pathname.startsWith('/api/tools/')){
        const name=decodeURIComponent(url.pathname.slice('/api/tools/'.length));
        return await handler(req,res,req.method==='GET'?'describe':'call',name);
      }
      res.status(404).send('{"ok":false}');
    }catch{
      if(!res.writableEnded)res.status(500).send('{"ok":false}');
    }
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  return {server,origin:'http://127.0.0.1:'+server.address().port};
}
async function request(peer,path,{token,method='GET',body}={}){
  const response=await fetch(peer.origin+path,{
    method,headers:{authorization:'Bearer '+token,
      ...(body===undefined?{}:{'content-type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,data:await response.json(),
    retryAfter:response.headers.get('retry-after')};
}
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Disposable localhost PostgreSQL required');
  await openIsolatedSchema(dsn);
  db=createDb(neonShapedQuery());
  const otherDb=createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts (id,label,test_key_enc) VALUES($1,$2,$3)',
    [account,'DISPOSABLE TEST','v1.fake']);
  for(const [id,token] of [
    ['rtc-agent-twohttp-rate',limitPass],
    ['rtc-agent-twohttp-read',readPass]]){
    expect(await db.createRtcReadOnlyPass({
      id,account,token,areas:['server'],
      expiresAt:new Date(Date.now()+3600000)})).toBe(true);
  }
  peers.push(await startPeer(db));
  peers.push(await startPeer(otherDb));
});
afterAll(async()=>{
  for(const peer of peers){
    await new Promise((resolve,reject)=>peer.server.close(e=>e?reject(e):resolve()));
  }
  await closeIsolatedSchema();
});
describe('real RTC read-only dual HTTP boundary and shared PostgreSQL',()=>{
  it('permits exactly 120 overlapping calls across independent HTTP handlers',async()=>{
    expect(peers).toHaveLength(2);
    expect(peers[0].origin).not.toBe(peers[1].origin);
    // Rate buckets are per PostgreSQL calendar minute. A 150-request CI
    // burst can straddle a UTC minute boundary, legitimately admitting >120
    // *across two buckets*. Verify that before asserting one-bucket counts.
    // Retry only straddling bursts with new short-lived TEST passes; never
    // alter the real shared 120/min enforcement or weaken the expected 120/30.
    let responses,sameMinute=false;
    for(let attempt=0;attempt<3;attempt++){
      const token=attempt===0?limitPass:makeToken();
      if(attempt>0){
        expect(await db.createRtcReadOnlyPass({
          id:'rtc-agent-twohttp-retry-'+attempt,account,token,areas:['server'],
          expiresAt:new Date(Date.now()+3600000)})).toBe(true);
      }
      const [before]=await rawQuery(
        "SELECT date_trunc('minute',now())::text AS minute");
      responses=await Promise.all(Array.from({length:150},(_,index)=>
        request(peers[index%2],'/api/whoami',{token})));
      const [after]=await rawQuery(
        "SELECT date_trunc('minute',now())::text AS minute");
      sameMinute=before.minute===after.minute;
      if(sameMinute)break;
    }
    expect(sameMinute).toBe(true);
    const accepted=responses.filter(r=>r.status===200);
    const rejected=responses.filter(r=>r.status===429);
    expect(accepted).toHaveLength(120);
    expect(rejected).toHaveLength(30);
    for(const item of accepted)
      expect(item.data).toMatchObject({ok:true,result:{
        mode:'test',profile:'read_only',allowWrites:false,moneyLimitCents:0}});
    for(const item of rejected){
      expect(item.data.error.code).toBe('rate_limited');
      expect(item.retryAfter).toBe('60');
    }
  },45000);
  it('reads the real Stripe registry and immediately observes revocation on both listeners',async()=>{
    for(const peer of peers){
      const listed=await request(peer,'/api/tools?listing=catalog&q=stripe_whoami',
        {token:readPass});
      expect(listed.status).toBe(200);
      expect(listed.data.result.tools.some(t=>t.name==='stripe_whoami')).toBe(true);
      const read=await request(peer,'/api/tools/stripe_whoami',
        {token:readPass,method:'POST',body:{}});
      expect(read.status).toBe(200);
      expect(read.data.result).toMatchObject({
        account,mode:'test',profile:'read_only'});
    }
    const intent='T'.repeat(32);
    expect(await db.requestConnectionRevokeIntent({id:intent,account,
      clientId:'rtc-agent-twohttp-read',
      expiresAt:new Date(Date.now()+600000)})).toBe(true);
    expect(await db.consumeConnectionRevokeIntent(intent)).toBe(true);
    for(const peer of peers){
      const denied=await request(peer,'/api/whoami',{token:readPass});
      expect(denied.status).toBe(401);
      expect(denied.data.error.code).toBe('pass_revoked');
    }
  });
});
