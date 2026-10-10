import {describe,it,expect} from 'vitest';
import {createSetupHandler} from '../../src/stripe/setup-page.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';

const env={PUBLIC_BASE_URL:'https://stripe.example.test',ADMIN_PASSPHRASE:'owner-fixture-password'};
const account='acct_APPROVALA';
function response(){return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(v){this.statusCode=v;return this;},
  send(v){this.body=v;return this;},
  json(v){this.body=JSON.stringify(v);return this;}};}
function request(method,body,headers={}){
  return {method,body,query:method==='GET'?body:{},headers,
    socket:{remoteAddress:'192.0.2.84'}};
}
async function fixture(){
  let timeOffset=0;
  const db=createFakeDb({clock:()=>Date.now()+timeOffset,accounts:[{id:account},{id:'acct_OTHER'}]});
  for(const a of [account,'acct_OTHER'])
    await db.saveTestKey({account:a,label:a,ciphertext:'fake-cipher-'+a,
      kind:'restricted',last4:'FAKE'});
  const handler=createSetupHandler({db,keyStore:null,oneTimeStore:null,env});
  const get=response();await handler(request('GET',{}),get);
  const cookie=get.headers['Set-Cookie'].split(';')[0];
  const csrf=cookie.split('=')[1];
  async function post(body,options={}){
    const out=response();
    await handler(request('POST',{csrf,...body},{
      origin:options.origin??env.PUBLIC_BASE_URL,cookie:options.cookie??cookie
    }),out);
    return out;
  }
  const pending=(key,amountCents=1,target='ch_FAKE123')=>
    db.requestMoneyApproval({account,idempotencyKey:key,
      tool:'stripe_test_refund',description:'Test provider refund',target,
      amountCents,currency:'usd',mode:'test'});
  const owner=(action,fields={})=>({action,passphrase:env.ADMIN_PASSPHRASE,...fields});
  return {db,get,post,pending,owner,advance:ms=>{timeOffset+=ms;}};
}
function intentFrom(html){return /name="id" value="([A-Za-z0-9_-]{32})"/.exec(html)?.[1];}

describe('B-8c2 owner-only exact money authorization (TEST)',()=>{
  it('requires origin, CSRF, correct password, explicit separate consent and a single-use preview',async()=>{
    const f=await fixture();
    await f.pending('penny');
    const fields=f.owner('request-money-decision',{account,requestKey:'penny',kind:'approve'});
    expect((await f.post(fields,{origin:'https://attacker.invalid'})).statusCode).toBe(403);
    expect((await f.post(fields,{cookie:'stripe_setup_csrf=invalid'})).statusCode).toBe(403);
    expect((await f.post({...fields,passphrase:'wrong'})).statusCode).toBe(401);
    const preview=await f.post(fields);
    expect(preview.statusCode).toBe(200);
    expect(preview.headers['Cache-Control']).toBe('no-store');
    expect(preview.body).toContain('ch_FAKE123');
    expect(preview.body).toContain('$0.01');
    expect(preview.body).toContain('TEST');
    const id=intentFrom(preview.body);
    expect(id).toBeTruthy();
    expect((await f.post(f.owner('confirm-money-decision',{id}))).statusCode).toBe(400);
    expect((await f.post({...f.owner('confirm-money-decision',{id,ownerMoneyConsent:'yes'}),
      passphrase:'wrong'})).statusCode).toBe(401);
    expect((await f.post(f.owner('confirm-money-decision',{id,ownerMoneyConsent:'yes'}))).statusCode).toBe(200);
    expect((await f.post(f.owner('confirm-money-decision',{id,ownerMoneyConsent:'yes'}))).statusCode).toBe(410);
    expect((await f.db.listMoneyApprovalsForTest())[0].approvedAt).not.toBeNull();
    expect((await f.db.listAuditForTest()).filter(r=>r.tool==='owner_approve_money_out')).toHaveLength(1);
  });
  it('separately authenticates an override only after individual approval and a real cap crossing',async()=>{
    const f=await fixture();
    await f.pending('large',50001);
    expect((await f.post(f.owner('request-money-decision',{
      account,requestKey:'large',kind:'override'}))).statusCode).toBe(409);
    const initial=await f.post(f.owner('request-money-decision',{
      account,requestKey:'large',kind:'approve'}));
    const grant=intentFrom(initial.body);
    expect((await f.post(f.owner('confirm-money-decision',{
      id:grant,ownerMoneyConsent:'yes'}))).statusCode).toBe(200);
    expect((await f.db.reserveMoneyOut({account,connection:'client-one',
      idempotencyKey:'large',amountCents:50001,currency:'usd'})).decision)
      .toBe('limit_exceeded_override_required');
    const override=await f.post(f.owner('request-money-decision',{
      account,requestKey:'large',kind:'override'}));
    expect(override.statusCode).toBe(200);
    expect(override.body).toContain('OVER-LIMIT OVERRIDE');
    expect(override.body).toContain('$500.01');
    const id=intentFrom(override.body);
    expect((await f.post(f.owner('confirm-money-decision',{
      id,ownerMoneyConsent:'yes'}))).statusCode).toBe(200);
    expect((await f.db.reserveMoneyOut({account,connection:'client-one',
      idempotencyKey:'large',amountCents:50001,currency:'usd'})).decision).toBe('reserved');
    expect((await f.db.reserveMoneyOut({account,connection:'client-two',
      idempotencyKey:'large',amountCents:50001,currency:'usd'})).decision)
      .toMatch(/^already_/);
    expect((await f.db.listAuditForTest()).map(r=>r.tool)).toContain('owner_override_money_out');
  });
  it('rejects cross-account, target changes, stale grants, expired intents and unconnected accounts',async()=>{
    const f=await fixture();await f.pending('bound',123,'ch_BOUND123');
    expect((await f.post(f.owner('request-money-decision',{
      account:'acct_OTHER',requestKey:'bound',kind:'approve'}))).statusCode).toBe(409);
    const preview=await f.post(f.owner('request-money-decision',{
      account,requestKey:'bound',kind:'approve'}));
    const id=intentFrom(preview.body);
    expect(id).toBeTruthy();
    f.advance(11*60*1000);
    expect((await f.post(f.owner('confirm-money-decision',{
      id,ownerMoneyConsent:'yes'}))).statusCode).toBe(410);
    expect((await f.db.listMoneyApprovalsForTest())[0].approvedAt).toBeNull();
    expect((await f.post(f.owner('request-money-decision',{
      account,requestKey:'missing',kind:'approve'}))).statusCode).toBe(409);
    expect(await f.db.requestMoneyApproval({account,idempotencyKey:'bound',
      tool:'stripe_test_refund',description:'Test provider refund',
      target:'ch_CHANGED123',amountCents:123,currency:'usd',mode:'test'})).toBe(false);
    const read=await f.post(f.owner('view-money-requests',{account}));
    expect(read.body).toContain('Awaiting owner approval');
    expect(read.body).not.toContain('name="action" value="approve-money"');
  });
});
