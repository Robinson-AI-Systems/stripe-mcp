// CAP4-RECENSUS-1-ACCOUNT-DEENROLL — enrolled-account de-enrollment.
//
// The delete leg this server's enrollment records never had, built with
// the server's own ceremony discipline: a prepare-only registry tool
// (stripe_deenroll_account, full profile only, like its siblings
// stripe_create_pass / stripe_revoke_connection) evaluates the exact
// account and creates/removes nothing; completion happens only on the
// passphrase-authenticated owner page through a request-deenroll →
// confirm-deenroll intent pair whose confirmation fingerprint is
// computed fresh from the evaluated state (account id + label,
// credential kinds and last4s present, LIVE enabled/connected state,
// default-account state, counts of live tokens and passes) and
// re-checked atomically at consumption. The removal is one operation:
// every token and pass revoked, stored key material and the
// stripe_accounts row deleted, journaled with the fingerprint and no
// inverse (irreversible — stripe_undo_change refuses by its rule).
//
// Baseline accounting (pristine main 9daf3f38): every test in this file
// FAILS at baseline as surface-missing — the preparation tool, the
// db de-enrollment methods and both setup-page actions do not exist
// there. There are no by-design baseline passes in this suite.
import {describe,it,expect,beforeEach,afterEach,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createSetupHandler} from '../../src/stripe/setup-page.js';
import {handlers as serverHandlers} from '../../src/tools/server.js';

const env={PUBLIC_BASE_URL:'https://stripe.example.test',
  ADMIN_PASSPHRASE:'owner-fixture-passphrase'};
const account='acct_DEENROLLFIX';
const passToken='rtc_pass_'+'A'.repeat(43);
function response(){return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},
  send(v){this.body=v;return this;},json(v){this.body=JSON.stringify(v);return this;}};}
function req(method,body={},headers={}){return {method,body,headers,
  query:method==='GET'?body:{},socket:{remoteAddress:'192.0.2.14'}};}
async function createFixture({clock=()=>Date.now(),accountRow={}}={}){
  const db=createFakeDb({accounts:[{id:account,label:'De-enroll fixture',
    ...accountRow}],clock});
  await db.saveTestKey({account,label:'De-enroll fixture',
    ciphertext:'v1.fake-test-ciphertext',kind:'restricted',last4:'TEST',
    permissions:{customers:'ok'}});
  await db.createAccessToken({accessToken:'deenroll_access_1',
    refreshToken:'deenroll_refresh_1',clientId:'client_deenroll',
    stripeAccount:account,mode:'test',profile:'full'});
  await db.createAccessToken({accessToken:'deenroll_access_other',
    clientId:'client_deenroll',stripeAccount:'acct_OTHERFIX',mode:'test',
    profile:'read_only'});
  const passOk=await db.createRtcPass({id:'rtc-agent-deenroll1',account,
    token:passToken,mode:'test',profile:'read_only',areas:['server'],
    expiresAt:new Date(clock()+24*3600*1000)});
  if(!passOk)throw Error('fixture pass was not created');
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
const getId=html=>/<input type="hidden" name="id" value="([A-Za-z0-9_-]{32})">/
  .exec(html)?.[1];
const getFingerprint=html=>/DEEN-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}/.exec(html)?.[0];
const request={action:'request-deenroll',account,passphrase:env.ADMIN_PASSPHRASE};
const deenrollAudits=async db=>(await db.listAuditForTest())
  .filter(x=>x.tool==='stripe_deenroll_account');

beforeEach(()=>{vi.stubEnv('PUBLIC_BASE_URL',env.PUBLIC_BASE_URL);});
afterEach(()=>{vi.unstubAllEnvs();});

