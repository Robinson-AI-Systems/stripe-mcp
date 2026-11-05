// CAP4-RECENSUS-2-OAUTH-CLIENT-DELETE — OAuth client management:
// the missing delete leg plus owner visibility.
//
// Registered clients were create/read(internal) only: no surface
// listed them and nothing could remove one. This card builds the
// delete leg in the server's established pattern (the
// CAP4-RECENSUS-1 sibling): the passphrase-authenticated owner page
// lists the registered clients with live token/pass counts, and a
// request-delete-client → confirm-delete-client intent pair
// (10-minute expiry) completes the deletion. The confirmation
// fingerprint is computed fresh from the evaluated state — client
// id, name, auth method, and the exact counts of tokens and passes
// the deletion will revoke — and re-checked atomically at
// consumption. The deletion is one operation: every token and pass
// issued to the client revoked (across every account), its
// outstanding authorization codes deleted, the oauth_clients row
// deleted, journaled with the fingerprint and no inverse
// (IRREVERSIBLE — stripe_undo_change refuses by its rule). The
// update leg is dispositioned, not built: deliberately deferred on
// the card (delete-and-re-register serves name/auth-method changes;
// an RFC 7592 endpoint is its own future card). No registry tool is
// added; the registry stands at 344.
//
// Baseline accounting (pristine main a894b262): 12 of these 13
// tests FAIL at baseline as surface-missing — the list action, both
// ceremony actions, the db client-management methods and the
// DELC fingerprint do not exist there. The one baseline pass is
// named: "the list refuses a wrong passphrase without showing any
// client" passes at baseline BY DESIGN, because the shared owner
// login gate refuses a wrong passphrase with 401 before any action
// dispatch — that gate predates this card and is unchanged by it.
import {describe,it,expect,beforeEach,afterEach,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createSetupHandler} from '../../src/stripe/setup-page.js';
import {createOAuthHandlers} from '../../src/core/oauth-handlers.js';

const env={PUBLIC_BASE_URL:'https://stripe.example.test',
  ADMIN_PASSPHRASE:'owner-fixture-passphrase'};
const account='acct_CLIENTFIX';
const client='client_delete_fixture';
const passClient='rtc-agent-delclient1';
const passToken='rtc_pass_'+'C'.repeat(43);
const callback='https://client.example.test/cb';
const verifier='d'.repeat(43);
const challenge=createHash('sha256').update(verifier).digest('base64url');
function response(){return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},
  send(v){this.body=v;return this;},json(v){this.body=JSON.stringify(v);return this;},
  end(){this.ended=true;return this;}};}
function req(method,body={},headers={}){return {method,body,headers,
  query:method==='GET'?body:{},socket:{remoteAddress:'192.0.2.14'}};}
