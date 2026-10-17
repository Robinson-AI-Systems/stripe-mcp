// Published FULL RTC 1 conformance against original Stripe native guarded
// dispatch + an isolated fake provider backed by disposable local PostgreSQL.
// Separate OS processes share that test DB. No actual Stripe key or write.
import {createServer} from 'node:http';
import {fork} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {hashToken} from '../src/core/oauth.js';
import {createDb} from '../src/db.js';
import {registry as nativeRegistry} from '../src/tools/index.js';
import {createRtcHubFixture} from '../test/helpers/rtc-hub-fixture.js';
import {createRtcReadOnlyHttpHandler,rtcManifest,rtcOpenApi}
  from '../src/core/rtc-http.js';
import {openIsolatedSchema,closeIsolatedSchema,neonShapedQuery,rawQuery}
  from '../test/helpers/pg-neon-adapter.js';

const dsn=process.env.TEST_DATABASE_URL;
if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
  throw Error('Conformance may use only disposable localhost PostgreSQL');
const {runConformance}=await import(
  '../rtc-reference/packages/conformance/src/run.js');
const account='acct_RTCOFFICIALSERVICE';
const pass=()=> 'rtc_pass_'+randomBytes(32).toString('base64url');
const passes={full:pass(),readOnly:pass(),expired:pass(),revoked:pass()};
const ratePass=pass();
const peerProcesses=[];
async function startIndependentPeer(schema){
  const child=fork(new URL('./rtc-conformance-peer.mjs',import.meta.url),[],{
    env:{...process.env,RTC_TEST_SCHEMA:schema},silent:true});
  peerProcesses.push(child);
  const port=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('RTC peer failed to start')),12000);
    child.once('message',message=>{
      clearTimeout(timeout);
      if(!Number.isInteger(message?.port)||message.port<=0)
        reject(new Error('RTC peer did not return a listening port'));
      else resolve(message.port);
    });
    child.once('error',error=>{clearTimeout(timeout);reject(error);});
    child.once('exit',code=>{clearTimeout(timeout);
      reject(new Error('RTC peer exited early '+String(code)));});
  });
  return 'http://127.0.0.1:'+port;
}
let server,opened=false;
try{
  const schema=await openIsolatedSchema(dsn);
  opened=true;
  const db=createDb(neonShapedQuery());
  await db.initSchema();
  // The two fake writes use the ORIGINAL defineWrite/readback/audit machinery.
  // Every changed row belongs exclusively to the temporary PostgreSQL schema.
  const fixture=await createRtcHubFixture({registry:nativeRegistry,rawQuery});
  const registry=fixture.registry;
  await rawQuery('INSERT INTO stripe_accounts(id,label,test_key_enc) VALUES($1,$2,$3)',
    [account,'Local conformance TEST','v1.fake']);
  const expiresAt=new Date(Date.now()+3600000);
  if(!await db.createRtcPass({
    id:'rtc-agent-official-full',account,token:passes.full,
    profile:'full',areas:['server','account','payments'],
    allowWrites:true,moneyLimitCents:2500,expiresAt
  }))throw Error('Failed to create disposable full-profile original RTC pass');
  for(const [role,id] of Object.entries({
    readOnly:'rtc-agent-official-read',
    expired:'rtc-agent-official-expire',revoked:'rtc-agent-official-revoke'
  })){
    if(!await db.createRtcReadOnlyPass({id,account,
      token:passes[role],areas:['server','account','payments'],expiresAt}))
      throw Error('Failed to create disposable read-only RTC fixture');
  }
  await rawQuery("UPDATE oauth_tokens SET expires_at=now()-interval '1 second' WHERE client_id=$1",
    ['rtc-agent-official-expire']);
  await rawQuery('UPDATE oauth_tokens SET revoked_at=now() WHERE client_id=$1',
    ['rtc-agent-official-revoke']);
  if(!await db.createRtcPass({id:'rtc-agent-official-rate5',account,
    token:ratePass,areas:['server'],rateLimitPerMinute:5,
    expiresAt:new Date(Date.now()+3600000)}))
    throw Error('Could not issue isolated five-per-minute rate fixture');
  // The official OAuth preservation probe inspects a real connector row.
  // Refresh rotates its original token in place, including persisted areas;
  // it must never reconstruct authorization from account defaults.
  const oauthClient='rtc-official-oauth-client';
  const originalAccess='fixture_access_'+randomBytes(32).toString('base64url');
  const originalRefresh='fixture_refresh_'+randomBytes(32).toString('base64url');
  await db.createAccessToken({accessToken:originalAccess,
    refreshToken:originalRefresh,clientId:oauthClient,stripeAccount:account,
    mode:'test',profile:'everyday',listing:'compact'});
  await rawQuery('UPDATE oauth_tokens SET areas=ARRAY[$1,$2] WHERE token_hash=$3',
    ['server','account',hashToken(originalAccess)]);
  const oauth={
    async inspect(value=originalAccess){
      const rows=await rawQuery(
        'SELECT stripe_account,mode,profile,listing,areas FROM oauth_tokens WHERE token_hash=$1 AND kind=$2',
        [hashToken(value),'connector']);
      const row=rows[0];
      if(!row)throw Error('Authenticated OAuth row not found after refresh');
      return {account:row.stripe_account,mode:row.mode,profile:row.profile,
        listing:row.listing,areas:row.areas};
    },
    async refresh(){
      const nextAccess='fixture_access_'+randomBytes(32).toString('base64url');
      const nextRefresh='fixture_refresh_'+randomBytes(32).toString('base64url');
      const rotated=await db.rotateRefreshToken({refreshToken:originalRefresh,
        clientId:oauthClient,accessToken:nextAccess,newRefreshToken:nextRefresh});
      if(rotated?.client_id!==oauthClient)throw Error('OAuth refresh did not rotate original row');
      return nextAccess;
    }
  };
  const rtc=createRtcReadOnlyHttpHandler({db,registry});
  server=createServer(async(req,res)=>{
    res.status=n=>{res.statusCode=n;return res;};
    res.send=value=>{res.end(value);return res;};
    try{
      const path=new URL(req.url,'http://127.0.0.1');
      req.query=Object.fromEntries(path.searchParams);
      if(req.method==='POST'){
        const parts=[];
        for await(const part of req)parts.push(part);
        req.rawBody=Buffer.concat(parts);
        req.body=JSON.parse(req.rawBody.toString('utf8'));
      }
      if(path.pathname==='/api/contract'){
        res.setHeader('Content-Type','application/json');
        return res.status(200).send(JSON.stringify(rtcManifest(registry)));
      }
      if(path.pathname==='/api/openapi.json'){
        res.setHeader('Content-Type','application/json');
        return res.status(200).send(JSON.stringify(rtcOpenApi()));
      }
      if(path.pathname==='/api/whoami')
        return await rtc(req,res,'whoami');
      if(path.pathname==='/api/tools')
        return await rtc(req,res,'catalog');
      if(path.pathname.startsWith('/api/tools/')){
        const name=decodeURIComponent(path.pathname.slice('/api/tools/'.length));
        return await rtc(req,res,name==='_batch'?'batch':
          req.method==='GET'?'describe':'call',name);
      }
      if(path.pathname.startsWith('/api/results/'))
        return await rtc(req,res,'result',path.pathname.slice('/api/results/'.length));
      return res.status(404).send('{"ok":false}');
    }catch{
      if(!res.writableEnded){
        res.setHeader('Content-Type','application/json');
        res.status(503).send('{"ok":false,"error":{"code":"service_error"}}');
      }
    }
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  const url='http://127.0.0.1:'+server.address().port;
  // The upstream runner calls two independent OS processes, each with its
  // own SQL connection but one short-lived, isolated PostgreSQL schema.
  // This is stronger than two in-memory handler objects in a single process.
  const peerUrls=await Promise.all([
    startIndependentPeer(schema),startIndependentPeer(schema)
  ]);
  const result=await runConformance({url,passes,oauth,fixtures:fixture.fixtures,
    instances:{urls:peerUrls,pass:ratePass,limit:5}});
  // The *official pinned* Hub runner must certify every named probe.
  // Never turn a failed or skipped write/readback into a subset PASS.
  for(const row of result.checks){
    if(!row.ok||row.skipped)throw Error('RTC full conformance '+row.name+
      ': '+String(row.message??'missing result').slice(0,180));
    process.stdout.write('SERVICE_PASS '+row.name+'\n');
  }
  if(result.ok!==true||result.checks.length<12)
    throw Error('Official full RTC 1 conformance incomplete');
  if((await fixture.readValue())!=='committed')
    throw Error('Actual fake-provider state was not read back from PostgreSQL');
  process.stdout.write('RTC_FULL_CONFORMANCE verified all official upstream probes on original Stripe guarded dispatch, two independent OS processes and disposable PostgreSQL; no real provider claim\n');
}finally{
  for(const peer of peerProcesses){
    if(peer.connected)peer.disconnect();
    if(!peer.killed)peer.kill();
  }
  if(server)await new Promise((resolve,reject)=>
    server.close(e=>e?reject(e):resolve()));
  if(opened)await closeIsolatedSchema();
}
