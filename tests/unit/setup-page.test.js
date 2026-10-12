import { describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createSetupHandler } from '../../src/stripe/setup-page.js';
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
describe('owner-authenticated TEST smoke on existing custom MCP',()=>{
  it('checks strict origin, CSRF, passphrase, exact TEST account and redacts report',async()=>{
    const db=createFakeDb();
    const calls=[];
    const runTestSmoke=async({account})=>{
      calls.push(account);
      return {account,mode:'test',source:'custom_mcp_dispatch',
        verifiedIdentity:true,dashboardVerified:false,writeOperations:0,
        records:['account_get','account_list_capabilities','account_list_payment_method_settings',
          'account_list_apple_pay_domains','event_list','webhook_list',
          'admin_list_requirements','admin_check_setting'].map(tool=>({
            tool,status:tool==='webhook_list'?'partial':'observed'
          })),key:'rk_test_FAKE_SHOULD_NOT_BE_EXPOSED'};
    };
    const handler=createSetupHandler({db,runTestSmoke,env});
    const c=cookiePage(await page(handler));
    const request={action:'run-test-smoke',account:'acct_SAFEOWNER',passphrase:env.ADMIN_PASSPHRASE};
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
    expect(response.body).not.toContain('rk_test_FAKE_SHOULD_NOT_BE_EXPOSED');
    expect(response.body).toContain('not Dashboard acceptance');
  });
  it('refuses malformed or foreign provider results and never reports completion',async()=>{
    const db=createFakeDb();
    const handler=createSetupHandler({db,env,
      runTestSmoke:async()=>({account:'acct_FOREIGN',mode:'test',records:[]})});
    const c=cookiePage(await page(handler));
    const response=await submit(handler,c,{action:'run-test-smoke',
      account:'acct_SAFEOWNER',passphrase:env.ADMIN_PASSPHRASE});
    expect(response.statusCode).toBe(503);
    expect(response.body).toContain('No acceptance recorded');
    expect(response.body).not.toContain('acct_FOREIGN');
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
