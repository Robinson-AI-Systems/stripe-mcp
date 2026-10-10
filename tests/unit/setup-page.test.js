import { describe, expect, it } from 'vitest';
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
  fake.when('accounts.retrieve').resolves({id:'acct_FAKESETUP',business_profile:{name:'My Project'}});
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
