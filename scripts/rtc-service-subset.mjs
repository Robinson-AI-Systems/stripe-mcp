// Executable Stripe-service RTC 1 read-only subset check against Hub's pinned
// OFFICIAL conformance runner. Nothing connects to an actual Stripe provider.
// Unsupported full/write checks remain FAIL/SKIP in the upstream raw report;
// only independently applicable TEST read-only checks may pass this CI gate.
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {createDb} from '../src/db.js';
import {registry} from '../src/tools/index.js';
import {createRtcReadOnlyHttpHandler,rtcManifest,rtcOpenApi}
  from '../src/core/rtc-http.js';
import {openIsolatedSchema,closeIsolatedSchema,neonShapedQuery,rawQuery}
  from '../test/helpers/pg-neon-adapter.js';

const dsn=process.env.TEST_DATABASE_URL;
if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
  throw Error('Conformance may use only disposable localhost PostgreSQL');
const {runConformance}=await import(
  '../rtc-reference/packages/conformance/src/run.js');
const account='acct_RTC_OFFICIAL_SERVICE';
const pass=()=> 'rtc_pass_'+randomBytes(32).toString('base64url');
const passes={full:pass(),readOnly:pass(),expired:pass(),revoked:pass()};
let server,opened=false;
try{
  await openIsolatedSchema(dsn);
  opened=true;
  const db=createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label,test_key_enc) VALUES($1,$2,$3)',
    [account,'Local conformance TEST','v1.fake']);
  for(const [role,id] of Object.entries({
    full:'rtc-agent-official-full',readOnly:'rtc-agent-official-read',
    expired:'rtc-agent-official-expire',revoked:'rtc-agent-official-revoke'
  })){
    if(!await db.createRtcReadOnlyPass({id,account,
      token:passes[role],areas:['server','account'],
      expiresAt:new Date(Date.now()+3600000)}))
      throw Error('Failed to create disposable RTC fixture');
  }
  await rawQuery("UPDATE oauth_tokens SET expires_at=now()-interval '1 second' WHERE client_id=$1",
    ['rtc-agent-official-expire']);
  await rawQuery('UPDATE oauth_tokens SET revoked_at=now() WHERE client_id=$1',
    ['rtc-agent-official-revoke']);
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
  const result=await runConformance({url,passes});
  const results=new Map(result.checks.map(row=>[row.name,row]));
  // These rules genuinely apply to the documented TEST HTTPS subset.
  const applicable=['manifest','manifest.openapi','catalog','passes',
    'passes.expired','passes.revoked','safety','budget'];
  // Upstream selection() requires 1 read, 1 write, 1 guarded write. Stripe
  // deliberately exposes NO writes or full-profile passes on HTTPS.
  const fullProfile=['meta','reads','writes','passes.read_only'];
  for(const name of applicable){
    const row=results.get(name);
    if(!row?.ok||row.skipped)
      throw Error('Stripe RTC service applicable '+name+' failed: '+
        String(row?.message??'missing').slice(0,150));
    process.stdout.write('SERVICE_PASS '+name+'\n');
  }
  for(const name of fullProfile){
    const row=results.get(name);
    if(row?.ok||row?.skipped||
      !row?.message?.includes('reference probes need read, write and guarded tools'))
      throw Error('Full-profile '+name+' is unexpectedly certified or failed for another reason');
    process.stdout.write('OUT_OF_SUBSET '+name+' (upstream requires HTTPS writes)\n');
  }
  for(const name of ['oauth.refresh_settings','limits.two_instance']){
    const row=results.get(name);
    if(!row?.skipped||row?.ok)
      throw Error('Unexpected claim for independent '+name);
    process.stdout.write('INDEPENDENT_EVIDENCE '+name+' (not certified here)\n');
  }
  if(result.ok)throw Error('Read-only subset must not certify full RTC 1');
  // Invalid write remains 403; actual nonexistent names are distinct 404.
  const bad=await fetch(url+'/api/tools/stripe_payment_intent_create',{
    method:'POST',headers:{authorization:'Bearer '+passes.full,
      'content-type':'application/json'},body:'{}'});
  if(bad.status!==403||(await bad.json()).error?.code!=='refused_by_guard')
    throw Error('A forbidden money/write route must remain 403');
  process.stdout.write('SERVICE_PASS denied_write_403\n');
  process.stdout.write('RTC_TEST_SUBSET verified against actual Stripe HTTP + SQL; '+
    'no full conformance, deployed service or provider claim\n');
}finally{
  if(server)await new Promise((resolve,reject)=>
    server.close(e=>e?reject(e):resolve()));
  if(opened)await closeIsolatedSchema();
}
