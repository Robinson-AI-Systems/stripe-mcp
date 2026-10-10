import {describe,it,expect} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createSetupHandler} from '../../src/stripe/setup-page.js';

const env={PUBLIC_BASE_URL:'https://stripe.example.test',
  ADMIN_PASSPHRASE:'owner-fixture-passphrase'};
const account='acct_REVOKEFIX';
function response(){return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},
  send(v){this.body=v;return this;},json(v){this.body=JSON.stringify(v);return this;}};}
function req(method,body={},headers={}){return {method,body,headers,
  query:method==='GET'?body:{},socket:{remoteAddress:'192.0.2.14'}};}
async function createFixture({clock=()=>Date.now()}={}){
  const db=createFakeDb({accounts:[{id:account,label:'Owner fixture'}],clock});
  await db.createAccessToken({accessToken:'test_token_owner_one',refreshToken:'refresh_owner_one',
    clientId:'client_one',stripeAccount:account,mode:'test',profile:'read_only'});
  await db.createAccessToken({accessToken:'test_token_owner_two',refreshToken:'refresh_owner_two',
    clientId:'client_two',stripeAccount:account,mode:'test',profile:'full'});
  const handler=createSetupHandler({db,keyStore:null,oneTimeStore:null,env});
  const r=response();await handler(req('GET'),r);
  const cookie=r.headers['Set-Cookie'].split(';')[0],csrf=cookie.split('=')[1];
  const submit=async(body,origin=env.PUBLIC_BASE_URL,overrideCsrf=csrf)=>{
    const result=response();
    await handler(req('POST',{csrf:overrideCsrf,...body},{cookie,origin}),result);
    return result;
  };
  return {db,handler,csrf,cookie,submit,initial:r};
}
const prepare={action:'request-revoke',account,clientId:'client_one',
  passphrase:env.ADMIN_PASSPHRASE};
const getId=html=>/<input type="hidden" name="id" value="([A-Za-z0-9_-]{32})">/
  .exec(html)?.[1];
describe('B-8b2a owner-only connection removal',()=>{
  it('shows an owner-only preview form, without leaking connection IDs on GET',async()=>{
    const f=await createFixture();
    expect(f.initial.body).toContain('Preview connection removal');
    expect(f.initial.body).not.toContain('client_one');
    expect(await f.db.getAccessToken('test_token_owner_one')).not.toBeNull();
  });
  it('requires matching account and client before staging; no mutation from preview',async()=>{
    const f=await createFixture();
    expect((await f.submit({...prepare,account:'acct_MISMATCH'})).statusCode).toBe(404);
    const p=await f.submit(prepare);
    expect(p.statusCode).toBe(200);
    expect(p.body).toContain('client_one');
    expect(p.body).toContain('acct_REVOKEFIX');
    expect(getId(p.body)).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await f.db.getAccessToken('test_token_owner_one')).not.toBeNull();
    expect((await f.db.listAuditForTest()).filter(x=>x.tool==='stripe_revoke_connection'))
      .toHaveLength(0);
  });
  it('rejects CSRF, forged origin, wrong password and missing final consent',async()=>{
    const f=await createFixture();
    expect((await f.submit(prepare,'https://evil.test')).statusCode).toBe(403);
    expect((await f.submit(prepare,env.PUBLIC_BASE_URL,'wrong')).statusCode).toBe(403);
    expect((await f.submit({...prepare,passphrase:'wrong'})).statusCode).toBe(401);
    const pending=await f.submit(prepare),id=getId(pending.body);
    const confirm={action:'confirm-revoke',id,ownerRevokeConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE};
    expect((await f.submit({...confirm,passphrase:'wrong'})).statusCode).toBe(401);
    expect((await f.submit({...confirm,ownerRevokeConsent:'no'})).statusCode).toBe(400);
    expect(await f.db.getAccessToken('test_token_owner_one')).not.toBeNull();
  });
  it('revokes only the approved client once and writes one audit record',async()=>{
    const f=await createFixture();
    const pending=await f.submit(prepare),id=getId(pending.body);
    const confirm={action:'confirm-revoke',id,ownerRevokeConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE};
    const result=await f.submit(confirm);
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('Connection removed');
    expect(await f.db.getAccessToken('test_token_owner_one')).toBeNull();
    expect(await f.db.getTokenByRefreshToken('refresh_owner_one')).toBeNull();
    expect(await f.db.getAccessToken('test_token_owner_two')).not.toBeNull();
    expect((await f.db.listAuditForTest()).filter(x=>x.tool==='stripe_revoke_connection'))
      .toHaveLength(1);
    expect((await f.submit(confirm)).statusCode).toBe(410);
  });
  it('rejects expired and competing simultaneous confirmations without a second audit',async()=>{
    let now=Date.now();
    const f=await createFixture({clock:()=>now});
    const p=await f.submit(prepare),id=getId(p.body);
    const confirm={action:'confirm-revoke',id,ownerRevokeConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE};
    const results=await Promise.all([f.submit(confirm),f.submit(confirm)]);
    expect(results.map(x=>x.statusCode).sort()).toEqual([200,410]);
    expect((await f.db.listAuditForTest()).filter(x=>x.tool==='stripe_revoke_connection'))
      .toHaveLength(1);
    const f2=await createFixture({clock:()=>now});
    const p2=await f2.submit(prepare),id2=getId(p2.body);
    now+=600001;
    expect((await f2.submit({...confirm,id:id2})).statusCode).toBe(410);
    expect(await f2.db.getAccessToken('test_token_owner_one')).not.toBeNull();
  });
});