describe('CAP4-RECENSUS-1 preparation tool (registry)',()=>{
  it('evaluates the exact account and creates and removes nothing',async()=>{
    const {db}=await createFixture();
    const connection={stripeAccount:account,mode:'test',profile:'full'};
    const reply=await serverHandlers.stripe_deenroll_account({},{db,connection});
    expect(reply.isError).toBeUndefined();
    const value=JSON.parse(reply.content[0].text);
    expect(value).toMatchObject({status:'owner_confirmation_required',
      account,deenrolled:false,irreversible:true,readyToRequest:true,
      guardBlockers:[],liveEnabled:false,isDefault:false,
      unsettledReservations:0});
    expect(value.credentials.test).toEqual({configured:true,
      kind:'restricted',last4:'TEST'});
    expect(value.credentials.live.configured).toBe(false);
    expect(value.tokensToRevoke).toEqual({connector:1,passes:1,total:2});
    expect(value.selectionConsequence).toContain('loses its selection target');
    expect(new URL(value.ownerSetupUrl).searchParams.get('deenrollAccount'))
      .toBe(account);
    // Preparation changed nothing.
    expect(await db.getStripeAccount(account)).not.toBeNull();
    expect(await db.getAccessToken('deenroll_access_1')).not.toBeNull();
    expect(await db.getRtcPass(passToken)).not.toBeNull();
    expect(await db.listAuditForTest()).toHaveLength(0);
  });
  it('refuses non-full profiles and unselected accounts',async()=>{
    const {db}=await createFixture();
    for(const profile of ['read_only','everyday']){
      expect(await serverHandlers.stripe_deenroll_account({},
        {db,connection:{stripeAccount:account,mode:'test',profile}}))
        .toMatchObject({isError:true});
    }
    expect(await serverHandlers.stripe_deenroll_account({},
      {db,connection:{stripeAccount:'not-an-account',mode:'test',profile:'full'}}))
      .toMatchObject({isError:true});
    expect(await serverHandlers.stripe_deenroll_account({},
      {db,connection:{stripeAccount:'acct_MISSINGFIX',mode:'test',profile:'full'}}))
      .toMatchObject({isError:true});
  });
  it('surfaces each guard as a blocker instead of a ready payload',async()=>{
    const live=await createFixture({accountRow:{live_enabled:true}});
    const liveReply=await serverHandlers.stripe_deenroll_account({},
      {db:live.db,connection:{stripeAccount:account,mode:'live',profile:'full'}});
    const liveValue=JSON.parse(liveReply.content[0].text);
    expect(liveValue.readyToRequest).toBe(false);
    expect(liveValue.guardBlockers.join(' ')).toContain('disable LIVE first');
    const dflt=await createFixture({accountRow:{is_default:true}});
    const dfltReply=await serverHandlers.stripe_deenroll_account({},
      {db:dflt.db,connection:{stripeAccount:account,mode:'test',profile:'full'}});
    expect(JSON.parse(dfltReply.content[0].text).guardBlockers.join(' '))
      .toContain('recorded default account');
    const reserved=await createFixture();
    await reserved.db.seedUnsettledReservationForTest({account});
    const reservedReply=await serverHandlers.stripe_deenroll_account({},
      {db:reserved.db,connection:{stripeAccount:account,mode:'test',profile:'full'}});
    const reservedValue=JSON.parse(reservedReply.content[0].text);
    expect(reservedValue.unsettledReservations).toBe(1);
    expect(reservedValue.guardBlockers.join(' ')).toContain('unsettled money reservation');
  });
});

