// Owner-obedience V2, family 13 (Projects) — provider-write half
// (coordinator ruling 4): project_portal_create,
// workflow_project_setup and workflow_app_readiness_fix are
// admitted by the dispatcher in BOTH modes (the projects area was
// in neither guarded set, so TEST reachability is itself new) and
// complete the confirmed-action sequence in the connection's mode
// (fake provider + fake database only; no LIVE key, no real
// account). The binding half — project_bind_profile_account and
// project_enable_scoped_ownership — is NOT converted: it gains no
// dispatcher admission in either mode and its handlers refuse
// non-TEST connections with exactly today's outcomes; it is
// referred to the owner-surface migration. The readiness READ
// keeps its TEST-only reachability exactly; only the fix's
// internal observation is mode-parameterized.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {APP_SEED} from '../../src/apps/profiles.js';
import {isGuardedTestWrite,isGuardedLiveWrite,listingForConnection}
  from '../../src/core/profiles.js';
const parse=r=>JSON.parse(r.content[0].text);
const FINGERPRINT=/^WRITE-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/;
const PROVIDER=['project_portal_create','workflow_project_setup',
  'workflow_app_readiness_fix'];
const BINDING=['project_bind_profile_account',
  'project_enable_scoped_ownership'];
const OWNER={mode:'live',profile:'full',listing:'catalog',
  context:'customer',rtcLiveOwnerApproved:true,moneyLimitCents:0};
afterEach(()=>vi.unstubAllEnvs());

describe('V2 Projects dispatcher admission — provider half only (ruling 4)',()=>{
  it('the registry carries exactly the five family writes in area projects',()=>{
    const writes=registry.tools.filter(t=>t.area==='projects'&&t.writes===true)
      .map(t=>t.name).sort();
    expect(writes).toEqual([...PROVIDER,...BINDING].sort());
  });
  it('admits the three provider writes in TEST for their built profiles, never read_only',()=>{
    for(const name of PROVIDER){
      const t=registry.tools.find(x=>x.name===name);
      expect(t.writeContract,name).toBe('defineWrite-v1');
      expect(isGuardedTestWrite(t,{mode:'test',profile:'full'}),name).toBe(true);
      expect(isGuardedTestWrite(t,{mode:'test',profile:'read_only'}),name).toBe(false);
    }
  });
  it('admits the three provider writes in LIVE only on the owner-approved connection',()=>{
    for(const name of PROVIDER){
      const t=registry.tools.find(x=>x.name===name);
      expect(isGuardedLiveWrite(t,OWNER),name).toBe(true);
      expect(isGuardedLiveWrite(t,{...OWNER,rtcLiveOwnerApproved:false}),name)
        .toBe(false);
    }
  });
  it('the binding half gains NO admission in either mode',()=>{
    for(const name of BINDING){
      const t=registry.tools.find(x=>x.name===name);
      expect(isGuardedTestWrite(t,{mode:'test',profile:'full'}),name).toBe(false);
      expect(isGuardedLiveWrite(t,OWNER),name).toBe(false);
    }
    const testNames=listingForConnection(registry,
      {mode:'test',profile:'full',listing:'catalog'}).map(t=>t.name);
    const liveNames=listingForConnection(registry,OWNER).map(t=>t.name);
    for(const name of PROVIDER){
      expect(testNames,name).toContain(name);
      expect(liveNames,name).toContain(name);
    }
    for(const name of BINDING){
      expect(testNames,name).not.toContain(name);
      expect(liveNames,name).not.toContain(name);
    }
  });
});

