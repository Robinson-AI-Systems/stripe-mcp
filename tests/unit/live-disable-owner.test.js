import {describe,it,expect} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createSetupHandler} from '../../src/stripe/setup-page.js';

const env={PUBLIC_BASE_URL:'https://stripe.example.test',
  ADMIN_PASSPHRASE:'fixture-private-owner-password'};
const account='acct_DISABLELIVE';
function response(){return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},
  send(v){this.body=v;return this;},json(v){this.body=JSON.stringify(v);return this;}};}
function request(method,body={},headers={}){return {method,body,headers,
  query:method==='GET'?body:{},socket:{remoteAddress:'192.0.2.35'}};}
async function fixture(){
  const db=createFakeDb({accounts:[{id:account,label:'Owner TEST fixture',
    live_enabled:true},{id:'acct_OTHERLIVE',label:'Different account',live_enabled:true}]});
  const handler=createSetupHandler({db,keyStore:null,oneTimeStore:null,env});
  const r=response();await handler(request('GET'),r);
  const cookie=r.headers['Set-Cookie'].split(';')[0],csrf=cookie.split('=')[1];
  const post=async(body,origin=env.PUBLIC_BASE_URL,overrideCsrf=csrf)=>{
    const out=response();await handler(request('POST',{csrf:overrideCsrf,...body},
      {origin,cookie}),out);return out;};
  return {db,handler,post,csrf,first:r};
}
const preview={action:'request-disable-live',account,
  passphrase:env.ADMIN_PASSPHRASE};
const idOf=body=>/<input type="hidden" name="id" value="([A-Za-z0-9_-]{32})">/
 .exec(body)?.[1];
describe('B-8b2b1 emergency LIVE disable only, private owner page',()=>{
  it('shows safe owner UI without disclosing account ids or enabling LIVE',async()=>{
    const f=await fixture();
    expect(f.first.statusCode).toBe(200);
    expect(f.first.body).toContain('Preview emergency LIVE disable');
    expect(f.first.body).not.toContain(account);
    expect((await f.db.getStripeAccount(account)).live_enabled).toBe(true);
  });
  it('previews exact account, never disabling it until separate confirmation',async()=>{
    const f=await fixture();
    expect((await f.post({...preview,account:'acct_NOTHERE'})).statusCode).toBe(404);
    const pending=await f.post(preview);
    expect(pending.statusCode).toBe(200);
    expect(pending.body).toContain(account);
    expect(idOf(pending.body)).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect((await f.db.getStripeAccount(account)).live_enabled).toBe(true);
    expect((await f.db.listAuditForTest()).filter(x=>x.tool==='stripe_disable_live')).toHaveLength(0);
  });
  it('rejects forged origin, CSRF, passwords, and unapproved final consent',async()=>{
    const f=await fixture();
    expect((await f.post(preview,'https://evil.example.test')).statusCode).toBe(403);
    expect((await f.post(preview,env.PUBLIC_BASE_URL,'bad')).statusCode).toBe(403);
    expect((await f.post({...preview,passphrase:'wrong'})).statusCode).toBe(401);
    const id=idOf((await f.post(preview)).body);
    const final={action:'confirm-disable-live',id,ownerDisableConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE};
    expect((await f.post({...final,passphrase:'bad'})).statusCode).toBe(401);
    expect((await f.post({...final,ownerDisableConsent:'no'})).statusCode).toBe(400);
    expect((await f.db.getStripeAccount(account)).live_enabled).toBe(true);
  });
  it('atomically disables only selected account and logs exactly once',async()=>{
    const f=await fixture();
    const id=idOf((await f.post(preview)).body);
    const final={action:'confirm-disable-live',id,ownerDisableConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE};
    const responses=await Promise.all([f.post(final),f.post(final)]);
    expect(responses.filter(x=>x.statusCode===200)).toHaveLength(1);
    expect(responses.filter(x=>[409,410].includes(x.statusCode))).toHaveLength(1);
    expect((await f.db.getStripeAccount(account)).live_enabled).toBe(false);
    expect((await f.db.getStripeAccount('acct_OTHERLIVE')).live_enabled).toBe(true);
    expect((await f.db.listAuditForTest()).filter(x=>x.tool==='stripe_disable_live')).toHaveLength(1);
    expect((await f.post(preview)).statusCode).toBe(404);
  });
  it('expired and absent intents cannot change LIVE state',async()=>{
    const f=await fixture(),id='E'.repeat(32);
    expect(await f.db.requestDisableLiveIntent({id,account,
      expiresAt:new Date(Date.now()-1000)})).toBe(true);
    expect((await f.post({action:'confirm-disable-live',id,ownerDisableConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE})).statusCode).toBe(410);
    expect((await f.db.getStripeAccount(account)).live_enabled).toBe(true);
  });
});
