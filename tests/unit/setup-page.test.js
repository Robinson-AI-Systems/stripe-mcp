import { describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createSetupHandler } from '../../src/stripe/setup-page.js';
import {OwnerSmokeFailure} from '../../src/acceptance/owner-smoke-failure.js';
import {createOwnerSmokeRunner} from '../../src/acceptance/owner-smoke-runner.js';
import { createFakeDb } from '../../test/helpers/fake-db.js';
import { createKeyStore } from '../../src/keys.js';
import { createOneTimeStore } from '../../src/core/one-time-secrets.js';
import { makeFakeStripe } from '../../test/helpers/fake-stripe.js';

const env={PUBLIC_BASE_URL:'https://stripe.example.test',ADMIN_PASSPHRASE:'fixture-owner-password'};
const testKey=()=>['rk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
function res() { return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},status(n){this.statusCode=n;return this;},
  send(v){this.body=v;return this;},json(v){this.body=JSON.stringify(v);return this;}};
}
function req(method, body={}, headers={}) {return {method,body,headers,query:method==='GET'?body:{},
  socket:{remoteAddress:'192.0.2.13'}};}
function cookiePage(response){
  const cookie=response.headers['Set-Cookie'].split(';')[0];
  const csrf=cookie.split('=')[1];
  return {cookie,csrf};
}
async function fixture(){
  const db=createFakeDb(),fake=makeFakeStripe(),encryptionKey=randomBytes(32);
  fake.when('accounts.retrieve').resolves({object:'account',id:'acct_FAKESETUP',
    livemode:false,business_profile:{name:'My Project'}});
  const keyStore=createKeyStore({db,encryptionKey,makeClient:()=>fake.stripe,
    probe:async()=>({customers:'ok',refunds:'denied'})});
  const oneTimeStore=createOneTimeStore({db,encryptionKey});
  return {db,keyStore,oneTimeStore,handler:createSetupHandler({db,keyStore,oneTimeStore,env})};
}
async function page(handler, query={}) {const r=res();await handler(req('GET',query),r);return r;}
async function submit(handler,c,body,origin=env.PUBLIC_BASE_URL){
  const r=res();
  await handler(req('POST',{csrf:c.csrf,...body},{origin,cookie:c.cookie}),r);
  return r;
}
describe('canonical owner setup origin',()=>{
  it('redirects alternate Vercel alias GET to the configured issuer without creating a CSRF cookie',async()=>{
    const {handler}=await fixture();
    const r=res();
    await handler(req('GET',{liveEnable:'secret-selector',show:'one-time-selector'},
      {host:'stripe-mcp-psi.vercel.app'}),r);
    expect(r.statusCode).toBe(302);
    expect(r.headers.Location).toBe(env.PUBLIC_BASE_URL+'/api/stripe/setup');
    expect(r.headers['Set-Cookie']).toBeUndefined();
    expect(r.headers['Cache-Control']).toBe('no-store');
    expect(r.headers['Referrer-Policy']).toBe('no-referrer');
    expect(r.body).not.toContain('secret-selector');
    expect(r.body).not.toContain('one-time-selector');
  });
  it('serves a protected form on the canonical host and refuses alias-origin POST',async()=>{
    const {handler}=await fixture();
    const canonical=res();
    await handler(req('GET',{}, {host:'stripe.example.test'}),canonical);
    expect(canonical.statusCode).toBe(200);
    const c=cookiePage(canonical);
    const r=res();
    await handler(req('POST',{csrf:c.csrf,action:'run-test-smoke',
      account:'acct_SAFEOWNER',focus:'administration',passphrase:env.ADMIN_PASSPHRASE},
      {host:'stripe-mcp-psi.vercel.app',origin:'https://stripe-mcp-psi.vercel.app',
        cookie:c.cookie}),r);
    expect(r.statusCode).toBe(403);
    expect(r.body).toContain('Origin check failed');
  });
});