describe('V2 Projects binding half — refusal behavior byte-identical (regression proof)',()=>{
  const account='acct_PROJ123';
  function fixture(){
    const db=createFakeDb({accounts:[{id:account,label:'Projects fixture',
      live_enabled:true,live_connected:true}]});
    const sdk={accounts:{retrieve:vi.fn(async()=>({id:account,
      object:'account',livemode:false}))},
      balance:{retrieve:vi.fn(async()=>({object:'balance',livemode:true}))}};
    const ctx={db,connectionId:'projects-binding',
      connection:{stripeAccount:account,mode:'test',profile:'full'},
      services:{stripeForConnection:async()=>sdk}};
    return {db,ctx,sdk};
  }
  it('refuses a LIVE connection with exactly today\u2019s outcomes and changes no state',async()=>{
    const f=fixture();
    const live={...f.ctx,liveAccessGranted:true,
      connection:{...f.ctx.connection,mode:'live',context:'customer',
        rtcLiveOwnerApproved:true}};
    vi.stubEnv('VERCEL_ENV','production');
    const bind=await registry.handlers.project_bind_profile_account(
      {app:'appliance-desk',expectedVersion:1,attach:true,confirm:true,
        requestKey:'live-bind'},live);
    expect(bind.isError).toBe(true);
    expect(parse(bind).error).toBe('TEST app-account binding only');
    const scope=await registry.handlers.project_enable_scoped_ownership(
      {acknowledgeScope:true,confirm:true,requestKey:'live-scope'},live);
    expect(scope.isError).toBe(true);
    expect(parse(scope).error).toBe('TEST scope migration only');
    expect((await f.db.getKnownApp('appliance-desk')).version).toBe(1);
    expect(await f.db.getAppGuardScope(account)).toBe('legacy');
  });
  it('still completes the same TEST bind and keeps scope legacy',async()=>{
    const f=fixture();
    const assigned=parse(await registry.handlers.project_bind_profile_account(
      {app:'appliance-desk',expectedVersion:1,attach:true,confirm:true,
        requestKey:'test-bind'},f.ctx));
    expect(assigned.done).toBe(true);
    expect((await f.db.getKnownApp('appliance-desk')).version).toBe(2);
    expect(await f.db.getAppGuardScope(account)).toBe('legacy');
  });
});

describe('V2 Projects portal creation in the connection mode',()=>{
  const account='acct_PROJ123';
  const rules={allow_cancel:false,allow_plan_switch:false,
    allow_payment_method_update:true,allow_invoice_history:true};
  function fixture({live=false,createdMode=null}={}){
    const db=createFakeDb({accounts:[{id:account,label:'Portal fixture',
      live_enabled:true,live_connected:true}]});
    const portals=new Map(),creates=[];
    const sdk={
      accounts:{retrieve:vi.fn(async()=>({id:account,object:'account',
        livemode:live}))},
      balance:{retrieve:vi.fn(async()=>({object:'balance',livemode:live}))},
      billingPortal:{configurations:{
        create:vi.fn(async(args,opts)=>{creates.push({args,opts});
          const v={id:'bpc_PROJ123',object:'billing_portal.configuration',
            livemode:createdMode??live,active:true,
            features:structuredClone(args.features)};
          portals.set(v.id,v);return v;}),
        retrieve:vi.fn(async id=>portals.get(id))}}};
    const ctx={db,connectionId:'projects-portal',
      connection:{stripeAccount:account,mode:live?'live':'test',profile:'full',
        ...(live?{context:'customer',rtcLiveOwnerApproved:true,
          moneyLimitCents:0}:{})},
      ...(live?{liveAccessGranted:true}:{}),
      services:{stripeForConnection:async()=>sdk}};
    return {db,ctx,sdk,creates,
      call:a=>registry.handlers.project_portal_create(a,ctx)};
  }
  it('LIVE: preview discloses the real-customer effect, fingerprint-bound confirm creates exactly once',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=fixture({live:true});
    const preview=parse(await f.call({portalRules:rules,
      requestKey:'live-portal',dryRun:true}));
    expect(preview.done).toBe(false);
    expect(preview.preview).toContain('LIVE '+account);
    expect(preview.preview).toContain('real customers can use it');
    expect(preview.preview).toContain('no app profile is bound');
    expect(preview.previewFingerprint).toMatch(FINGERPRINT);
    expect(f.creates).toHaveLength(0);
    const forged=await f.call({portalRules:rules,requestKey:'live-portal',
      confirm:true,previewFingerprint:'WRITE-00000-00000-00000-00000'});
    expect(forged.isError).toBe(true);
    expect(parse(forged).error).toContain('state has changed');
    expect(f.creates).toHaveLength(0);
    const done=parse(await f.call({portalRules:rules,requestKey:'live-portal',
      confirm:true,previewFingerprint:preview.previewFingerprint}));
    expect(done).toMatchObject({done:true,confirmed:true,
      resourceId:'bpc_PROJ123'});
    expect(f.creates).toHaveLength(1);
    expect(f.creates[0].opts.idempotencyKey).toMatch(/^rmcp_/);
  });
  it('a fingerprint issued in TEST does not confirm in LIVE (mode is bound)',async()=>{
    const t=fixture();
    const testPreview=parse(await t.call({portalRules:rules,
      requestKey:'cross-mode',dryRun:true}));
    expect(testPreview.preview).toContain('TEST '+account);
    vi.stubEnv('VERCEL_ENV','production');
    const f=fixture({live:true});
    const refused=await f.call({portalRules:rules,requestKey:'cross-mode',
      confirm:true,previewFingerprint:testPreview.previewFingerprint});
    expect(refused.isError).toBe(true);
    expect(f.creates).toHaveLength(0);
  });
  it('wrong-mode provider objects are refused in both directions',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const liveSide=fixture({live:true,createdMode:false});
    const liveResult=parse(await liveSide.call({portalRules:rules,
      requestKey:'wrong-live',confirm:true}));
    expect(liveResult.done).toBe(false);
    expect(liveResult.confirmed).toBe(false);
    const testSide=fixture({createdMode:true});
    const testResult=parse(await testSide.call({portalRules:rules,
      requestKey:'wrong-test',confirm:true}));
    expect(testResult.done).toBe(false);
    expect(testResult.confirmed).toBe(false);
  });
  it('a bare LIVE connection is refused by the LIVE-enablement guard, before any write',async()=>{
    const f=fixture({live:true});
    const bare={...f.ctx,liveAccessGranted:false};
    const refused=await registry.handlers.project_portal_create(
      {portalRules:rules,requestKey:'bare-live',confirm:true},bare);
    expect(refused.isError).toBe(true);
    expect(f.creates).toHaveLength(0);
  });
});

