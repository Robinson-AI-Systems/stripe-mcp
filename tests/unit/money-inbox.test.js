import {describe,it,expect} from 'vitest';
import {createSetupHandler} from '../../src/stripe/setup-page.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const env={PUBLIC_BASE_URL:'https://stripe.example.test',ADMIN_PASSPHRASE:'owner-fixture-password'};
function res(){return {statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this;},
 status(n){this.statusCode=n;return this;},send(v){this.body=v;return this;},
 json(v){this.body=JSON.stringify(v);return this;}};}
const req=(method,body={},headers={})=>({method,body,headers,
 query:method==='GET'?body:{},socket:{remoteAddress:'192.0.2.84'}});
async function setup(){
 const db=createFakeDb({accounts:[{id:'acct_INBOXA'},{id:'acct_INBOXB'}]});
 for(const account of ['acct_INBOXA','acct_INBOXB'])
  await db.saveTestKey({account,label:account,ciphertext:'fake-cipher-'+account,kind:'restricted',last4:'FAKE'});
 const handler=createSetupHandler({db,keyStore:null,oneTimeStore:null,env});
 const first=res();await handler(req('GET'),first);
 const cookie=first.headers['Set-Cookie'].split(';')[0],csrf=cookie.split('=')[1];
 const post=async(body,origin=env.PUBLIC_BASE_URL,csrfValue=csrf)=>{
  const out=res();await handler(req('POST',{csrf:csrfValue,...body},{origin,cookie}),out);return out;
 };
 return {db,first,post};
}
const record=(account,id,target='ch_FAKE1234',amountCents=12345)=>({
 account,idempotencyKey:id,tool:'stripe_test_refund',description:'Verified fake refund',
 currency:'usd',amountCents,target});
const view=account=>({action:'view-money-requests',account,passphrase:env.ADMIN_PASSPHRASE});
describe('B-8c1 private owner money request inbox',()=>{
 it('exposes no account or request on GET, refuses forged owner requests',async()=>{
  const f=await setup();await f.db.requestMoneyApproval(record('acct_INBOXA','secret-key'));
  expect(f.first.body).toContain('Privately view pending mode-specific requests');
  expect(f.first.body).not.toContain('secret-key');
  expect(f.first.body).not.toContain('acct_INBOXA');
  expect((await f.post(view('acct_INBOXA'),'https://evil.test')).statusCode).toBe(403);
  expect((await f.post(view('acct_INBOXA'),env.PUBLIC_BASE_URL,'wrong')).statusCode).toBe(403);
  expect((await f.post({...view('acct_INBOXA'),passphrase:'bad'})).statusCode).toBe(401);
  expect((await f.post(view('acct_UNKNOWN'))).statusCode).toBe(404);
 });
 it('shows only correct account, verified target, TEST, dollar amounts and dates; cannot approve',async()=>{
  const f=await setup();
  await f.db.requestMoneyApproval(record('acct_INBOXA','strong-A'));
  await f.db.requestMoneyApproval(record('acct_INBOXB','secret-B','ch_OTHER123'));
  await f.db.requestMoneyApproval(record('acct_INBOXA','legacy','',100));
  const out=await f.post(view('acct_INBOXA'));
  expect(out.statusCode).toBe(200);
  expect(out.headers['Cache-Control']).toBe('no-store');
  for(const value of ['acct_INBOXA','strong-A','ch_FAKE1234','$123.45','$500.00','MDT','MST']){
   if(value==='MDT'||value==='MST')continue;
   expect(out.body).toContain(value);
  }
  expect(out.body).toMatch(/MDT|MST/);
  for(const bad of ['secret-B','ch_OTHER123','name="action" value="approve-money"'])
   expect(out.body).not.toContain(bad);
  const inbox=out.body.split('<h2>Verified pending requests</h2>')[1]?.split('</section>')[0]??'';
  expect(inbox).not.toContain('legacy');
  expect(out.body).toContain('name="action" value="request-money-decision"');
  expect(out.body).toContain('Submitting the preview form does not grant approval');
  expect((await f.db.listMoneyApprovalsForTest()).every(x=>x.approvedAt===null)).toBe(true);
 });
 it('denies altered target replay and legacy rows for both grant types',async()=>{
  const f=await setup(),account='acct_INBOXA';
  expect(await f.db.requestMoneyApproval(record(account,'fixed-key'))).toBe(true);
  expect(await f.db.requestMoneyApproval(record(account,'fixed-key','ch_OTHER123'))).toBe(false);
  expect(await f.db.requestMoneyApproval(record(account,'legacy','',100))).toBe(true);
  expect(await f.db.approveMoneyRequest({account,idempotencyKey:'legacy'})).toBe(false);
  expect(await f.db.approveMoneyOverride({account,idempotencyKey:'legacy'})).toBe(false);
  expect(await f.db.approveMoneyRequest({account,idempotencyKey:'fixed-key'})).toBe(true);
  expect(await f.db.approveMoneyOverride({account,idempotencyKey:'fixed-key'})).toBe(true);
 });
 it('fails closed when shared usage cannot be verified',async()=>{
  const f=await setup();
  const db={...f.db,getMoneyUsage:async()=>null};
  const handler=createSetupHandler({db,keyStore:null,oneTimeStore:null,env});
  const first=res();await handler(req('GET'),first);
  const cookie=first.headers['Set-Cookie'].split(';')[0],csrf=cookie.split('=')[1];
  const out=res();await handler(req('POST',{...view('acct_INBOXA'),csrf},
   {cookie,origin:env.PUBLIC_BASE_URL}),out);
  expect(out.statusCode).toBe(503);
  expect(out.body).not.toContain('strong-A');
 });
});