describe('owner TEST feedback visibly above all forms',()=>{
  it('puts the read-only TEST form on the first screen and no success claim on initial GET',async()=>{
    const {handler}=await fixture();
    const response=await page(handler);
    const html=response.body;
    expect(html.indexOf('id="readiness-tests"')).toBeLessThan(
      html.indexOf('Provision TEST webhook signature verification'));
    expect(html).not.toContain('id="owner-feedback"');
    expect(html).toContain('Run read-only custom MCP TEST checks');
  });
  it('shows a readable report at the top with per-tool statuses but never claims full acceptance',async()=>{
    const db=createFakeDb();
    const runTestSmoke=async({account,focus})=>({
      account,focus,mode:'test',source:'custom_mcp_dispatch',
      verifiedIdentity:true,dashboardVerified:false,writeOperations:0,
      key:'rk_test_NOT_FOR_BROWSER',
      records:[
        {tool:'stripe_admin_overview',status:'observed'},
        {tool:'admin_review_security',status:'partial'},
        {tool:'admin_list_guided_settings',status:'not_readable'}
      ]});
    const handler=createSetupHandler({db,runTestSmoke,env});
    const c=cookiePage(await page(handler));
    const reply=await submit(handler,c,{action:'run-test-smoke',account:'acct_SAFEOWNER',
      focus:'administration',passphrase:env.ADMIN_PASSPHRASE});
    expect(reply.statusCode).toBe(200);
    const html=reply.body;
    expect(html.indexOf('id="owner-feedback"')).toBeLessThan(
      html.indexOf('id="readiness-tests"'));
    expect(html).toContain('Read-only TEST report returned — readiness NOT certified.');
    expect(html).toContain('Checks returned: <strong>3</strong>');
    expect(html).toContain('Observed: 1; partial: 1; not readable: 1; error: 0.');
    expect(html).toContain('Administration overview');
    expect(html).toContain('Security review');
    expect(html).toContain('Dashboard-only guided settings');
    expect(html).toContain('View sanitized technical report');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('rk_test_NOT_FOR_BROWSER');
    expect(html).not.toContain('Account ready');
  });
  it('shows rejected or failed owner requests at the top without pretending a smoke report ran',async()=>{
    const db=createFakeDb(),runTestSmoke=vi.fn(async()=>{throw Error('private upstream credential');});
    const handler=createSetupHandler({db,runTestSmoke,env});
    const c=cookiePage(await page(handler));
    const payload={action:'run-test-smoke',account:'acct_SAFEOWNER',
      focus:'administration',passphrase:env.ADMIN_PASSPHRASE};
    const failed=await submit(handler,c,payload);
    expect(failed.statusCode).toBe(503);
    expect(failed.body.indexOf('id="owner-feedback"')).toBeLessThan(
      failed.body.indexOf('id="readiness-tests"'));
    expect(failed.body).toContain('No acceptance recorded');
    expect(failed.body).not.toContain('Read-only TEST report returned');
    expect(failed.body).not.toContain('private upstream credential');
    const denied=await submit(handler,c,{...payload,passphrase:'incorrect'});
    expect(denied.statusCode).toBe(401);
    expect(denied.body.indexOf('id="owner-feedback"')).toBeLessThan(
      denied.body.indexOf('id="readiness-tests"'));
    expect(denied.body).toContain('Incorrect administrator passphrase.');
    expect(runTestSmoke).toHaveBeenCalledTimes(1);
  });
});

describe('owner-authenticated TEST smoke on existing custom MCP',()=>{
  it('checks strict origin, CSRF, passphrase, exact TEST account and redacts report',async()=>{
    const db=createFakeDb();
    const calls=[];
    const runTestSmoke=async({account})=>{
      calls.push(account);
      return {account,mode:'test',focus:'core',source:'custom_mcp_dispatch',
        verifiedIdentity:true,dashboardVerified:false,writeOperations:0,
        records:['account_get','account_list_capabilities','account_list_payment_method_settings',
          'account_list_apple_pay_domains','event_list','webhook_list',
          'admin_list_requirements','admin_check_setting'].map(tool=>({
            tool,status:tool==='webhook_list'?'partial':'observed'
          })),key:'rk_test_FAKE_SHOULD_NOT_BE_EXPOSED'};
    };
    const handler=createSetupHandler({db,runTestSmoke,env});
    const c=cookiePage(await page(handler));
    const request={action:'run-test-smoke',account:'acct_SAFEOWNER',focus:'core',
      passphrase:env.ADMIN_PASSPHRASE};
    expect((await submit(handler,c,request,'https://evil.example.test')).statusCode).toBe(403);
    expect((await submit(handler,{...c,csrf:'wrong'},request)).statusCode).toBe(403);
    expect((await submit(handler,c,{...request,passphrase:'wrong'})).statusCode).toBe(401);
    expect((await submit(handler,c,{...request,account:'acct_$OTHER'})).statusCode).toBe(400);
    expect(calls).toHaveLength(0);
    const response=await submit(handler,c,request);
    expect(response.statusCode).toBe(200);
    expect(calls).toEqual(['acct_SAFEOWNER']);
    expect(response.body).toContain('custom_mcp_dispatch');
    expect(response.body).toContain('partial');
    expect(response.body).toContain('configuredSettingsVerified');
    expect(response.body).toContain('webhookDeliveryVerified');
    expect(response.body).toContain('Only the listed exceptions');
    expect(response.body).not.toContain('rk_test_FAKE_SHOULD_NOT_BE_EXPOSED');
    expect(response.body).toContain('not Dashboard acceptance');
  });
  it('refuses malformed or foreign provider results and never reports completion',async()=>{
    const db=createFakeDb();
    const handler=createSetupHandler({db,env,
      runTestSmoke:async()=>({account:'acct_FOREIGN',mode:'test',records:[]})});
    const c=cookiePage(await page(handler));
    const response=await submit(handler,c,{action:'run-test-smoke',
      account:'acct_SAFEOWNER',focus:'core',passphrase:env.ADMIN_PASSPHRASE});
    expect(response.statusCode).toBe(503);
    expect(response.body).toContain('No acceptance recorded');
    expect(response.body).not.toContain('acct_FOREIGN');
  });
});