describe('V2 Projects guided setup in the connection mode',()=>{
  const account='acct_PROJ123';
  const project={id:'live-business',name:'Live Business',
    website:'https://live-business.example.com',webhookEvents:[],
    metadataKeys:[],stripeCalls:['stripe.prices.list'],
    checkoutModes:['payment'],paymentMethods:['card'],
    ownsCatalog:true,ownsTaxRates:false,
    keyPermissions:{read:['products'],write:['prices']},
    portalRules:{allow_cancel:false,allow_plan_switch:false,
      allow_payment_method_update:true,allow_invoice_history:true},
    billing:{kind:'one_time'}};
  function fixture({createdMode=true}={}){
    const db=createFakeDb({accounts:[{id:account,label:'Setup fixture',
      live_enabled:true,live_connected:true}]});
    const portals=new Map(),creates=[];
    const sdk={
      accounts:{retrieve:vi.fn(async()=>({id:account,object:'account',
        livemode:true}))},
      balance:{retrieve:vi.fn(async()=>({object:'balance',livemode:true}))},
      billingPortal:{configurations:{
        create:vi.fn(async(args,opts)=>{creates.push({args,opts});
          const v={id:'bpc_PROJ123',object:'billing_portal.configuration',
            livemode:createdMode,active:true,
            features:structuredClone(args.features)};
          portals.set(v.id,v);return v;}),
        retrieve:vi.fn(async id=>portals.get(id))}}};
    const ctx={db,connectionId:'projects-setup',liveAccessGranted:true,
      connection:{stripeAccount:account,mode:'live',profile:'full',
        context:'customer',rtcLiveOwnerApproved:true,moneyLimitCents:0},
      services:{stripeForConnection:async()=>sdk}};
    return {db,ctx,sdk,creates,
      call:a=>registry.handlers.workflow_project_setup(a,ctx)};
  }
  it('LIVE: preview names what is and is not bound; steps complete into an unbound draft',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=fixture();
    const preview=parse(await f.call({project,requestKey:'live-setup',
      dryRun:true}));
    expect(preview.done).toBe(false);
    expect(preview.preview).toContain('LIVE project live-business');
    expect(preview.preview).toContain('confirm ONLY portal');
    expect(preview.preview).toContain('does not bind the profile to the account');
    expect(preview.preview).toContain('does not enable scoped ownership');
    expect(preview.previewFingerprint).toMatch(FINGERPRINT);
    expect(f.creates).toHaveLength(0);
    const forged=await f.call({project,requestKey:'live-setup',confirm:true,
      previewFingerprint:'WRITE-00000-00000-00000-00000'});
    expect(forged.isError).toBe(true);
    expect(f.creates).toHaveLength(0);
    const portal=parse(await f.call({project,requestKey:'live-setup',
      confirm:true,previewFingerprint:preview.previewFingerprint}));
    expect(portal.done).toBe(true);
    expect(portal.steps.find(x=>x.name==='portal')).toMatchObject({state:'done'});
    expect(f.creates).toHaveLength(1);
    const draft=parse(await f.call({project,requestKey:'live-setup',
      confirm:true}));
    expect(draft.done).toBe(true);
    const finished=parse(await f.call({project,requestKey:'live-setup',
      confirm:true}));
    expect(finished).toMatchObject({done:true,status:'draft_created',
      accountBound:false,liveEnabled:false});
    const record=await f.db.getKnownApp('live-business');
    expect(record.status).toBe('draft');
    expect(record.profile.stripe_accounts).toEqual([]);
    expect(await f.db.getAppGuardScope(account)).toBe('legacy');
  });
  it('LIVE: a wrong-mode child read-back leaves the step unconfirmed and unreplayed',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=fixture({createdMode:false});
    const result=parse(await f.call({project,requestKey:'live-setup-bad',
      confirm:true}));
    expect(result.done).toBe(false);
    expect(f.creates).toHaveLength(1);
    const run=await f.db.getProjectSetupRun({account,id:'live-business'});
    expect(run?.steps?.portal?.state).not.toBe('done');
  });
});

