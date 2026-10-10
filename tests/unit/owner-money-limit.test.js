import {describe,it,expect} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createSetupHandler} from '../../src/stripe/setup-page.js';
const env={PUBLIC_BASE_URL:'https://stripe.example.test',
  ADMIN_PASSPHRASE:'fixture-limit-owner-password'};
const account='acct_LIMITOWNER';
function response(){return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},
  send(v){this.body=v;return this;},json(v){this.body=JSON.stringify(v);return this;}};}
function req(method,body={},headers={}){return {method,body,headers,
  query:method==='GET'?body:{},socket:{remoteAddress:'192.0.2.55'}};}
async function fixture(){
  const db=createFakeDb({accounts:[
    {id:account,label:'Budget owner fixture',money_limit_cents:50000},
    {id:'acct_LIMITOTHER',label:'Other business',money_limit_cents:75000}
  ]});
  for(const id of [account,'acct_LIMITOTHER'])
    await db.saveTestKey({account:id,label:id,ciphertext:'fake-encrypted-'+id,
      kind:'restricted',last4:'FAKE',permissions:{}});
  const handler=createSetupHandler({db,keyStore:null,oneTimeStore:null,env});
  const r=response();await handler(req('GET'),r);
  const cookie=r.headers['Set-Cookie'].split(';')[0],csrf=cookie.split('=')[1];
  const post=async(body,origin=env.PUBLIC_BASE_URL,csrfValue=csrf)=>{
    const out=response();
    await handler(req('POST',{csrf:csrfValue,...body},{origin,cookie}),out);
    return out;
  };
  return {db,post,initial:r};
}
const stage=(amount='350.00',which=account)=>({action:'request-money-limit',
  account:which,newLimitUsd:amount,passphrase:env.ADMIN_PASSPHRASE});
const idOf=s=>/<input type="hidden" name="id" value="([A-Za-z0-9_-]{32})">/.exec(s)?.[1];
const confirm=id=>({action:'confirm-money-limit',id,ownerLimitConsent:'yes',
  passphrase:env.ADMIN_PASSPHRASE});
describe('B-8b2b3 owner-only account money-out cap settings',()=>{
  it('shows default $500 policy text without displaying private account data on GET',async()=>{
    const f=await fixture();
    expect(f.initial.body).toContain('standard remains $500');
    expect(f.initial.body).toContain('separate approval requirement');
    expect(f.initial.body).not.toContain(account);
    expect((await f.db.getStripeAccount(account)).money_limit_cents).toBe(50000);
  });
  it('validates exact USD cents and refuses invalid or unconfigured accounts',async()=>{
    const f=await fixture();
    for(const amount of ['-1','1.001','NaN','1e3','21474836.48','100000000.00']) {
      expect((await f.post(stage(amount))).statusCode).toBe(400);
    }
    expect((await f.post(stage('500.00'))).statusCode).toBe(404);
    expect((await f.post(stage('1.00','acct_UNKNOWN'))).statusCode).toBe(404);
    expect((await f.db.getStripeAccount(account)).money_limit_cents).toBe(50000);
  });
  it('previews old/new amounts without changing the account',async()=>{
    const f=await fixture(),result=await f.post(stage());
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('$500.00');
    expect(result.body).toContain('$350.00');
    expect(result.body).toContain('Already used today:');
    expect(result.body).toContain('$0.00');
    expect(result.body).toContain('each AI money-out');
    expect(idOf(result.body)).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect((await f.db.getStripeAccount(account)).money_limit_cents).toBe(50000);
  });
  it('rejects spoofed origin/CSRF, invalid password, missing final consent',async()=>{
    const f=await fixture();
    expect((await f.post(stage(),'https://evil.example.test')).statusCode).toBe(403);
    expect((await f.post(stage(),env.PUBLIC_BASE_URL,'wrong')).statusCode).toBe(403);
    expect((await f.post({...stage(),passphrase:'invalid'})).statusCode).toBe(401);
    const id=idOf((await f.post(stage())).body);
    expect((await f.post({...confirm(id),ownerLimitConsent:'no'})).statusCode).toBe(400);
    expect((await f.post({...confirm(id),passphrase:'invalid'})).statusCode).toBe(401);
    expect((await f.db.getStripeAccount(account)).money_limit_cents).toBe(50000);
  });
  it('uses one independent owner confirmation and audits only selected account',async()=>{
    const f=await fixture(),id=idOf((await f.post(stage())).body);
    const results=await Promise.all([f.post(confirm(id)),f.post(confirm(id))]);
    expect(results.filter(x=>x.statusCode===200)).toHaveLength(1);
    expect(results.filter(x=>[409,410].includes(x.statusCode))).toHaveLength(1);
    expect((await f.db.getStripeAccount(account)).money_limit_cents).toBe(35000);
    expect((await f.db.getStripeAccount('acct_LIMITOTHER')).money_limit_cents).toBe(75000);
    expect((await f.db.listAuditForTest()).filter(x=>x.tool==='stripe_set_money_limit'))
      .toHaveLength(1);
  });
  it('fails closed on stale or expired intents and does not relax the $500 schema default',async()=>{
    const f=await fixture();
    const idA=idOf((await f.post(stage('250.00'))).body);
    const idB=idOf((await f.post(stage('100.00'))).body);
    expect((await f.post(confirm(idB))).statusCode).toBe(200);
    expect((await f.post(confirm(idA))).statusCode).toBe(409);
    const expired='E'.repeat(32);
    await f.db.requestMoneyLimitIntent({id:expired,account,newLimitCents:25000,
      expiresAt:new Date(Date.now()-1000)});
    expect((await f.post(confirm(expired))).statusCode).toBe(410);
    expect((await f.db.getStripeAccount(account)).money_limit_cents).toBe(10000);
  });
});