describe('CAP4-RECENSUS-1 owner page ceremony',()=>{
  it('offers the request form with the irreversibility stated, and no account data on GET',async()=>{
    const f=await createFixture();
    expect(f.initial.body).toContain('Preview de-enrollment');
    expect(f.initial.body).toContain('IRREVERSIBLE');
    expect(f.initial.body).not.toContain(account);
  });
  it('request step stages only an intent: account, keys, tokens and journal untouched',async()=>{
    const f=await createFixture();
    const preview=await f.submit(request);
    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain('IRREVERSIBLE');
    expect(preview.body).toContain('De-enroll fixture');
    expect(preview.body).toContain('ending');
    expect(getId(preview.body)).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(getFingerprint(preview.body))
      .toMatch(/^DEEN-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/);
    expect(await f.db.getStripeAccount(account)).not.toBeNull();
    expect((await f.db.getEncryptedKey({account,mode:'test'})).ciphertext)
      .toBe('v1.fake-test-ciphertext');
    expect(await f.db.getAccessToken('deenroll_access_1')).not.toBeNull();
    expect(await f.db.getRtcPass(passToken)).not.toBeNull();
    expect(await deenrollAudits(f.db)).toHaveLength(0);
  });
  it('rejects forged origin, bad CSRF, wrong passphrase and missing consent without removing anything',async()=>{
    const f=await createFixture();
    expect((await f.submit(request,'https://evil.test')).statusCode).toBe(403);
    expect((await f.submit(request,env.PUBLIC_BASE_URL,'wrong')).statusCode).toBe(403);
    expect((await f.submit({...request,passphrase:'wrong'})).statusCode).toBe(401);
    const preview=await f.submit(request),id=getId(preview.body),
      fingerprint=getFingerprint(preview.body);
    const confirm={action:'confirm-deenroll',id,deenrollFingerprint:fingerprint,
      ownerDeenrollConsent:'yes',passphrase:env.ADMIN_PASSPHRASE};
    expect((await f.submit({...confirm,ownerDeenrollConsent:'no'})).statusCode).toBe(400);
    expect((await f.submit({...confirm,passphrase:'wrong'})).statusCode).toBe(401);
    expect(await f.db.getStripeAccount(account)).not.toBeNull();
    expect(await f.db.getAccessToken('deenroll_access_1')).not.toBeNull();
  });
  it('a wrong fingerprint refuses, removes nothing and leaves the intent open',async()=>{
    const f=await createFixture();
    const preview=await f.submit(request),id=getId(preview.body),
      fingerprint=getFingerprint(preview.body);
    const wrong=await f.submit({action:'confirm-deenroll',id,
      deenrollFingerprint:'DEEN-00000-00000-00000-00000',
      ownerDeenrollConsent:'yes',passphrase:env.ADMIN_PASSPHRASE});
    expect(wrong.statusCode).toBe(409);
    expect(wrong.body).toContain(fingerprint);
    expect(await f.db.getStripeAccount(account)).not.toBeNull();
    expect(await f.db.getAccessToken('deenroll_access_1')).not.toBeNull();
    expect(await deenrollAudits(f.db)).toHaveLength(0);
    const confirmed=await f.submit({action:'confirm-deenroll',id,
      deenrollFingerprint:fingerprint,ownerDeenrollConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE});
    expect(confirmed.statusCode).toBe(200);
    expect(await f.db.getStripeAccount(account)).toBeNull();
  });
  it('a confirmed de-enrollment removes the row and key material, revokes every token and pass, and journals irreversibly',async()=>{
    const f=await createFixture();
    const preview=await f.submit(request),id=getId(preview.body),
      fingerprint=getFingerprint(preview.body);
    const confirm={action:'confirm-deenroll',id,deenrollFingerprint:fingerprint,
      ownerDeenrollConsent:'yes',passphrase:env.ADMIN_PASSPHRASE};
    const result=await f.submit(confirm);
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('de-enrolled permanently');
    expect(result.body).toContain('cannot be undone');
    expect(await f.db.getStripeAccount(account)).toBeNull();
    expect(await f.db.getDeenrollEvaluation(account)).toBeNull();
    expect(await f.db.getEncryptedKey({account,mode:'test'})).toBeNull();
    expect(await f.db.getAccessToken('deenroll_access_1')).toBeNull();
    expect(await f.db.getTokenByRefreshToken('deenroll_refresh_1')).toBeNull();
    expect(await f.db.getRtcPass(passToken)).toBeNull();
    // Another account's connection is untouched.
    expect(await f.db.getAccessToken('deenroll_access_other')).not.toBeNull();
    const audits=await deenrollAudits(f.db);
    expect(audits).toHaveLength(1);
    expect(audits[0].target).toBe(account);
    expect(audits[0].dry_run).toBe(false);
    expect(audits[0].summary).toContain('IRREVERSIBLE');
    expect(audits[0].summary).toContain(fingerprint);
    // No inverse is recorded: stripe_undo_change refuses this journal row
    // by its existing irreversible-action rule (inverse IS NOT NULL gate).
    expect(audits[0].inverse).toBeNull();
    expect((await f.submit(confirm)).statusCode).toBe(410);
  });
  it('a state change after the request voids the old fingerprint; the fresh fingerprint confirms',async()=>{
    const f=await createFixture();
    const preview=await f.submit(request),id=getId(preview.body),
      fingerprint=getFingerprint(preview.body);
    await f.db.createAccessToken({accessToken:'deenroll_access_2',
      clientId:'client_deenroll',stripeAccount:account,mode:'test',
      profile:'read_only'});
    const stale=await f.submit({action:'confirm-deenroll',id,
      deenrollFingerprint:fingerprint,ownerDeenrollConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE});
    expect(stale.statusCode).toBe(409);
    const fresh=getFingerprint(stale.body);
    expect(fresh).not.toBe(fingerprint);
    expect(await f.db.getStripeAccount(account)).not.toBeNull();
    expect(await f.db.getAccessToken('deenroll_access_1')).not.toBeNull();
    const confirmed=await f.submit({action:'confirm-deenroll',id,
      deenrollFingerprint:fresh,ownerDeenrollConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE});
    expect(confirmed.statusCode).toBe(200);
    expect(await f.db.getStripeAccount(account)).toBeNull();
    expect(await f.db.getAccessToken('deenroll_access_2')).toBeNull();
  });
  it('each guard refuses at the request step in its stated state',async()=>{
    const live=await createFixture({accountRow:{live_enabled:true}});
    const liveReply=await live.submit(request);
    expect(liveReply.statusCode).toBe(409);
    expect(liveReply.body).toContain('Disable LIVE first');
    const dflt=await createFixture({accountRow:{is_default:true}});
    const dfltReply=await dflt.submit(request);
    expect(dfltReply.statusCode).toBe(409);
    expect(dfltReply.body).toContain('recorded default account');
    const reserved=await createFixture();
    await reserved.db.seedUnsettledReservationForTest({account});
    const reservedReply=await reserved.submit(request);
    expect(reservedReply.statusCode).toBe(409);
    expect(reservedReply.body).toContain('unsettled money reservation');
    for(const f of [live,dflt,reserved]){
      expect(await f.db.getStripeAccount(account)).not.toBeNull();
      expect(await deenrollAudits(f.db)).toHaveLength(0);
    }
    expect(await live.db.requestDeenrollIntent({id:'G'.repeat(32),account,
      expiresAt:new Date(Date.now()+600000)})).toBe(false);
  });
  it('an expired intent refuses and removes nothing',async()=>{
    let now=Date.now();
    const f=await createFixture({clock:()=>now});
    const preview=await f.submit(request),id=getId(preview.body),
      fingerprint=getFingerprint(preview.body);
    now+=11*60*1000;
    const expired=await f.submit({action:'confirm-deenroll',id,
      deenrollFingerprint:fingerprint,ownerDeenrollConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE});
    expect(expired.statusCode).toBe(410);
    expect(await f.db.getStripeAccount(account)).not.toBeNull();
    expect(await f.db.getAccessToken('deenroll_access_1')).not.toBeNull();
  });
  it('db consume refuses a malformed fingerprint and a second consumption',async()=>{
    const f=await createFixture();
    const id='D'.repeat(32);
    expect(await f.db.requestDeenrollIntent({id,account,
      expiresAt:new Date(Date.now()+600000)})).toBe(true);
    const expected=await f.db.getDeenrollEvaluation(account);
    expect(await f.db.consumeDeenrollIntent({id,expected,
      expectedFingerprint:'not-a-fingerprint'})).toBe(false);
    expect(await f.db.getStripeAccount(account)).not.toBeNull();
    expect(await f.db.consumeDeenrollIntent({id,expected,
      expectedFingerprint:'DEEN-AAAAA-AAAAA-AAAAA-AAAAA'})).toBe(true);
    expect(await f.db.consumeDeenrollIntent({id,expected,
      expectedFingerprint:'DEEN-AAAAA-AAAAA-AAAAA-AAAAA'})).toBe(false);
    expect(await f.db.getStripeAccount(account)).toBeNull();
  });
});