describe('V2 Projects readiness fix in the connection mode',()=>{
  const account='acct_PROJ123',webhookId='we_LIVE123',
    portalId='bpc_LIVE123',pmc='pmc_LIVE123';
  function fixture({live=true,webhookMode=null}={}){
    const db=createFakeDb({accounts:[{id:account,label:'Readiness fixture',
      live_enabled:true,live_connected:true}]});
    let events=['checkout.session.completed','invoice.paid',
      'invoice.payment_failed','charge.refunded',
      'customer.subscription.deleted'];
    const calls=[];
    const stripe={
      accounts:{retrieve:vi.fn(async()=>({id:account,object:'account',
        livemode:live,charges_enabled:false,details_submitted:false,
        business_profile:{},settings:{branding:{},payments:{}}}))},
      balance:{retrieve:vi.fn(async()=>({object:'balance',livemode:live}))},
      paymentMethodConfigurations:{
        retrieve:vi.fn(async()=>({id:pmc,
          object:'payment_method_configuration',active:true,application:null,
          parent:null,
          us_bank_account:{available:true,display_preference:{
            preference:'on',value:'on'}},
          card:{available:true,display_preference:{
            preference:'on',value:'on'}}}))},
      billingPortal:{configurations:{
        retrieve:vi.fn(async()=>({id:portalId,
          object:'billing_portal.configuration',livemode:live,active:true,
          application:null,features:{
            payment_method_update:{enabled:true},
            invoice_history:{enabled:true},
            subscription_cancel:{enabled:false},
            subscription_update:{enabled:false}}}))}},
      webhookEndpoints:{
        retrieve:vi.fn(async()=>({id:webhookId,object:'webhook_endpoint',
          livemode:webhookMode??live,created:1710000000,status:'enabled',
          url:APP_SEED.webhook_url,enabled_events:events,
          description:'Project webhook',metadata:{},application:null,
          connect:false,api_version:'2026-09-30.endive'})),
        update:vi.fn(async(id,values,opts)=>{
          calls.push({id,values,opts});events=values.enabled_events;
          return {id:webhookId};})}};
    const ctx={db,connectionId:'projects-readiness',
      ...(live?{liveAccessGranted:true}:{}),
      connection:{stripeAccount:account,mode:live?'live':'test',
        profile:'full',...(live?{context:'customer',
          rtcLiveOwnerApproved:true,moneyLimitCents:0}:{})},
      services:{stripeForConnection:async()=>stripe}};
    const select={app:'appliance-desk',webhookEndpoint:webhookId,
      portalConfiguration:portalId,paymentMethodConfiguration:pmc};
    return {db,ctx,stripe,calls,select,
      call:a=>registry.handlers.workflow_app_readiness_fix(a,ctx)};
  }
  async function bound(f){
    await f.db.bindKnownAppAccount({id:APP_SEED.id,account,
      expectedVersion:1,attach:true});
    await f.db.enableScopedAppGuard({account});
  }
  it('LIVE: preview is mode-labeled, fingerprint-bound confirm applies exactly one webhook union',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=fixture();await bound(f);
    const args={...f.select,target:'S11',requestKey:'live-fix'};
    const preview=parse(await f.call({...args,dryRun:true}));
    expect(preview.done).toBe(false);
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('webhook_add_events');
    expect(preview.previewFingerprint).toMatch(FINGERPRINT);
    expect(f.calls).toHaveLength(0);
    const forged=await f.call({...args,confirm:true,
      previewFingerprint:'WRITE-00000-00000-00000-00000'});
    expect(forged.isError).toBe(true);
    expect(f.calls).toHaveLength(0);
    const done=parse(await f.call({...args,confirm:true,
      previewFingerprint:preview.previewFingerprint}));
    expect(done.done).toBe(true);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].values.enabled_events).toHaveLength(7);
    expect(f.calls[0].values.enabled_events).toContain(
      'checkout.session.async_payment_failed');
  });
  it('wrong-mode provider objects are refused in both directions',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const liveSide=fixture({webhookMode:false});await bound(liveSide);
    await expect(liveSide.call({...liveSide.select,target:'S11',
      requestKey:'wrong-live',confirm:true}))
      .rejects.toThrow(/No verified eligible repair/);
    expect(liveSide.calls).toHaveLength(0);
    const testSide=fixture({live:false,webhookMode:true});await bound(testSide);
    await expect(testSide.call({...testSide.select,target:'S11',
      requestKey:'wrong-test',confirm:true}))
      .rejects.toThrow(/No verified eligible repair/);
    expect(testSide.calls).toHaveLength(0);
  });
  it('a bare LIVE connection is refused before any provider write',async()=>{
    const f=fixture();await bound(f);
    const bare={...f.ctx,liveAccessGranted:false};
    const refused=await registry.handlers.workflow_app_readiness_fix(
      {...f.select,target:'S11',requestKey:'bare-fix',confirm:true},bare);
    expect(refused.isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
  it('the readiness READ follows the connection mode (CAP-4 D-8 §A discharge)',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=fixture();await bound(f);
    // CAP-4 D-8 §A discharges the read-reachability note this test
    // pinned: the READ handler's TEST-only gate is converted, so a
    // LIVE connection now receives full LIVE readiness observations
    // (the mode-parameterized path the fix already depended on).
    const served=parse(await registry.handlers.workflow_app_readiness(
      {app:'appliance-desk'},f.ctx));
    expect(served.mode).toBe('live');
    expect(served.liveProviderQueried).toBe(true);
    expect(served.rows).toHaveLength(21);
    const testCtx={db:f.db,connectionId:'projects-readiness-test',
      connection:{stripeAccount:account,mode:'test',profile:'full'},
      services:f.ctx.services};
    const sentinel=parse(await registry.handlers.workflow_app_readiness(
      {spec:{name:'New Service',webhookEvents:[],paymentMethods:[]},
        mode:'live'},testCtx));
    expect(sentinel.mode).toBe('live');
    expect(sentinel.liveProviderQueried).toBe(false);
    expect(f.calls).toHaveLength(0);
  });
});
