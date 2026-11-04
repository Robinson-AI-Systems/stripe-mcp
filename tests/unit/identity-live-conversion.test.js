import {describe,it,expect,vi,afterEach} from 'vitest';
import {identitySafe,handlers as sessionHandlers}
  from '../../src/tools/identity-sessions.js';
import {makeIdentityCancel,makeIdentityRedact,handlers as lifecycleHandlers}
  from '../../src/tools/identity-lifecycle.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const id='vs_FAKE1234',account='acct_FAKE1234';
const secret='PRIVATE_CLIENT_SECRET_SENTINEL';
const privateValue='PRIVATE_DOCUMENT_SENTINEL';
const liveUrl='https://verify.stripe.com/start/verified-live-link';
const parse=r=>JSON.parse(r.content[0].text);
function liveCtx(db,provider){
  return {db,connectionId:'identity-writer-live',liveAccessGranted:true,
    connection:{stripeAccount:account,mode:'live',profile:'full',
      context:'customer',rtcLiveOwnerApproved:true,resultScope:'identity-live'},
    services:{stripeForConnection:async()=>provider}};
}
function liveCreateFixture({createdLivemode=true}={}){
  let record={id,object:'identity.verification_session',livemode:true,
    created:1695680197,status:'requires_input',type:'document',url:liveUrl,
    client_secret:secret,verified_outputs:{first_name:privateValue},
    last_verification_report:'vr_SECRET123',metadata:{},redaction:null};
  const provider={
    accounts:{retrieve:vi.fn(async()=>({id:account,object:'account',livemode:true}))},
    balance:{retrieve:vi.fn(async()=>({object:'balance',livemode:true}))},
    identity:{verificationSessions:{
      list:vi.fn(async()=>({data:[record],has_more:false})),
      retrieve:vi.fn(async()=>record),
      create:vi.fn(async(a)=>{record={...record,type:a.type,
        livemode:createdLivemode};return record;})}}};
  const db=createFakeDb({accounts:[{id:account,live_enabled:true,
    live_connected:true}]});
  return {provider,db,ctx:liveCtx(db,provider)};
}
function liveLifecycleFixture({status='requires_input',livemode=true}={}){
  let current={id,object:'identity.verification_session',livemode,
    created:1695680197,status,type:'document',redaction:null,
    client_secret:privateValue,verified_outputs:{name:privateValue},
    url:liveUrl,metadata:{}};
  const api={retrieve:vi.fn(async()=>current),
    cancel:vi.fn(async()=>{current={...current,status:'canceled',url:null};
      return current;}),
    redact:vi.fn(async()=>{current={...current,redaction:{status:'processing'},
      url:null};return current;})};
  const provider={
    accounts:{retrieve:vi.fn(async()=>({id:account,object:'account',livemode:true}))},
    balance:{retrieve:vi.fn(async()=>({object:'balance',livemode:true}))},
    identity:{verificationSessions:api}};
  const db=createFakeDb({accounts:[{id:account,live_enabled:true,
    live_connected:true}]});
  const ctx=liveCtx(db,provider);
  return {api,db,ctx,cancel:a=>makeIdentityCancel().handler(a,ctx),
    redact:a=>makeIdentityRedact().handler(a,ctx),
    drift:()=>{current={...current,url:null};}};
}
describe('G-3d/G-3e LIVE Identity writes (owner-obedience V2, family 8)',()=>{
  afterEach(()=>vi.unstubAllEnvs());
  it('projection: a session verifies only in its own mode; no-mode keeps the TEST-only check',()=>{
    const live={id,object:'identity.verification_session',livemode:true,
      created:1695680197,status:'verified',type:'document',redaction:null,
      client_secret:secret,verified_outputs:{first_name:privateValue},
      last_verification_report:'vr_SECRET123',metadata:{private:'SECRET_PERSON'}};
    const safe=identitySafe(live,'live');
    expect(safe).toMatchObject({id,status:'verified',actionRequired:false});
    expect(JSON.stringify(safe)).not.toMatch(/PRIVATE|SECRET|client_secret/);
    expect(()=>identitySafe(live)).toThrow();
    expect(()=>identitySafe(live,'test')).toThrow();
    expect(()=>identitySafe({...live,livemode:false},'live')).toThrow();
  });
  it('create: LIVE preview discloses real-person document collection; fingerprint confirm creates exactly once',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=liveCreateFixture(),a={type:'document',requestKey:'live-create'};
    const preview=parse(await sessionHandlers.identity_create_session(
      {...a,dryRun:true},f.ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('real person will be asked to submit');
    expect(preview.preview).toContain('identity documents to Stripe');
    expect(preview.previewFingerprint)
      .toMatch(/^WRITE-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/);
    expect(preview).not.toHaveProperty('verificationUrl');
    expect(f.provider.identity.verificationSessions.create).not.toHaveBeenCalled();
    const done=parse(await sessionHandlers.identity_create_session(
      {...a,confirm:true,previewFingerprint:preview.previewFingerprint},f.ctx));
    expect(done).toMatchObject({done:true,confirmed:true,
      sessionId:id,verificationUrl:liveUrl});
    expect(f.provider.identity.verificationSessions.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(done)).not.toMatch(/PRIVATE|SECRET|client_secret/);
    expect(JSON.stringify(await f.db.listAuditForTest()))
      .not.toMatch(/PRIVATE|SECRET|client_secret/);
  });
  it('create: a fabricated fingerprint refuses with the fresh fingerprint and creates nothing',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=liveCreateFixture(),a={type:'document',requestKey:'live-fake-fp'};
    const preview=parse(await sessionHandlers.identity_create_session(
      {...a,dryRun:true},f.ctx));
    const refused=parse(await sessionHandlers.identity_create_session(
      {...a,confirm:true,previewFingerprint:'WRITE-00000-00000-00000-00000'},f.ctx));
    expect(refused.done).toBe(false);
    expect(refused.previewFingerprint).toBe(preview.previewFingerprint);
    expect(f.provider.identity.verificationSessions.create).not.toHaveBeenCalled();
    const done=parse(await sessionHandlers.identity_create_session(
      {...a,confirm:true,previewFingerprint:refused.previewFingerprint},f.ctx));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(f.provider.identity.verificationSessions.create).toHaveBeenCalledTimes(1);
  });
  it('create: a wrong-mode create response leaves the write unconfirmed, no URL surfaced',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=liveCreateFixture({createdLivemode:false});
    const done=parse(await sessionHandlers.identity_create_session(
      {type:'document',confirm:true},f.ctx));
    expect(done.confirmed).toBe(false);
    expect(done).not.toHaveProperty('verificationUrl');
  });
  it('cancel: LIVE preview states the person can no longer complete it; confirm cancels exactly once',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=liveLifecycleFixture(),a={sessionId:id,requestKey:'live-cancel'};
    const preview=parse(await f.cancel({...a,dryRun:true}));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('can no longer complete this verification');
    expect(preview.preview).toContain('does not erase');
    expect(f.api.cancel).not.toHaveBeenCalled();
    const done=parse(await f.cancel({...a,confirm:true,
      previewFingerprint:preview.previewFingerprint}));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(f.api.cancel).toHaveBeenCalledTimes(1);
    expect(f.api.cancel).toHaveBeenCalledWith(id,{},
      {idempotencyKey:expect.stringMatching(/^rmcp_identity_cancel_session_/)});
    expect(JSON.stringify(await f.db.listAuditForTest())).not.toContain(privateValue);
  });
  it('cancel: a drifted LIVE confirmation refuses with the fresh fingerprint and executes nothing',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=liveLifecycleFixture(),a={sessionId:id,requestKey:'live-cancel-drift'};
    const preview=parse(await f.cancel({...a,dryRun:true}));
    f.drift();
    const refused=parse(await f.cancel({...a,confirm:true,
      previewFingerprint:preview.previewFingerprint}));
    expect(refused.done).toBe(false);
    expect(refused.error).toMatch(/state has changed/);
    expect(refused.previewFingerprint).not.toBe(preview.previewFingerprint);
    expect(f.api.cancel).not.toHaveBeenCalled();
    const done=parse(await f.cancel({...a,confirm:true,
      previewFingerprint:refused.previewFingerprint}));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(f.api.cancel).toHaveBeenCalledTimes(1);
  });
  it('redact: LIVE preview discloses irreversibility, destruction and the owner retention judgment',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=liveLifecycleFixture({status:'verified'}),
      a={sessionId:id,requestKey:'live-redact'};
    const preview=parse(await lifecycleHandlers.identity_redact_session(
      {...a,dryRun:true},f.ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('Irreversibly request redaction');
    expect(preview.preview).toContain('NOT completed erasure');
    expect(preview.preview).toContain('destroys the collected identity documents');
    expect(preview.preview).toContain('owner\'s to judge');
    expect(f.api.redact).not.toHaveBeenCalled();
    const done=parse(await lifecycleHandlers.identity_redact_session(
      {...a,confirm:true,previewFingerprint:preview.previewFingerprint},f.ctx));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(f.api.redact).toHaveBeenCalledTimes(1);
    expect(f.api.redact).toHaveBeenCalledWith(id,{},
      {idempotencyKey:expect.stringMatching(/^rmcp_identity_redact_session_/)});
    expect(JSON.stringify(await f.db.listAuditForTest())).not.toContain(privateValue);
  });
  it('wrong-mode sessions are refused in both directions, with zero provider writes',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const liveSide=liveLifecycleFixture({livemode:false});
    await expect(liveSide.cancel({sessionId:id,confirm:true}))
      .rejects.toThrow(/Exact LIVE Identity verification session unavailable/);
    await expect(liveSide.redact({sessionId:id,confirm:true}))
      .rejects.toThrow(/Exact LIVE Identity verification session unavailable/);
    expect(liveSide.api.cancel).not.toHaveBeenCalled();
    expect(liveSide.api.redact).not.toHaveBeenCalled();
    const liveRecord=liveLifecycleFixture({livemode:true});
    const testCtx={db:liveRecord.db,connectionId:'identity-writer-test',
      connection:{stripeAccount:account,mode:'test',profile:'full',
        resultScope:'identity-test'},
      services:liveRecord.ctx.services};
    await expect(makeIdentityCancel().handler({sessionId:id,confirm:true},testCtx))
      .rejects.toThrow(/Exact TEST Identity verification session unavailable/);
    await expect(makeIdentityRedact().handler({sessionId:id,confirm:true},testCtx))
      .rejects.toThrow(/Exact TEST Identity verification session unavailable/);
    expect(liveRecord.api.cancel).not.toHaveBeenCalled();
    expect(liveRecord.api.redact).not.toHaveBeenCalled();
  });
  it('a session in a non-redactable state is refused in LIVE, as in TEST',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const processing=liveLifecycleFixture({status:'processing'});
    await expect(processing.redact({sessionId:id,confirm:true})).rejects.toThrow();
    const canceled=liveLifecycleFixture({status:'canceled'});
    await expect(canceled.cancel({sessionId:id,confirm:true})).rejects.toThrow();
    await expect(canceled.redact({sessionId:id,confirm:true})).rejects.toThrow();
    expect(processing.api.redact).not.toHaveBeenCalled();
    expect(canceled.api.cancel).not.toHaveBeenCalled();
    expect(canceled.api.redact).not.toHaveBeenCalled();
  });
});
