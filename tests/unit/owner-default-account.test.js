import {describe,it,expect} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createSetupHandler} from '../../src/stripe/setup-page.js';
const env={PUBLIC_BASE_URL:'https://stripe.example.test',
  ADMIN_PASSPHRASE:'fixture-default-owner-password'};
function response(){return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},
  send(v){this.body=v;return this;},json(v){this.body=JSON.stringify(v);return this;}};}
function req(method,body={},headers={}){return {method,body,headers,
  query:method==='GET'?body:{},socket:{remoteAddress:'192.0.2.45'}};}
async function fixture(){
  const db=createFakeDb({accounts:[
    {id:'acct_DEFAULTONE',label:'Owner primary',is_default:true},
    {id:'acct_DEFAULTTWO',label:'Owner second',is_default:false},
    {id:'acct_DEFAULTTHREE',label:'Owner third',is_default:false}
  ]});
  for(const account of ['acct_DEFAULTONE','acct_DEFAULTTWO','acct_DEFAULTTHREE'])
    await db.saveTestKey({account,label:account,ciphertext:'cipher-'+account,
      kind:'restricted',last4:'FAKE',permissions:{}});
  await db.createAccessToken({accessToken:'fixtureExistingConnection',
    refreshToken:'fixtureExistingRefresh',clientId:'existingClient',
    stripeAccount:'acct_DEFAULTONE',mode:'test',profile:'read_only'});
  const handler=createSetupHandler({db,keyStore:null,oneTimeStore:null,env});
  const r=response();await handler(req('GET'),r);
  const cookie=r.headers['Set-Cookie'].split(';')[0],csrf=cookie.split('=')[1];
  const post=async(body,origin=env.PUBLIC_BASE_URL,overrideCsrf=csrf)=>{
    const out=response();
    await handler(req('POST',{csrf:overrideCsrf,...body},{cookie,origin}),out);
    return out;
  };
  return {db,post,initial:r};
}
const start=(account='acct_DEFAULTTWO')=>({action:'request-default-account',
  account,passphrase:env.ADMIN_PASSPHRASE});
const idOf=s=>/<input type="hidden" name="id" value="([A-Za-z0-9_-]{32})">/.exec(s)?.[1];
const finish=id=>({action:'confirm-default-account',id,ownerDefaultConsent:'yes',
  passphrase:env.ADMIN_PASSPHRASE});
describe('B-8b2b2 owner-only default Stripe account',()=>{
  it('shows owner-only form without leaking account IDs on GET',async()=>{
    const f=await fixture();
    expect(f.initial.body).toContain('Preview new default account');
    expect(f.initial.body).not.toContain('acct_DEFAULTTWO');
  });
  it('previews exact target and original default without mutating either',async()=>{
    const f=await fixture();
    expect((await f.post(start('acct_NONEXIST'))).statusCode).toBe(404);
    expect((await f.post(start('acct_DEFAULTONE'))).statusCode).toBe(404);
    const pending=await f.post(start());
    expect(pending.statusCode).toBe(200);
    expect(pending.body).toContain('acct_DEFAULTONE');
    expect(pending.body).toContain('acct_DEFAULTTWO');
    expect(idOf(pending.body)).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect((await f.db.getStripeAccount('acct_DEFAULTONE')).is_default).toBe(true);
    expect((await f.db.getStripeAccount('acct_DEFAULTTWO')).is_default).toBe(false);
  });
  it('requires password, origin, CSRF and final owner consent independently',async()=>{
    const f=await fixture();
    expect((await f.post(start(),'https://attacker.test')).statusCode).toBe(403);
    expect((await f.post(start(),env.PUBLIC_BASE_URL,'wrong')).statusCode).toBe(403);
    expect((await f.post({...start(),passphrase:'invalid'})).statusCode).toBe(401);
    const id=idOf((await f.post(start())).body);
    expect((await f.post({...finish(id),ownerDefaultConsent:'no'})).statusCode).toBe(400);
    expect((await f.post({...finish(id),passphrase:'invalid'})).statusCode).toBe(401);
    expect((await f.db.getStripeAccount('acct_DEFAULTONE')).is_default).toBe(true);
  });
  it('sets one default, keeps old connection scoped, audits exactly once',async()=>{
    const f=await fixture(),id=idOf((await f.post(start())).body);
    const results=await Promise.all([f.post(finish(id)),f.post(finish(id))]);
    expect(results.filter(x=>x.statusCode===200)).toHaveLength(1);
    expect(results.filter(x=>[409,410].includes(x.statusCode))).toHaveLength(1);
    const rows=await f.db.listStripeAccounts();
    expect(rows.filter(x=>x.is_default).map(x=>x.id)).toEqual(['acct_DEFAULTTWO']);
    expect((await f.db.getAccessToken('fixtureExistingConnection')).stripe_account)
      .toBe('acct_DEFAULTONE');
    expect((await f.db.listAuditForTest()).filter(x=>x.tool==='stripe_set_default_account'))
      .toHaveLength(1);
  });
  it('rejects a stale request when a second owner setting wins first',async()=>{
    const f=await fixture();
    const idTwo=idOf((await f.post(start('acct_DEFAULTTWO'))).body);
    const idThree=idOf((await f.post(start('acct_DEFAULTTHREE'))).body);
    expect((await f.post(finish(idThree))).statusCode).toBe(200);
    expect((await f.post(finish(idTwo))).statusCode).toBe(409);
    expect((await f.db.listStripeAccounts()).filter(x=>x.is_default).map(x=>x.id))
      .toEqual(['acct_DEFAULTTHREE']);
    expect((await f.db.listAuditForTest()).filter(x=>x.tool==='stripe_set_default_account'))
      .toHaveLength(1);
  });
  it('rejects expired intents',async()=>{
    const f=await fixture(),id='E'.repeat(32);
    expect(await f.db.requestDefaultAccountIntent({id,account:'acct_DEFAULTTWO',
      expiresAt:new Date(Date.now()-1000)})).toBe(true);
    expect((await f.post(finish(id))).statusCode).toBe(410);
    expect((await f.db.getStripeAccount('acct_DEFAULTONE')).is_default).toBe(true);
  });
});