async function createFixture({clock=()=>Date.now()}={}){
  const db=createFakeDb({accounts:[{id:account,label:'Client fixture'},
    {id:'acct_OTHERFIX',label:'Other fixture'}],clock});
  await db.saveTestKey({account,label:'Client fixture',
    ciphertext:'v1.fake-test-ciphertext',kind:'restricted',last4:'TEST',
    permissions:{customers:'ok'}});
  await db.createOAuthClient({clientId:client,clientSecret:'fixture-secret',
    tokenEndpointAuthMethod:'client_secret_post',redirectUris:[callback],
    clientName:'Delete fixture'});
  await db.createOAuthClient({clientId:'client_bystander',
    clientSecret:'bystander-secret',tokenEndpointAuthMethod:'client_secret_basic',
    redirectUris:[callback],clientName:'Bystander'});
  await db.createOAuthClient({clientId:passClient,clientSecret:null,
    tokenEndpointAuthMethod:'none',redirectUris:[callback],
    clientName:'Pass carrier'});
  // The delete target holds two live connector tokens on two accounts
  // plus one already-revoked token (not counted, not re-revoked).
  await db.createAccessToken({accessToken:'delclient_access_1',
    refreshToken:'delclient_refresh_1',clientId:client,
    stripeAccount:account,mode:'test',profile:'full'});
  await db.createAccessToken({accessToken:'delclient_access_2',
    clientId:client,stripeAccount:'acct_OTHERFIX',mode:'test',
    profile:'read_only'});
  await db.createAccessToken({accessToken:'delclient_access_revoked',
    clientId:client,stripeAccount:account,mode:'test',profile:'read_only'});
  await db.revokeAccessToken('delclient_access_revoked');
  await db.createAccessToken({accessToken:'delclient_access_other',
    clientId:'client_bystander',stripeAccount:account,mode:'test',
    profile:'read_only'});
  const passOk=await db.createRtcPass({id:passClient,account,
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
const getFingerprint=html=>/DELC-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}/.exec(html)?.[0];
const request={action:'request-delete-client',clientId:client,
  passphrase:env.ADMIN_PASSPHRASE};
const deleteAudits=async db=>(await db.listAuditForTest())
  .filter(x=>x.tool==='stripe_delete_oauth_client');

beforeEach(()=>{vi.stubEnv('PUBLIC_BASE_URL',env.PUBLIC_BASE_URL);});
afterEach(()=>{vi.unstubAllEnvs();});

describe('CAP4-RECENSUS-2 owner visibility',()=>{
  it('offers the list and request forms with irreversibility stated, and no client data on GET',async()=>{
    const f=await createFixture();
    expect(f.initial.body).toContain('List registered OAuth clients');
    expect(f.initial.body).toContain('Preview client deletion');
    expect(f.initial.body).toContain('IRREVERSIBLE');
    expect(f.initial.body).not.toContain(client);
    expect(f.initial.body).not.toContain('Delete fixture');
  });
  it('the list shows a seeded client with truthful live counts',async()=>{
    const f=await createFixture();
    const listed=await f.submit({action:'list-oauth-clients',
      passphrase:env.ADMIN_PASSPHRASE});
    expect(listed.statusCode).toBe(200);
    expect(listed.body).toContain('id="oauth-clients"');
    expect(listed.body).toContain('Delete fixture');
    expect(listed.body).toContain(client);
    expect(listed.body).toContain('client_secret_post');
    expect(listed.body).toContain('live connections: 2; passes: 0');
    expect(listed.body).toContain('Bystander');
    expect(listed.body).toContain('live connections: 1; passes: 0');
    expect(listed.body).toContain('Pass carrier');
    expect(listed.body).toContain('live connections: 0; passes: 1');
    // The db surface agrees, and carries no secret material.
    const rows=await f.db.listOAuthClients();
    expect(rows.find(r=>r.client_id===client)).toMatchObject({
      client_name:'Delete fixture',
      token_endpoint_auth_method:'client_secret_post',
      connector_count:2,pass_count:0});
    expect(JSON.stringify(rows)).not.toContain('client_secret_hash');
    expect(JSON.stringify(rows)).not.toContain('fixture-secret');
  });
  it('the list refuses a wrong passphrase without showing any client',async()=>{
    const f=await createFixture();
    const denied=await f.submit({action:'list-oauth-clients',passphrase:'wrong'});
    expect(denied.statusCode).toBe(401);
    expect(denied.body).not.toContain('Delete fixture');
  });
});

describe('CAP4-RECENSUS-2 owner page delete ceremony',()=>{
  it('request step stages only an intent: client, tokens, passes and journal untouched',async()=>{
    const f=await createFixture();
    const preview=await f.submit(request);
    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain('IRREVERSIBLE');
    expect(preview.body).toContain('Delete fixture');
    expect(preview.body).toContain('client_secret_post');
    expect(getId(preview.body)).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(getFingerprint(preview.body))
      .toMatch(/^DELC-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/);
    expect(await f.db.getOAuthClient(client)).not.toBeNull();
    expect(await f.db.getAccessToken('delclient_access_1')).not.toBeNull();
    expect(await f.db.getAccessToken('delclient_access_2')).not.toBeNull();
    expect(await f.db.getRtcPass(passToken)).not.toBeNull();
    expect(await deleteAudits(f.db)).toHaveLength(0);
  });
  it('requesting an unknown client refuses and stages nothing usable',async()=>{
    const f=await createFixture();
    const missing=await f.submit({action:'request-delete-client',
      clientId:'client_missing',passphrase:env.ADMIN_PASSPHRASE});
    expect(missing.statusCode).toBe(404);
    expect(await f.db.getDeleteClientEvaluation('client_missing')).toBeNull();
    expect(await f.db.requestDeleteClientIntent({id:'M'.repeat(32),
      clientId:'client_missing',expiresAt:new Date(Date.now()+600000)})).toBe(false);
  });
  it('rejects forged origin, bad CSRF, wrong passphrase and missing consent without removing anything',async()=>{
    const f=await createFixture();
    expect((await f.submit(request,'https://evil.test')).statusCode).toBe(403);
    expect((await f.submit(request,env.PUBLIC_BASE_URL,'wrong')).statusCode).toBe(403);
    expect((await f.submit({...request,passphrase:'wrong'})).statusCode).toBe(401);
    const preview=await f.submit(request),id=getId(preview.body),
      fingerprint=getFingerprint(preview.body);
    const confirm={action:'confirm-delete-client',id,
      deleteClientFingerprint:fingerprint,ownerDeleteClientConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE};
    expect((await f.submit({...confirm,ownerDeleteClientConsent:'no'})).statusCode).toBe(400);
    expect((await f.submit({...confirm,passphrase:'wrong'})).statusCode).toBe(401);
    expect(await f.db.getOAuthClient(client)).not.toBeNull();
    expect(await f.db.getAccessToken('delclient_access_1')).not.toBeNull();
  });
  it('a wrong fingerprint refuses, removes nothing and leaves the intent open',async()=>{
    const f=await createFixture();
    const preview=await f.submit(request),id=getId(preview.body),
      fingerprint=getFingerprint(preview.body);
    const wrong=await f.submit({action:'confirm-delete-client',id,
      deleteClientFingerprint:'DELC-00000-00000-00000-00000',
      ownerDeleteClientConsent:'yes',passphrase:env.ADMIN_PASSPHRASE});
    expect(wrong.statusCode).toBe(409);
    expect(wrong.body).toContain(fingerprint);
    expect(await f.db.getOAuthClient(client)).not.toBeNull();
    expect(await f.db.getAccessToken('delclient_access_1')).not.toBeNull();
    expect(await deleteAudits(f.db)).toHaveLength(0);
    const confirmed=await f.submit({action:'confirm-delete-client',id,
      deleteClientFingerprint:fingerprint,ownerDeleteClientConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE});
    expect(confirmed.statusCode).toBe(200);
    expect(await f.db.getOAuthClient(client)).toBeNull();
  });
  it('a confirmed deletion removes the client row, revokes every token across accounts, and journals irreversibly',async()=>{
    const f=await createFixture();
    const preview=await f.submit(request),id=getId(preview.body),
      fingerprint=getFingerprint(preview.body);
    const confirm={action:'confirm-delete-client',id,
      deleteClientFingerprint:fingerprint,ownerDeleteClientConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE};
    const result=await f.submit(confirm);
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('deleted permanently');
    expect(result.body).toContain('cannot be undone');
    expect(await f.db.getOAuthClient(client)).toBeNull();
    expect(await f.db.getDeleteClientEvaluation(client)).toBeNull();
    expect(await f.db.getAccessToken('delclient_access_1')).toBeNull();
    expect(await f.db.getAccessToken('delclient_access_2')).toBeNull();
    expect(await f.db.getTokenByRefreshToken('delclient_refresh_1')).toBeNull();
    // Another client's token and the pass-carrying client are untouched.
    expect(await f.db.getAccessToken('delclient_access_other')).not.toBeNull();
    expect(await f.db.getOAuthClient('client_bystander')).not.toBeNull();
    expect(await f.db.getRtcPass(passToken)).not.toBeNull();
    const audits=await deleteAudits(f.db);
    expect(audits).toHaveLength(1);
    expect(audits[0].target).toBe(client);
    expect(audits[0].dry_run).toBe(false);
    expect(audits[0].summary).toContain('IRREVERSIBLE');
    expect(audits[0].summary).toContain(fingerprint);
    // No inverse is recorded: stripe_undo_change refuses this journal
    // row by its existing irreversible-action rule (inverse IS NOT
    // NULL gate), and the row carries no owning account to undo under.
    expect(audits[0].inverse).toBeNull();
    expect((await f.submit(confirm)).statusCode).toBe(410);
  });
  it('deleting the pass-carrying client revokes its pass',async()=>{
    const f=await createFixture();
    const preview=await f.submit({action:'request-delete-client',
      clientId:passClient,passphrase:env.ADMIN_PASSPHRASE});
    expect(preview.statusCode).toBe(200);
    const id=getId(preview.body),fingerprint=getFingerprint(preview.body);
    const result=await f.submit({action:'confirm-delete-client',id,
      deleteClientFingerprint:fingerprint,ownerDeleteClientConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE});
    expect(result.statusCode).toBe(200);
    expect(await f.db.getOAuthClient(passClient)).toBeNull();
    expect(await f.db.getRtcPass(passToken)).toBeNull();
    expect(await f.db.getOAuthClient(client)).not.toBeNull();
    expect(await f.db.getAccessToken('delclient_access_1')).not.toBeNull();
  });
  it('a state change after the request voids the old fingerprint; the fresh fingerprint confirms',async()=>{
    const f=await createFixture();
    const preview=await f.submit(request),id=getId(preview.body),
      fingerprint=getFingerprint(preview.body);
    await f.db.createAccessToken({accessToken:'delclient_access_3',
      clientId:client,stripeAccount:account,mode:'test',profile:'read_only'});
    const stale=await f.submit({action:'confirm-delete-client',id,
      deleteClientFingerprint:fingerprint,ownerDeleteClientConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE});
    expect(stale.statusCode).toBe(409);
    const fresh=getFingerprint(stale.body);
    expect(fresh).not.toBe(fingerprint);
    expect(await f.db.getOAuthClient(client)).not.toBeNull();
    const confirmed=await f.submit({action:'confirm-delete-client',id,
      deleteClientFingerprint:fresh,ownerDeleteClientConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE});
    expect(confirmed.statusCode).toBe(200);
    expect(await f.db.getOAuthClient(client)).toBeNull();
    expect(await f.db.getAccessToken('delclient_access_3')).toBeNull();
  });
  it('an expired intent refuses and removes nothing',async()=>{
    let now=Date.now();
    const f=await createFixture({clock:()=>now});
    const preview=await f.submit(request),id=getId(preview.body),
      fingerprint=getFingerprint(preview.body);
    now+=11*60*1000;
    const expired=await f.submit({action:'confirm-delete-client',id,
      deleteClientFingerprint:fingerprint,ownerDeleteClientConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE});
    expect(expired.statusCode).toBe(410);
    expect(await f.db.getOAuthClient(client)).not.toBeNull();
    expect(await f.db.getAccessToken('delclient_access_1')).not.toBeNull();
  });
  it('db consume refuses a malformed fingerprint and a second consumption',async()=>{
    const f=await createFixture();
    const id='D'.repeat(32);
    expect(await f.db.requestDeleteClientIntent({id,clientId:client,
      expiresAt:new Date(Date.now()+600000)})).toBe(true);
    const expected=await f.db.getDeleteClientEvaluation(client);
    expect(await f.db.consumeDeleteClientIntent({id,expected,
      expectedFingerprint:'not-a-fingerprint'})).toBe(false);
    expect(await f.db.getOAuthClient(client)).not.toBeNull();
    expect(await f.db.consumeDeleteClientIntent({id,expected,
      expectedFingerprint:'DELC-AAAAA-AAAAA-AAAAA-AAAAA'})).toBe(true);
    expect(await f.db.consumeDeleteClientIntent({id,expected,
      expectedFingerprint:'DELC-AAAAA-AAAAA-AAAAA-AAAAA'})).toBe(false);
    expect(await f.db.getOAuthClient(client)).toBeNull();
  });
});

describe('CAP4-RECENSUS-2 deleted clients refuse at the OAuth doors',()=>{
  it('authorization and token attempts naming the deleted client refuse',async()=>{
    const f=await createFixture();
    const h=createOAuthHandlers({db:f.db,env});
    const call=async(handler,request)=>{
      const res=response();await handler(request,res);return res;
    };
    const authorizeArgs={client_id:client,redirect_uri:callback,
      response_type:'code',code_challenge:challenge,
      code_challenge_method:'S256',resource:env.PUBLIC_BASE_URL+'/api/mcp'};
    // Before deletion the consent page answers for this client.
    const before=await call(h.authorize,req('GET',authorizeArgs));
    expect(before.statusCode).toBe(200);
    // A code exchange succeeds before deletion (the refusal below is
    // the deletion's effect, not a fixture defect).
    await f.db.createAuthCode({code:'delclient_code_1',clientId:client,
      redirectUri:callback,codeChallenge:challenge,stripeAccount:account,
      mode:'test',profile:'full',listing:'compact'});
    const exchanged=await call(h.token,req('POST',{
      grant_type:'authorization_code',code:'delclient_code_1',
      redirect_uri:callback,code_verifier:verifier,client_id:client,
      client_secret:'fixture-secret'}));
    expect(exchanged.statusCode).toBe(200);
    // Delete the client through the owner ceremony.
    const preview=await f.submit(request),id=getId(preview.body),
      fingerprint=getFingerprint(preview.body);
    expect((await f.submit({action:'confirm-delete-client',id,
      deleteClientFingerprint:fingerprint,ownerDeleteClientConsent:'yes',
      passphrase:env.ADMIN_PASSPHRASE})).statusCode).toBe(200);
    // Authorization attempts naming the deleted client refuse.
    const after=await call(h.authorize,req('GET',authorizeArgs));
    expect(after.statusCode).toBe(400);
    // A fresh code cannot even be minted for it, and a token attempt
    // with the once-correct secret refuses as an unknown client.
    await f.db.createAuthCode({code:'delclient_code_2',clientId:client,
      redirectUri:callback,codeChallenge:challenge,stripeAccount:account,
      mode:'test',profile:'full',listing:'compact'});
    const refused=await call(h.token,req('POST',{
      grant_type:'authorization_code',code:'delclient_code_2',
      redirect_uri:callback,code_verifier:verifier,client_id:client,
      client_secret:'fixture-secret'}));
    expect(refused.statusCode).toBe(401);
    expect(JSON.parse(refused.body).error).toBe('invalid_client');
  });
});