describe('isolated owner TEST acceptance groups',()=>{
  it('accepts only exact tool results from each focused group and never raw provider records',async()=>{
    const cases={
      account:['account_get','account_list_capabilities',
        'account_list_payment_method_settings','account_list_apple_pay_domains'],
      webhooks:['event_list','webhook_list'],
      readiness:['admin_list_requirements','admin_check_setting']
    };
    const db=createFakeDb();
    const runTestSmoke=vi.fn(async({account,focus})=>({
      account,focus,mode:'test',source:'custom_mcp_dispatch',
      verifiedIdentity:true,dashboardVerified:false,writeOperations:0,
      key:'rk_test_DO_NOT_EXPOSE',
      records:cases[focus].map(tool=>({tool,status:'partial'}))
    }));
    const handler=createSetupHandler({db,runTestSmoke,env});
    const c=cookiePage(await page(handler));
    for(const focus of Object.keys(cases)){
      const data={action:'run-test-smoke',account:'acct_SAFEOWNER',focus,
        passphrase:env.ADMIN_PASSPHRASE};
      const r=await submit(handler,c,data);
      expect(r.statusCode).toBe(200);
      expect(r.body).toContain(focus);
      expect(r.body).not.toContain('rk_test_DO_NOT_EXPOSE');
      expect(r.body).toContain('not Dashboard acceptance');
    }
    expect(runTestSmoke).toHaveBeenCalledTimes(3);
    const bad=await submit(handler,c,{action:'run-test-smoke',account:'acct_SAFEOWNER',
      focus:'all',passphrase:env.ADMIN_PASSPHRASE});
    expect(bad.statusCode).toBe(400);
    expect(runTestSmoke).toHaveBeenCalledTimes(3);
  });
  it('refuses altered tool names, duplicate tools and foreign focus even from a runner',async()=>{
    const db=createFakeDb();
    const base={account:'acct_SAFEOWNER',mode:'test',focus:'webhooks',
      source:'custom_mcp_dispatch',verifiedIdentity:true,
      dashboardVerified:false,writeOperations:0};
    const cases=[
      [{tool:'event_list',status:'observed'},{tool:'event_list',status:'observed'}],
      [{tool:'event_list',status:'observed'},{tool:'stripe_get_result',status:'observed'}]
    ];
    for(const records of cases){
      const handler=createSetupHandler({db,env,
        runTestSmoke:async()=>({...base,records})});
      const c=cookiePage(await page(handler));
      const r=await submit(handler,c,{action:'run-test-smoke',account:'acct_SAFEOWNER',
        focus:'webhooks',passphrase:env.ADMIN_PASSPHRASE});
      expect(r.statusCode).toBe(503);
      expect(r.body).toContain('No acceptance recorded');
    }
  });
});
describe('separate G-6 owner administration TEST smoke gate',()=>{
  it('accepts exactly the three admin tools but never provider payloads or Dashboard success',async()=>{
    const db=createFakeDb();
    const fn=async ({account,focus})=>({account,focus,mode:'test',
      source:'custom_mcp_dispatch',verifiedIdentity:true,dashboardVerified:false,
      writeOperations:0,key:'rk_test_NEVER_IN_BROWSER',
      records:['stripe_admin_overview','admin_review_security',
        'admin_list_guided_settings'].map((tool,i)=>({
          tool,status:i===2?'not_readable':'partial'}))});
    const handler=createSetupHandler({db,runTestSmoke:fn,env});
    const c=cookiePage(await page(handler));
    const correct={action:'run-test-smoke',account:'acct_SAFEOWNER',
      focus:'administration',passphrase:env.ADMIN_PASSPHRASE};
    const out=await submit(handler,c,correct);
    expect(out.statusCode).toBe(200);
    expect(out.body).toContain('administration');
    expect(out.body).toContain('stripe_admin_overview');
    expect(out.body).not.toContain('rk_test_NEVER_IN_BROWSER');
    expect(out.body).toContain('not Dashboard acceptance');
    expect((await submit(handler,c,{...correct,focus:'everything'})).statusCode).toBe(400);
  });
});

