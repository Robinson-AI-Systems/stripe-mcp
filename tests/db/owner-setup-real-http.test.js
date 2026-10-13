import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createServer,request as nodeRequest} from 'node:http';
import {randomBytes} from 'node:crypto';
import {createDb} from '../../src/db.js';
import {createSetupHandler} from '../../src/stripe/setup-page.js';
import {createOneTimeStore} from '../../src/core/one-time-secrets.js';
import {createOwnerSmokeRunner} from '../../src/acceptance/owner-smoke-runner.js';
import {OwnerSmokeFailure} from '../../src/acceptance/owner-smoke-failure.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';

// Actual listening HTTP socket and disposable PostgreSQL, not a provider read
// or independently connected ChatGPT MCP/Stripe Dashboard acceptance test.
const env={PUBLIC_BASE_URL:'https://owner-setup.example.test',ADMIN_PASSPHRASE:'fixture-owner-only-pass'};
let server,db,oneTimeStore,smokeMode='denied';
const account='acct_HTTPSETUP';
let smokeReads=0;
function adapt(res){
  res.status=code=>{res.statusCode=code;return res;};
  res.send=value=>{res.end(value);return res;};
}
async function start(){
  const runner=createOwnerSmokeRunner({
    db,keyStore:{loadKey:async()=> 'rk_test_FIXTUREONLYACCOUNTTOKEN'},
    run:async({account:id,focus})=>{
      smokeReads++;
      if(smokeMode==='denied')throw new OwnerSmokeFailure('provider_denied');
      return {account:id,mode:'test',focus,source:'custom_mcp_dispatch',
        verifiedIdentity:true,dashboardVerified:false,writeOperations:0,
        records:[
          {tool:'stripe_admin_overview',status:'partial'},
          {tool:'admin_review_security',status:'partial'},
          {tool:'admin_list_guided_settings',status:'not_readable'}
        ]};
    }});
  const handler=createSetupHandler({db,oneTimeStore,runTestSmoke:runner,env});
  server=createServer(async(req,res)=>{
    adapt(res);
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      req.query=Object.fromEntries(url.searchParams);
      if(req.method==='POST'){
        const parts=[];
        for await(const part of req)parts.push(part);
        req.rawBody=Buffer.concat(parts);
        req.body=req.rawBody.toString('utf8');
      }
      return await handler(req,res);
    }catch{
      if(!res.writableEnded)res.status(500).send('internal test transport failure');
    }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
}
async function http({method='GET',params='',body=null,cookie='',origin=env.PUBLIC_BASE_URL}={}){
  const wire=body===null?'':new URLSearchParams(body).toString();
  const headers={host:'owner-setup.example.test'};
  if(cookie)headers.cookie=cookie;
  if(method==='POST'){
    headers.origin=origin;
    headers['content-type']='application/x-www-form-urlencoded';
    headers['content-length']=String(Buffer.byteLength(wire));
  }
  return await new Promise((resolve,reject)=>{
    const req=nodeRequest({host:'127.0.0.1',port:server.address().port,
      method,path:'/api/stripe/setup'+params,headers},res=>{
      const chunks=[];
      res.on('data',x=>chunks.push(x));
      res.on('end',()=>resolve({status:res.statusCode,
        headers:res.headers,html:Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error',reject);
    if(wire)req.write(wire);
    req.end();
  });
}
function csrfOf(get){
  const set=get.headers['set-cookie']?.[0]||'';
  const token=/stripe_setup_csrf=([A-Za-z0-9_-]{43})/.exec(set)?.[1];
  if(!token)throw Error('Owner CSRF cookie missing');
  return {csrf:token,cookie:'stripe_setup_csrf='+token};
}
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Disposable localhost PostgreSQL required');
  await openIsolatedSchema(dsn);
  db=createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts (id,label,test_key_enc) VALUES($1,$2,$3)',
    [account,'TEST <em>owner</em>','synthetic-not-a-key']);
  await rawQuery('INSERT INTO stripe_accounts (id,label,live_key_enc) VALUES($1,$2,$3)',
    ['acct_HTTPONLYLIVE','HIDDEN LIVE','synthetic-not-a-key']);
  oneTimeStore=createOneTimeStore({db,encryptionKey:randomBytes(32)});
  await start();
});
afterAll(async()=>{
  if(server)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await closeIsolatedSchema();
});
describe('real owner setup HTTP and disposable PostgreSQL',()=>{
  it('renders the first-screen TEST form, no-store headers, and real SQL login gates',async()=>{
    const get=await http();
    expect(get.status).toBe(200);
    expect(get.headers['cache-control']).toBe('no-store');
    expect(get.headers['referrer-policy']).toBe('no-referrer');
    expect(get.html).toContain('id="readiness-tests"');
    expect(get.html).toContain('list-test-accounts');
    const c=csrfOf(get);
    const denied=await http({method:'POST',cookie:c.cookie,body:{
      action:'list-test-accounts',csrf:c.csrf,passphrase:'wrong'}});
    expect(denied.status).toBe(401);
    expect(denied.html).not.toContain(account);
    const forged=await http({method:'POST',cookie:c.cookie,origin:'https://another.example.test',
      body:{action:'list-test-accounts',csrf:c.csrf,passphrase:env.ADMIN_PASSPHRASE}});
    expect(forged.status).toBe(403);
  });
  it('lists only owner-private TEST-enrolled account metadata after correct password',async()=>{
    const c=csrfOf(await http());
    const r=await http({method:'POST',cookie:c.cookie,body:{
      action:'list-test-accounts',csrf:c.csrf,passphrase:env.ADMIN_PASSPHRASE}});
    expect(r.status).toBe(200);
    expect(r.html).toContain(account);
    expect(r.html).toContain('TEST &lt;em&gt;owner&lt;/em&gt;');
    expect(r.html).not.toContain('acct_HTTPONLYLIVE');
    expect(r.html).not.toContain('synthetic-not-a-key');
  });
  it('distinguishes failed identity stage from a synthetic classified tool report',async()=>{
    const c=csrfOf(await http());
    const body={action:'run-test-smoke',csrf:c.csrf,account,
      focus:'administration',passphrase:env.ADMIN_PASSPHRASE};
    smokeMode='denied';
    const failed=await http({method:'POST',cookie:c.cookie,body});
    expect(failed.status).toBe(503);
    expect(failed.html).toContain('TEST stage: provider_denied');
    expect(failed.html).toContain('No acceptance recorded');
    smokeMode='synthetic-report';
    const report=await http({method:'POST',cookie:c.cookie,body});
    expect(report.status).toBe(200);
    expect(report.html).toContain('Read-only TEST report returned');
    expect(report.html).toContain('Observed: 0; partial: 2; not readable: 1; error: 0');
    expect(report.html).toContain('not Dashboard acceptance');
    expect(report.html).not.toContain('rk_test_FIXTUREONLYACCOUNTTOKEN');
    expect(smokeReads).toBeGreaterThanOrEqual(2);
  });
  it('consumes a real encrypted one-time secret once and lifts it above all other forms',async()=>{
    const once=await oneTimeStore.issue({kind:'rtc-pass',secret:'fixture-reveal-only',
      account,mode:'test'});
    const c=csrfOf(await http({params:'?show='+once.id}));
    const body={action:'reveal',csrf:c.csrf,id:once.id,passphrase:env.ADMIN_PASSPHRASE};
    const shown=await http({method:'POST',cookie:c.cookie,body});
    expect(shown.status).toBe(200);
    expect(shown.html).toContain('fixture-reveal-only');
    expect(shown.html.indexOf('One-time secret — copy it now')).toBeLessThan(
      shown.html.indexOf('id="readiness-tests"'));
    const second=await http({method:'POST',cookie:c.cookie,body});
    expect(second.status).toBe(410);
    expect(second.html).not.toContain('fixture-reveal-only');
  });
});
