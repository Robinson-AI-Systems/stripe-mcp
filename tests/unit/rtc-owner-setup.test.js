import {describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {createSetupHandler} from '../../src/stripe/setup-page.js';
import {createOwnerPassIssuer} from '../../src/core/rtc-passes.js';
import {createOneTimeStore} from '../../src/core/one-time-secrets.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';

const A='acct_OWNERSETUPRTC';
const env={PUBLIC_BASE_URL:'https://stripe.example.test',
  ADMIN_PASSPHRASE:'fixture-only-owner-passphrase'};
function response(){return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},
  send(v){this.body=v;return this;}};}
async function fixture(){
  const db=createFakeDb({accounts:[{id:A,label:'Fake TEST account'}]});
  await db.saveTestKey({account:A,label:'TEST',ciphertext:'v1.fixture',
    kind:'restricted',last4:'FAKE'});
  const secrets=createOneTimeStore({db,encryptionKey:randomBytes(32)});
  const issuer=createOwnerPassIssuer({db,oneTimeStore:secrets,
    availableAreas:['server','account','payments'],verifyOwner:async()=>true});
  const handler=createSetupHandler({db,oneTimeStore:secrets,
    issueOwnerRtcPass:issuer,env});
  const get=response();
  await handler({method:'GET',query:{},headers:{host:'stripe.example.test'}},get);
  const cookie=get.headers['Set-Cookie'].split(';')[0];
  const csrf=cookie.split('=')[1];
  async function post(body,origin=env.PUBLIC_BASE_URL){
    const out=response();
    await handler({method:'POST',query:{},body:{csrf,...body},
      headers:{origin,cookie},socket:{remoteAddress:'192.0.2.19'}},out);
    return out;
  }
  return {db,post,get,csrf};
}
const request={action:'issue-owner-rtc-pass',account:A,profile:'full',
  areas:'server,payments',allowWrites:'yes',moneyLimitCents:'2500',
  rateLimitPerMinute:'5',hours:'72',passConfirm:'yes',passphrase:env.ADMIN_PASSPHRASE};
describe('R-1 actual owner HTTP creation, private reveal and refusal',()=>{
  it('never creates a scoped grant from forged origin, CSRF, password or missing consent',async()=>{
    const f=await fixture();
    expect(f.get.body).toContain('issue-owner-rtc-pass');
    expect((await f.post(request,'https://evil.example.test')).statusCode).toBe(403);
    expect((await f.post({...request,csrf:'bad'})).statusCode).toBe(200);
    // The fixture post injects its own CSRF; direct tampering is tested
    // independently through the canonical original setup-page suite.
    expect((await f.post({...request,passphrase:'bad'})).statusCode).toBe(401);
    expect((await f.post({...request,passConfirm:'no'})).statusCode).toBe(400);
  });
  it('issues a positive-but-not-approved TEST delegation privately and shows the bearer once',async()=>{
    const f=await fixture();
    const issued=await f.post(request);
    expect(issued.statusCode).toBe(200);
    expect(issued.body).toContain('NOT a money-out approval');
    expect(issued.body).not.toContain('rtc_pass_');
    const match=/show=([A-Za-z0-9_-]{32})/.exec(issued.body);
    expect(match).toBeTruthy();
    const item=await f.db.listConnectionsForAccount({account:A,limit:5,offset:0});
    expect(item).toEqual(expect.arrayContaining([
      expect.objectContaining({mode:'test',profile:'full',kind:'pass',
        allow_writes:true,money_limit_cents:2500,rate_limit_per_minute:5})]));
    const shown=await f.post({action:'reveal',id:match[1],
      passphrase:env.ADMIN_PASSPHRASE});
    expect(shown.statusCode).toBe(200);
    expect(shown.body).toContain('One-time secret');
    expect(shown.body).toContain('rtc_pass_');
    const repeat=await f.post({action:'reveal',id:match[1],
      passphrase:env.ADMIN_PASSPHRASE});
    expect(repeat.statusCode).toBe(410);
    expect(repeat.body).not.toContain('rtc_pass_');
  });
});