describe('owner-only Toolkit RTC read-only pass issuance',()=>{
  it('requires password, origin and CSRF; never leaks a bearer in responses',async()=>{
    const db=createFakeDb();
    let issued=0;
    const handler=createSetupHandler({db,env,issueRtcPass:async({account,areas})=>{
      issued++;
      expect(account).toBe('acct_SAFEPASS');
      expect(areas).toBe('server,account');
      return {id:'rtc-agent-123456abcdef',setupPath:'/api/stripe/setup?show='+'A'.repeat(32)};
    }});
    const c=cookiePage(await page(handler));
    const action={action:'issue-rtc-pass',account:'acct_SAFEPASS',
      areas:'server,account',passphrase:env.ADMIN_PASSPHRASE};
    expect((await submit(handler,c,action,'https://evil.test')).statusCode).toBe(403);
    expect((await submit(handler,{...c,csrf:'bad'},action)).statusCode).toBe(403);
    expect((await submit(handler,c,{...action,passphrase:'wrong'})).statusCode).toBe(401);
    expect(issued).toBe(0);
    const reply=await submit(handler,c,action);
    expect(reply.statusCode).toBe(200);
    expect(reply.body).toContain('rtc-agent-123456abcdef');
    expect(reply.body).not.toContain('rtc_pass_');
    expect(issued).toBe(1);
  });
});
describe('A-5b owner-only Stripe setup page',()=>{
  it('offers key entry directly in HTML without exposing account data or requiring env key on GET',async()=>{
    const {handler}=await fixture();
    const r=await page(handler), c=cookiePage(r);
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('Stripe TEST restricted or secret key');
    expect(r.body).not.toContain('acct_FAKESETUP');
    expect(r.headers['Cache-Control']).toBe('no-store');
    expect(r.headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(c.cookie).toMatch(/^stripe_setup_csrf=/);
    expect(r.headers['Set-Cookie']).toContain('HttpOnly; Secure; SameSite=Strict');
  });
  it('rejects forged-origin, missing CSRF, wrong password, and forged live keys',async()=>{
    const {handler,db}=await fixture(), c=cookiePage(await page(handler));
    const body={action:'add-key',passphrase:env.ADMIN_PASSPHRASE,key:testKey()};
    expect((await submit(handler,c,body,'https://evil.example.test')).statusCode).toBe(403);
    expect((await submit(handler,{cookie:c.cookie,csrf:'wrong'},body)).statusCode).toBe(403);
    const wrong=await submit(handler,c,{...body,passphrase:'wrong'});
    expect(wrong.statusCode).toBe(401);
    expect(wrong.body).not.toContain(testKey());
    expect((await db.listStripeAccounts())).toEqual([]);
    const live=await submit(handler,c,{...body,key:['sk','live','FAKEFAKE'].join('_')});
    expect(live.statusCode).toBe(400);
    expect((await db.listStripeAccounts())).toEqual([]);
  });
  it('verifies and stores a test key only after valid owner password and CSRF',async()=>{
    const {handler,db}=await fixture(),c=cookiePage(await page(handler));
    const key=testKey();
    const stored=await submit(handler,c,{action:'add-key',passphrase:env.ADMIN_PASSPHRASE,key});
    expect(stored.statusCode).toBe(200);
    expect(stored.body).toContain('acct_FAKESETUP');
    expect(stored.body).toContain(key.slice(-4));
    expect(stored.body).not.toContain(key);
    expect((await db.getEncryptedKey({account:'acct_FAKESETUP',mode:'test'})).ciphertext).toMatch(/^v1\./);
    expect((await db.getStripeAccount('acct_FAKESETUP')).key_permissions)
      .toEqual({customers:'ok',refunds:'denied'});
  });
  it('reveals a one-time secret only on owner-authenticated POST and never again',async()=>{
    const {handler,oneTimeStore}=await fixture();
    const secret='fixture-private-once';
    const issued=await oneTimeStore.issue({account:'acct_FAKESETUP',kind:'webhook-secret',secret});
    const r=await page(handler,{show:issued.id});
    expect(r.body).not.toContain(secret);
    const c=cookiePage(r);
    const wrong=await submit(handler,c,{action:'reveal',id:issued.id,passphrase:'wrong'});
    expect(wrong.statusCode).toBe(401);
    expect(wrong.body).not.toContain(secret);
    const shown=await submit(handler,c,{action:'reveal',id:issued.id,passphrase:env.ADMIN_PASSPHRASE});
    expect(shown.statusCode).toBe(200);
    expect(shown.body).toContain(secret);
    const again=await submit(handler,c,{action:'reveal',id:issued.id,passphrase:env.ADMIN_PASSPHRASE});
    expect(again.statusCode).toBe(410);
    expect(again.body).not.toContain(secret);
  });
  it('locks the page when password attempts exceed the documented limit',async()=>{
    const {handler}=await fixture(),c=cookiePage(await page(handler));
    for(let i=0;i<5;i++)expect((await submit(handler,c,{action:'add-key',passphrase:'wrong',key:testKey()})).statusCode).toBe(401);
    const locked=await submit(handler,c,{action:'add-key',passphrase:env.ADMIN_PASSPHRASE,key:testKey()});
    expect(locked.statusCode).toBe(429);
    expect(locked.headers['Retry-After']).toBe('900');
  });
});

describe('B-2b owner-only two-step LIVE page (fake database only)', () => {
  async function intentPage({allow=false,connected=true, clock=()=>Date.now()}={}) {
    const account='acct_FAKE_LIVE_PAGE';
    const db=createFakeDb({accounts:[{id:account,label:'Fixture business',
      live_connected:connected,live_enabled:false}],clock});
    const id='L'.repeat(32);
    await db.createLiveEnableIntent({id,account,expiresAt:new Date(clock()+600000)});
    const handler=createSetupHandler({db,keyStore:null,oneTimeStore:null,
      env:{...env,LIVE_MODE_OWNER_APPROVED:allow?'true':'false'}});
    const p=await page(handler,{liveEnable:id});
    return {account,db,id,handler,p,c:cookiePage(p)};
  }
  const payload=(id,consent='yes',password=env.ADMIN_PASSPHRASE)=>({
    action:'enable-live',id,ownerLiveConsent:consent,passphrase:password
  });
  it('does not activate from GET or with the owner approval environment gate OFF', async()=>{
    const x=await intentPage();
    expect(x.p.body).toContain('Fixture business');
    expect(x.p.body).toContain('LIVE');
    expect((await x.db.getStripeAccount(x.account)).live_enabled).toBe(false);
    const response=await submit(x.handler,x.c,payload(x.id));
    expect(response.statusCode).toBe(403);
    expect((await x.db.getLiveEnableIntent(x.id))).not.toBeNull();
    expect((await x.db.getStripeAccount(x.account)).live_enabled).toBe(false);
  });
  it('rejects wrong password, missing owner consent, wrong origin and absent CSRF',async()=>{
    const x=await intentPage({allow:true});
    expect((await submit(x.handler,x.c,payload(x.id),'https://invalid.test')).statusCode).toBe(403);
    expect((await submit(x.handler,{cookie:x.c.cookie,csrf:'bad'},payload(x.id))).statusCode).toBe(403);
    expect((await submit(x.handler,x.c,payload(x.id,'yes','bad'))).statusCode).toBe(401);
    expect((await submit(x.handler,x.c,payload(x.id,'no'))).statusCode).toBe(400);
    expect((await x.db.getStripeAccount(x.account)).live_enabled).toBe(false);
  });
  it('consumes only the exact intent once, after owner reauthentication and explicit consent',async()=>{
    const x=await intentPage({allow:true});
    const response=await submit(x.handler,x.c,payload(x.id));
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('LIVE mode enabled');
    expect((await x.db.getStripeAccount(x.account)).live_enabled).toBe(true);
    expect((await submit(x.handler,x.c,payload(x.id))).statusCode).toBe(410);
    expect((await x.db.listAuditForTest()).filter(r=>r.tool==='stripe_enable_live')).toHaveLength(1);
  });
  it('fails closed if a LIVE key is not verified, even with owner consent',async()=>{
    const x=await intentPage({allow:true,connected:false});
    expect((await submit(x.handler,x.c,payload(x.id))).statusCode).toBe(409);
    expect((await x.db.getStripeAccount(x.account)).live_enabled).toBe(false);
  });
  it('refuses an expired live intent',async()=>{
    let now=Date.UTC(2026,9,10,12);
    const x=await intentPage({allow:true,clock:()=>now});
    now+=600001;
    expect(await x.db.getLiveEnableIntent(x.id)).toBeNull();
    expect((await submit(x.handler,x.c,payload(x.id))).statusCode).toBe(410);
    expect((await x.db.getStripeAccount(x.account)).live_enabled).toBe(false);
  });
});

describe('G-1g owner-authenticated CSV browser delivery',()=>{
  it('requires same-origin CSRF, password, valid report and returns bytes only to browser',async()=>{
    const db=createFakeDb(),reportDownload=vi.fn(async()=>({
      bytes:Buffer.from('entry,total\\n1,20\\n'),
      filename:'stripe-report-frr_FAKE123.csv'
    }));
    const handler=createSetupHandler({db,keyStore:null,oneTimeStore:null,reportDownload,env});
    const initial=await page(handler),token=cookiePage(initial);
    expect(initial.body).toContain('Download private CSV');
    expect(initial.body).not.toContain('entry,total');
    const request={action:'download-report',account:'acct_FAKE123',run:'frr_FAKE123',
      passphrase:env.ADMIN_PASSPHRASE};
    expect((await submit(handler,token,request,'https://evil.example.test')).statusCode).toBe(403);
    expect((await submit(handler,{cookie:token.cookie,csrf:'wrong'},request)).statusCode).toBe(403);
    expect((await submit(handler,token,{...request,passphrase:'wrong'})).statusCode).toBe(401);
    expect(reportDownload).not.toHaveBeenCalled();
    const result=await submit(handler,token,request);
    expect(result.statusCode).toBe(200);
    expect(Buffer.isBuffer(result.body)).toBe(true);
    expect(result.headers['Content-Type']).toContain('text/csv');
    expect(result.headers['Content-Disposition']).toBe('attachment; filename="stripe-report-frr_FAKE123.csv"');
    expect(result.headers['Cache-Control']).toContain('no-store');
    expect(result.headers['Set-Cookie']).toContain('Max-Age=0');
    expect(reportDownload).toHaveBeenCalledWith({account:'acct_FAKE123',run:'frr_FAKE123'});
    expect(result.body.toString()).toContain('entry,total');
  });
  it('fails closed for unavailable export and never reveals provider or key errors',async()=>{
    const db=createFakeDb();
    const reportDownload=vi.fn(async()=>{throw Error('secret upstream provider URL');});
    const handler=createSetupHandler({db,keyStore:null,oneTimeStore:null,reportDownload,env});
    const token=cookiePage(await page(handler));
    const result=await submit(handler,token,{action:'download-report',
      account:'acct_FAKE123',run:'frr_FAKE123',passphrase:env.ADMIN_PASSPHRASE});
    expect(result.statusCode).toBe(404);
    expect(result.body).not.toContain('secret upstream');
    expect(result.body).toContain('unavailable');
  });
});


describe('owner-private signed TEST webhook receipt evidence readback',()=>{
  it('requires exact origin, CSRF and owner passphrase before any receipt read',async()=>{
    const db=createFakeDb(),calls=[];
    const lookupTestReceipt=async info=>{
      calls.push(info);
      return {eventId:info.eventId,eventType:'invoice.paid',
        receivedAt:new Date('2026-10-12T13:00:00.000Z')};
    };
    const handler=createSetupHandler({db,env,lookupTestReceipt});
    const c=cookiePage(await page(handler));
    const action={action:'lookup-test-receipt',account:'acct_TESTPROOF',
      endpoint:'we_TESTPROOF',eventId:'evt_TESTPROOF',
      passphrase:env.ADMIN_PASSPHRASE};
    expect((await submit(handler,c,action,'https://untrusted.test')).statusCode).toBe(403);
    expect((await submit(handler,{...c,csrf:'wrong'},action)).statusCode).toBe(403);
    expect((await submit(handler,c,{...action,passphrase:'wrong'})).statusCode).toBe(401);
    expect((await submit(handler,c,{...action,eventId:'in_WRONG'})).statusCode).toBe(400);
    expect(calls).toHaveLength(0);
    const okay=await submit(handler,c,action);
    expect(okay.statusCode).toBe(200);
    expect(calls).toEqual([{account:'acct_TESTPROOF',endpoint:'we_TESTPROOF',
      eventId:'evt_TESTPROOF'}]);
    expect(okay.body).toContain('invoice.paid');
    expect(okay.body).toContain('2026-10-12T13:00:00.000Z');
    expect(okay.body).toContain('separately unverified');
    expect(okay.body).not.toContain('in_PRIVATE_EVENT');
  });
  it('does not expose foreign, missing, or malformed TEST receipts',async()=>{
    const db=createFakeDb(),candidates=[
      [null,404],
      [{eventId:'evt_OTHER',eventType:'invoice.paid',receivedAt:new Date()},503],
      [{eventId:'evt_TESTPROOF',eventType:'unexpected',receivedAt:new Date()},503],
      [{eventId:'evt_TESTPROOF',eventType:'invoice.paid',receivedAt:'broken'},503]
    ];
    for(const [value,expected] of candidates){
      const handler=createSetupHandler({db,env,lookupTestReceipt:async()=>value});
      const c=cookiePage(await page(handler));
      const reply=await submit(handler,c,{action:'lookup-test-receipt',
        account:'acct_TESTPROOF',endpoint:'we_TESTPROOF',eventId:'evt_TESTPROOF',
        passphrase:env.ADMIN_PASSPHRASE});
      expect(reply.statusCode).toBe(expected);
      expect(reply.body).not.toContain('evt_OTHER');
    }
  });
});

describe('owner TEST diagnostic stage contract',()=>{
  it('separates non-enrolled, key-unavailable and upstream stages behind owner auth',async()=>{
    const db=createFakeDb();
    const keyStore={loadKey:vi.fn(async()=>{throw Error('key material decrypt failure with private secret');})};
    const failures=[
      [null,'not_enrolled',false],
      [{test_connected:false},'not_enrolled',false],
      [{test_connected:true},'key_unavailable',true]
    ];
    for(const [record,stage,shouldLoad] of failures){
      db.getStripeAccount=vi.fn(async()=>record);
      keyStore.loadKey.mockClear();
      const runTestSmoke=createOwnerSmokeRunner({db,keyStore,run:vi.fn()});
      const handler=createSetupHandler({db,runTestSmoke,env});
      const c=cookiePage(await page(handler));
      const reply=await submit(handler,c,{action:'run-test-smoke',account:'acct_SAFEOWNER',
        focus:'administration',passphrase:env.ADMIN_PASSPHRASE});
      expect(reply.statusCode).toBe(503);
      expect(reply.body).toContain('TEST stage: '+stage);
      expect(reply.body).toContain('No acceptance recorded.');
      expect(reply.body).not.toContain('private secret');
      expect(keyStore.loadKey).toHaveBeenCalledTimes(shouldLoad?1:0);
    }
  });
  it('shows only stable typed stages and hides fabricated provider failures',async()=>{
    const db=createFakeDb();
    for(const [error,stage] of [
      [new OwnerSmokeFailure('provider_denied'),'provider_denied'],
      [new OwnerSmokeFailure('identity_unverified'),'identity_unverified'],
      [new OwnerSmokeFailure('identity_incomplete'),'identity_incomplete'],
      [new OwnerSmokeFailure('tool_unavailable'),'tool_unavailable'],
      [new Error('rk_test_PRIVATE_PASSWORD'),'unavailable']
    ]){
      const handler=createSetupHandler({db,env,runTestSmoke:async()=>{throw error}});
      const token=cookiePage(await page(handler));
      const reply=await submit(handler,token,{action:'run-test-smoke',
        account:'acct_SAFEOWNER',focus:'administration',passphrase:env.ADMIN_PASSPHRASE});
      expect(reply.statusCode).toBe(503);
      expect(reply.body).toContain('TEST stage: '+stage);
      expect(reply.body).not.toContain('rk_test_PRIVATE_PASSWORD');
      expect(reply.body).not.toContain('TEST report returned');
    }
  });
});

describe('all owner setup workflows — private UX, isolation and safe GET',()=>{
  it('keeps exactly one copy of each owner form under explicit native groups',async()=>{
    const {handler}=await fixture();
    const response=await page(handler);
    const html=response.body;
    const actions=['list-app-profiles','bind-app-profile','enable-app-scope',
      'list-test-accounts','run-test-smoke','provision-webhook-secret',
      'forget-webhook-secret','download-report','lookup-test-receipt','issue-rtc-pass',
      'add-key','request-revoke','request-disable-live','request-default-account',
      'request-money-limit','view-money-requests'];
    for(const action of actions){
      expect(html.split('name="action" value="'+action+'"')).toHaveLength(2);
    }
    expect(html.match(/<details class="owner-group"/g)).toHaveLength(10);
    expect(html.match(/<\/details>/g)).toHaveLength(10);
    expect(html).toContain('id="webhook-tools"');
    expect(html).toContain('id="rtc-pass-tools"');
    expect(html).toContain('id="live-disable-tools"');
    expect(html.indexOf('id="readiness-tests"')).toBeLessThan(
      html.indexOf('id="webhook-tools"'));
    expect(html).not.toContain('id="owner-follow-up"');
  });
  it('rejects malformed GET selectors before database reads and protects referrer',async()=>{
    const {db,handler}=await fixture();
    db.getLiveEnableIntent=vi.fn();
    const r=await page(handler,{show:'<script>alert(1)</script>',liveEnable:'_'.repeat(1500)});
    expect(r.statusCode).toBe(200);
    expect(r.body).not.toContain('type="hidden" name="id" value="&lt;script&gt;');
    expect(db.getLiveEnableIntent).not.toHaveBeenCalled();
    expect(r.headers['Referrer-Policy']).toBe('no-referrer');
    expect(r.headers['X-Frame-Options']).toBe('DENY');
    expect(r.headers['Cache-Control']).toBe('no-store');
  });
  it('lists only exact enrolled TEST accounts after owner password and escapes stored labels',async()=>{
    const {db,handler}=await fixture();
    db.listStripeAccounts=vi.fn(async()=>[
      {id:'acct_OWNERTEST',label:'Sample <b>rental</b>',is_default:true,test_connected:true},
      {id:'acct_LIVEONLY',label:'Must not display',is_default:false,test_connected:false}
    ]);
    const c=cookiePage(await page(handler));
    const wrong=await submit(handler,c,{action:'list-test-accounts',passphrase:'incorrect'});
    expect(wrong.statusCode).toBe(401);
    expect(wrong.body).not.toContain('acct_OWNERTEST');
    expect(db.listStripeAccounts).not.toHaveBeenCalled();
    const okay=await submit(handler,c,{action:'list-test-accounts',passphrase:env.ADMIN_PASSPHRASE});
    expect(okay.statusCode).toBe(200);
    expect(okay.body).toContain('acct_OWNERTEST');
    expect(okay.body).toContain('Sample &lt;b&gt;rental&lt;/b&gt;');
    expect(okay.body).toContain('default for new connections');
    expect(okay.body).not.toContain('acct_LIVEONLY');
    expect(okay.body).not.toContain('Must not display');
    expect(okay.body.indexOf('id="enrolled-accounts"')).toBeLessThan(
      okay.body.indexOf('id="readiness-tests"'));
  });
  it('rejects malformed private inventory rather than printing unverified records',async()=>{
    const {db,handler}=await fixture();
    db.listStripeAccounts=vi.fn(async()=>[{id:'acct_OWNER',label:'bad',test_connected:true,is_default:'yes'}]);
    const c=cookiePage(await page(handler));
    const r=await submit(handler,c,{action:'list-test-accounts',passphrase:env.ADMIN_PASSPHRASE});
    expect(r.statusCode).toBe(503);
    expect(r.body).not.toContain('acct_OWNER');
    expect(r.body).toContain('No key or account details returned.');
  });
  it('displays one-time credentials prominently before unrelated setup forms',async()=>{
    const {oneTimeStore,handler}=await fixture();
    const issued=await oneTimeStore.issue({kind:'rtc-pass',account:'acct_SAFEOWNER',mode:'test',
      secret:'test-owner-private-token',ttlSeconds:3600});
    const c=cookiePage(await page(handler));
    const revealed=await submit(handler,c,{action:'reveal',id:issued.id,
      passphrase:env.ADMIN_PASSPHRASE});
    expect(revealed.statusCode).toBe(200);
    expect(revealed.body).toContain('test-owner-private-token');
    expect(revealed.body.indexOf('One-time secret — copy it now')).toBeLessThan(
      revealed.body.indexOf('id="readiness-tests"'));
    expect(revealed.body).toContain('id="owner-follow-up"');
    expect(revealed.headers['Cache-Control']).toBe('no-store');
  });
});
