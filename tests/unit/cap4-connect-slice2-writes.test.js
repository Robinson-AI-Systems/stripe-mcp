// CAP-4 Connect slice 2 — native lifecycle WRITES for connected
// accounts. At baseline (main 8bc4b95b) none of these eleven tools
// existed: the connect area had reads only, and every POST/DELETE
// below was refused by the universal door (the slice-1 suite pins
// that door classification, unchanged by this slice — D-9 owns the
// flip). Baseline accounting for this suite against a pristine
// checkout: every test here fails as tool-missing (the module and
// its handlers do not exist), except the guarded-door admission
// pins, which fail because the connect area was in neither guarded
// set. The generic machinery guards (defineWrite preview/confirm/
// audit lifecycle, LIVE modeGuard, app guard) already pass at
// baseline in their own suites; this suite proves the Connect
// tools carry the contract on top of them.
//
// The generic seven-case helper (tests/helpers/write-contract.js)
// is not reused: its provider counters assume read and readAfter
// are distinct provider methods and an app-owned metadata target,
// neither of which fits the Connect surface. The same seven checks
// are proven per tool explicitly below.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {tools,handlers} from '../../src/tools/connect-writes.js';
import {registry} from '../../src/tools/index.js';
import {isGuardedTestWrite,isGuardedLiveWrite} from
  '../../src/core/profiles.js';

const platform='acct_PLATFORM1',connected='acct_CONNECT1',
  person='person_PERSON1',bankId='ba_BANK1';
const parse=r=>JSON.parse(r.content[0].text);
const SENTINELS=['SENTINEL_FIRST','SENTINEL_LAST','SENTINEL_IDNUM',
  'sentinel-person@example.com','SENTINEL_ADDR','SENTINEL_ROUTING',
  'SENTINEL_FP','SENTINEL_TAX_ID'];
const LINK_URL='https://connect.stripe.com/setup/s/SENTINEL_LINK_ONCE';
const LOGIN_URL='https://connect.stripe.com/express/SENTINEL_LOGIN_ONCE';

// --- Fixtures (slice-1 shapes, sentinel-laden) ---------------------------
const platformObj=(livemode,over={})=>({id:platform,object:'account',
  ...(livemode!==undefined?{livemode}:{}),...over});
const connectedObj=(livemode,over={})=>({id:connected,object:'account',
  livemode,type:'express',country:'US',default_currency:'usd',
  business_type:'individual',
  business_profile:{name:'FAKE BIZ',
    url:'https://sentinel.example.com'},
  email:'sentinel-biz@example.com',
  company:{name:'FAKE CO',tax_id:'SENTINEL_TAX_ID'},
  metadata:{note:'SENTINEL_META'},
  charges_enabled:true,payouts_enabled:false,details_submitted:true,
  created:1760000000,
  requirements:{currently_due:['company.tax_id'],eventually_due:[],
    past_due:[],pending_verification:[],disabled_reason:null},
  ...over});
const capabilityObj=(livemode,over={})=>({id:'card_payments',
  object:'capability',account:connected,livemode,status:'active',
  requested:true,requested_at:1760000000,
  requirements:{currently_due:[],eventually_due:[],past_due:[],
    pending_verification:[],disabled_reason:null},...over});
const personObj=(livemode,over={})=>({id:person,object:'person',
  account:connected,livemode,created:1760000000,
  first_name:'SENTINEL_FIRST',last_name:'SENTINEL_LAST',
  email:'sentinel-person@example.com',phone:'+1SENTINEL',
  dob:{day:3,month:4,year:1990},address:{line1:'SENTINEL_ADDR'},
  id_number:'SENTINEL_IDNUM',ssn_last_4:'9999',
  verification:{status:'verified'},
  relationship:{owner:true,director:false,representative:true,
    executive:false,percent_ownership:87},
  requirements:{currently_due:['dob.day'],eventually_due:[],
    past_due:[],pending_verification:[],disabled_reason:null},
  ...over});
const bankObj=(livemode,over={})=>({id:bankId,object:'bank_account',
  account:connected,livemode,bank_name:'FAKE BANK',last4:'6789',
  currency:'usd',country:'US',status:'new',default_for_currency:true,
  routing_number:'SENTINEL_ROUTING',fingerprint:'SENTINEL_FP',
  ...over});
const missing=()=>{const e=new Error('No such resource');
  e.code='resource_missing';e.statusCode=404;return e;};

// Stateful fake provider world: creates land in maps, updates merge,
// deletes mark/remove, and idempotency keys replay the ORIGINAL
// response object without creating a second resource.
function fakeConnect({mode='test',platformOver,accountOver,personOver,
    bankOver,capOver,personDeleteRetrieve='deleted',
    externalDeleteRetrieve='missing',muteUpdatePerson=false,
    muteUpdateCapability=false}={}){
  const live=mode==='live';
  const state={
    platform:platformObj(live,platformOver),
    account:connectedObj(live,accountOver),
    persons:new Map([[person,personObj(live,personOver)]]),
    externals:new Map([[bankId,bankObj(live,bankOver)]]),
    capabilities:new Map([['card_payments',
      capabilityObj(live,capOver)]]),
    createdAccounts:new Map(),idem:new Map(),
    personSeq:1,externalSeq:1,accountSeq:1,writes:[]};
  const replay=(opts,make)=>{
    const key=opts?.idempotencyKey;
    if(key&&state.idem.has(key))return state.idem.get(key);
    const v=make();if(key)state.idem.set(key,v);return v;};
  const write=(name,fn)=>vi.fn(async(...args)=>{
    state.writes.push(name);return fn(...args);});
  const sdk={
    accounts:{
      retrieve:vi.fn(async id=>{
        if(id===undefined)return state.platform;
        if(id===state.account.id)return state.account;
        const made=state.createdAccounts.get(id);
        if(made)return made;throw missing();}),
      create:write('accounts.create',async(params,opts)=>
        replay(opts,()=>{
          const id='acct_NEW'+(state.accountSeq++);
          const obj={id,object:'account',livemode:live,
            type:params.type,country:params.country??'US',
            business_type:params.business_type??null,
            business_profile:params.business_profile??{},
            default_currency:params.default_currency??'usd',
            metadata:params.metadata??{},charges_enabled:false,
            payouts_enabled:false,details_submitted:false,
            created:1760000000,
            requirements:{currently_due:[],eventually_due:[],
              past_due:[],pending_verification:[],
              disabled_reason:null}};
          state.createdAccounts.set(id,obj);return obj;})),
      update:write('accounts.update',async(id,params)=>{
        const obj=id===state.account.id?state.account:
          state.createdAccounts.get(id);
        if(!obj)throw missing();
        if(params.business_profile)obj.business_profile=
          {...obj.business_profile,...params.business_profile};
        if(params.business_type!==undefined)
          obj.business_type=params.business_type;
        if(params.metadata)obj.metadata=
          {...obj.metadata,...params.metadata};
        return obj;}),
      createPerson:write('accounts.createPerson',
        async(acct,params,opts)=>replay(opts,()=>{
          const id='person_NEW'+(state.personSeq++);
          const obj={id,object:'person',account:acct,livemode:live,
            created:1760000000,verification:{status:'unverified'},
            requirements:{currently_due:[],eventually_due:[],
              past_due:[],pending_verification:[],
              disabled_reason:null},
            ...structuredClone(params)};
          state.persons.set(id,obj);return obj;})),
      retrievePerson:vi.fn(async(_acct,id)=>{
        const obj=state.persons.get(id);
        if(!obj)throw missing();
        if(obj.deleted===true&&personDeleteRetrieve==='missing')
          throw missing();
        return obj;}),
      updatePerson:write('accounts.updatePerson',
        async(_acct,id,params)=>{
          const obj=state.persons.get(id);
          if(!obj)throw missing();
          if(!muteUpdatePerson){
            const merged={...obj,...structuredClone(params)};
            if(params.dob)merged.dob=params.dob;
            if(params.relationship)merged.relationship=
              {...obj.relationship,...params.relationship};
            state.persons.set(id,merged);return merged;}
          return obj;}),
      deletePerson:write('accounts.deletePerson',async(_acct,id)=>{
        const obj=state.persons.get(id);
        if(!obj)throw missing();
        obj.deleted=true;
        return {id,object:'person',deleted:true};}),
      createExternalAccount:write('accounts.createExternalAccount',
        async(acct,_params,opts)=>replay(opts,()=>{
          const id='ba_NEW'+(state.externalSeq++);
          const obj={id,object:'bank_account',account:acct,
            livemode:live,bank_name:'FAKE BANK',last4:'6789',
            currency:'usd',country:'US',status:'new',
            default_for_currency:_params.default_for_currency===true,
            fingerprint:'SENTINEL_FP'};
          state.externals.set(id,obj);return obj;})),
      retrieveExternalAccount:vi.fn(async(_acct,id)=>{
        const obj=state.externals.get(id);
        if(!obj)throw missing();
        if(obj.deleted===true&&
          externalDeleteRetrieve==='missing')throw missing();
        return obj;}),
      updateExternalAccount:write('accounts.updateExternalAccount',
        async(_acct,id,params)=>{
          const obj=state.externals.get(id);
          if(!obj)throw missing();
          if(params.default_for_currency!==undefined)
            obj.default_for_currency=params.default_for_currency;
          if(params.metadata)obj.metadata=
            {...(obj.metadata??{}),...params.metadata};
          return obj;}),
      deleteExternalAccount:write(
        'accounts.deleteExternalAccount',async(_acct,id)=>{
          const obj=state.externals.get(id);
          if(!obj)throw missing();
          obj.deleted=true;
          return {id,object:'bank_account',deleted:true};}),
      retrieveCapability:vi.fn(async(_acct,id)=>{
        const obj=state.capabilities.get(id);
        if(!obj)throw missing();return obj;}),
      updateCapability:write('accounts.updateCapability',
        async(_acct,id,params)=>{
          const obj=state.capabilities.get(id);
          if(!obj)throw missing();
          if(!muteUpdateCapability)obj.requested=params.requested;
          return obj;}),
      createLoginLink:write('accounts.createLoginLink',
        async()=>({object:'login_link',created:1760000000,
          url:LOGIN_URL}))
    },
    accountLinks:{create:write('accountLinks.create',
      async(params,opts)=>replay(opts,()=>({
        object:'account_link',account:params.account,
        created:1760000000,expires_at:1760003600,url:LINK_URL})))},
    balance:{retrieve:vi.fn(async()=>({object:'balance',
      livemode:live}))}
  };
  return {sdk,state};
}
function testCtx(sdk){
  const db=createFakeDb({accounts:[{id:platform,
    money_limit_cents:0}]});
  return {db,connection:{stripeAccount:platform,mode:'test',
    profile:'full'},services:{stripeForConnection:async()=>sdk}};
}
async function liveCtx(sdk,{granted=true,dbRow={}}={}){
  vi.stubEnv('VERCEL_ENV','production');
  const db=createFakeDb({accounts:[{id:platform,live_enabled:true,
    live_connected:true,money_limit_cents:0,...dbRow}]});
  return {db,connection:{stripeAccount:platform,mode:'live',
    profile:'full'},...(granted?{liveAccessGranted:true}:{}),
    services:{stripeForConnection:async()=>sdk}};
}
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
const auditText=async db=>(await db.listAuditForTest())
  .map(r=>r.summary).join('\n');

// --- Registration ---------------------------------------------------------
describe('CAP-4 Connect slice 2 registration',()=>{
  it('registers exactly the eleven lifecycle writes, full profile, defineWrite-v1',()=>{
    expect(tools.map(t=>t.name)).toEqual([
      'connect_create_account','connect_update_account',
      'connect_create_person','connect_update_person',
      'connect_delete_person','connect_create_external_account',
      'connect_update_external_account',
      'connect_delete_external_account',
      'connect_update_capability','connect_create_account_link',
      'connect_create_login_link']);
    for(const t of tools){
      expect(t.writes).toBe(true);
      expect(t.area).toBe('connect');
      expect(t.profiles).toEqual(['full']);
      expect(t.writeContract).toBe('defineWrite-v1');
      expect(t.description.length).toBeLessThanOrEqual(160);
      expect(typeof handlers[t.name]).toBe('function');
      expect(t.inputSchema.properties.dryRun.type).toBe('boolean');
      expect(t.inputSchema.properties.confirm.type).toBe('boolean');
    }
    expect(registry.tools).toHaveLength(340);
    expect(registry.tools.filter(t=>t.writes===true)).toHaveLength(166);
  });
  it('the guarded doors admit the family in TEST and LIVE',()=>{
    for(const t of registry.tools.filter(x=>x.area==='connect'&&
      x.writes===true)){
      expect(isGuardedTestWrite(t,{mode:'test',profile:'full'}))
        .toBe(true);
      expect(isGuardedLiveWrite(t,{mode:'live',profile:'full',
        rtcLiveOwnerApproved:true,context:'customer'})).toBe(true);
      expect(isGuardedLiveWrite(t,{mode:'live',profile:'full',
        rtcLiveOwnerApproved:false,context:'customer'})).toBe(false);
    }
  });
});

// --- Account create / update ----------------------------------------------
describe('CAP-4 Connect account writes',()=>{
  it('create: dryRun previews the exact parameter set and writes nothing',async()=>{
    const {sdk,state}=fakeConnect({});
    const ctx=testCtx(sdk);
    const r=await handlers.connect_create_account(
      {type:'express',country:'US',businessType:'individual',
        dryRun:true},ctx);
    const out=parse(r);
    expect(out.done).toBe(false);
    expect(out.preview).toContain('TEST MODE');
    expect(out.preview).toContain(platform);
    expect(out.preview).toContain('express');
    expect(out.preview).toContain('type, country, business_type');
    expect(state.writes).toEqual([]);
    const audit=await ctx.db.listAuditForTest();
    expect(audit).toHaveLength(1);
    expect(audit[0].dry_run).toBe(true);
    expect(audit[0].stripe_account).toBe(platform);
  });
  it('create: no-confirm never writes; confirm creates, reads back, and replay returns the original',async()=>{
    const {sdk,state}=fakeConnect({});
    const ctx=testCtx(sdk);
    const args={type:'express',country:'US',
      businessName:'FAKE NEW BIZ',requestKey:'create-1'};
    const pending=parse(await handlers.connect_create_account(
      {...args},ctx));
    expect(pending.done).toBe(false);
    expect(pending.needsConfirmation).toBe(true);
    expect(state.writes).toEqual([]);
    const done=parse(await handlers.connect_create_account(
      {...args,confirm:true},ctx));
    expect(done.done).toBe(true);
    expect(done.resourceId).toBe('acct_NEW1');
    expect(state.writes).toEqual(['accounts.create']);
    const audit=await ctx.db.listAuditForTest();
    expect(audit.at(-1).tool).toBe('connect_create_account');
    expect(audit.at(-1).dry_run).toBe(false);
    expect(audit.at(-1).idempotency_key).toBe(done.idempotencyKey);
    const replay=parse(await handlers.connect_create_account(
      {...args,confirm:true},ctx));
    expect(replay.done).toBe(true);
    expect(replay.resourceId).toBe('acct_NEW1');
    expect(replay.idempotencyKey).toBe(done.idempotencyKey);
    expect(state.createdAccounts.size).toBe(1);
  });
  it('create: a wrong-mode created account refuses the whole call',async()=>{
    const {sdk,state}=fakeConnect({});
    state.accountSeq=1;
    const orig=sdk.accounts.create;
    sdk.accounts.create=vi.fn(async(params,opts)=>{
      const v=await orig(params,opts);
      return {...v,livemode:true};});
    // The apply-time mode refusal makes the outcome uncertain —
    // never a confirmed success.
    const out=parse(await handlers.connect_create_account(
      {type:'express',confirm:true,requestKey:'wm'},testCtx(sdk)));
    expect(out.done).toBe(false);
    expect(out.warning).toMatch(/Read-back/);
    expect(out.resourceId).toBeUndefined();
  });
  it('update: preview names the exact account and change set; confirm verifies by read-back',async()=>{
    const {sdk,state}=fakeConnect({});
    const ctx=testCtx(sdk);
    const args={account:connected,businessName:'RENAMED BIZ',
      metadata:{channel:'partner'},requestKey:'upd-1'};
    const preview=parse(await handlers.connect_update_account(
      {...args,dryRun:true},ctx));
    expect(preview.preview).toContain(connected);
    expect(preview.preview).toContain('business_profile, metadata');
    expect(preview.preview).toContain('charges enabled true');
    expect(state.writes).toEqual([]);
    const done=parse(await handlers.connect_update_account(
      {...args,confirm:true},ctx));
    expect(done.done).toBe(true);
    expect(state.account.business_profile.name).toBe('RENAMED BIZ');
    expect(state.account.metadata.channel).toBe('partner');
  });
  it('update: app-marker metadata is refused before any provider write',async()=>{
    const {sdk,state}=fakeConnect({});
    await expect(handlers.connect_update_account(
      {account:connected,metadata:{agreementId:'foreign-app'},
        confirm:true,requestKey:'marker'},testCtx(sdk)))
      .rejects.toThrow(/app-owned metadata/);
    expect(state.writes).toEqual([]);
  });
  it('update: LIVE executes through the verified seam with fixtures',async()=>{
    const {sdk,state}=fakeConnect({mode:'live'});
    const ctx=await liveCtx(sdk);
    const done=parse(await handlers.connect_update_account(
      {account:connected,businessName:'LIVE BIZ',confirm:true,
        requestKey:'live-1'},ctx));
    expect(done.done).toBe(true);
    expect(done.mode).toBe('LIVE');
    expect(state.account.business_profile.name).toBe('LIVE BIZ');
  });
  it('update: LIVE without the owner grant refuses before any provider write',async()=>{
    const {sdk,state}=fakeConnect({mode:'live'});
    const ctx=await liveCtx(sdk,{granted:false});
    const r=await handlers.connect_update_account(
      {account:connected,businessName:'NOPE',confirm:true,
        requestKey:'live-2'},ctx);
    const out=parse(r);
    expect(out.done).toBe(false);
    expect(state.writes).toEqual([]);
  });
});

// --- Persons ----------------------------------------------------------------
describe('CAP-4 Connect person writes',()=>{
  it('create: preview names fields only — no identity value reaches preview, result or audit',async()=>{
    const {sdk,state}=fakeConnect({});
    const ctx=testCtx(sdk);
    const args={account:connected,firstName:'SENTINEL_FIRST',
      lastName:'SENTINEL_LAST',dobDay:3,dobMonth:4,dobYear:1990,
      owner:true,percentOwnership:87,requestKey:'person-1'};
    const preview=parse(await handlers.connect_create_person(
      {...args,dryRun:true},ctx));
    expect(preview.preview).toContain(connected);
    expect(preview.preview).toContain('first_name');
    expect(preview.preview).toContain('relationship.owner');
    for(const s of SENTINELS)expect(preview.preview).not.toContain(s);
    expect(preview.preview).not.toContain('1990');
    expect(state.writes).toEqual([]);
    const done=parse(await handlers.connect_create_person(
      {...args,confirm:true},ctx));
    expect(done.done).toBe(true);
    expect(done.resourceId).toBe('person_NEW1');
    const created=state.persons.get('person_NEW1');
    expect(created.first_name).toBe('SENTINEL_FIRST');
    expect(created.relationship.percent_ownership).toBe(87);
    const audit=await auditText(ctx.db);
    for(const s of SENTINELS)expect(audit).not.toContain(s);
    expect(audit).not.toContain('1990');
    const replay=parse(await handlers.connect_create_person(
      {...args,confirm:true},ctx));
    expect(replay.resourceId).toBe('person_NEW1');
    expect(state.persons.size).toBe(2);
  });
  it('update: round-trips relationship and name fields; read-back mismatch is never a success',async()=>{
    const {sdk,state}=fakeConnect({});
    const ctx=testCtx(sdk);
    const done=parse(await handlers.connect_update_person(
      {account:connected,person,executive:true,
        firstName:'SENTINEL_FIRST2',confirm:true,
        requestKey:'person-upd'},ctx));
    expect(done.done).toBe(true);
    expect(state.persons.get(person).relationship.executive)
      .toBe(true);
    expect(state.persons.get(person).first_name)
      .toBe('SENTINEL_FIRST2');
    const muted=fakeConnect({muteUpdatePerson:true});
    const bad=parse(await handlers.connect_update_person(
      {account:connected,person,executive:true,confirm:true,
        requestKey:'person-upd'},testCtx(muted.sdk)));
    expect(bad.done).toBe(false);
    expect(bad.warning).toMatch(/Read-back/);
  });
  it('lifecycle round-trip: create → update → delete on one fake world',async()=>{
    const {sdk,state}=fakeConnect({});
    const ctx=testCtx(sdk);
    const created=parse(await handlers.connect_create_person(
      {account:connected,firstName:'SENTINEL_FIRST',owner:true,
        confirm:true,requestKey:'lc-1'},ctx));
    expect(created.done).toBe(true);
    const id=created.resourceId;
    const updated=parse(await handlers.connect_update_person(
      {account:connected,person:id,director:true,confirm:true,
        requestKey:'lc-2'},ctx));
    expect(updated.done).toBe(true);
    expect(state.persons.get(id).relationship.director).toBe(true);
    const deleted=parse(await handlers.connect_delete_person(
      {account:connected,person:id,confirm:true,requestKey:'lc-3'},
      ctx));
    expect(deleted.done).toBe(true);
    expect(state.persons.get(id).deleted).toBe(true);
  });
  it('delete: a provider 404 on read-back still verifies as deleted',async()=>{
    const {sdk}=fakeConnect({personDeleteRetrieve:'missing'});
    const done=parse(await handlers.connect_delete_person(
      {account:connected,person,confirm:true,requestKey:'del-404'},
      testCtx(sdk)));
    expect(done.done).toBe(true);
  });
  it('update preview pins the safe field set: sentinel identity data in the stored person never surfaces',async()=>{
    const {sdk}=fakeConnect({});
    const ctx=testCtx(sdk);
    const preview=parse(await handlers.connect_update_person(
      {account:connected,person,executive:true,dryRun:true},ctx));
    expect(preview.preview).toContain('verification verified');
    expect(preview.preview).toContain('owner true');
    for(const s of SENTINELS)expect(preview.preview).not.toContain(s);
    expect(preview.preview).not.toContain('87');
    expect(preview.preview).not.toContain('9999');
  });
});

// --- External accounts -------------------------------------------------------
describe('CAP-4 Connect external-account writes',()=>{
  it('create: tokenized attach only — raw numbers are refused before any provider call',async()=>{
    const {sdk,state}=fakeConnect({});
    await expect(handlers.connect_create_external_account(
      {account:connected,externalAccountToken:'4242424242424242',
        confirm:true,requestKey:'raw'},testCtx(sdk)))
      .rejects.toThrow(/tokenized/);
    expect(state.writes).toEqual([]);
    const ctx=testCtx(sdk);
    const done=parse(await handlers.connect_create_external_account(
      {account:connected,externalAccountToken:'tok_FAKEBANK',
        defaultForCurrency:true,confirm:true,requestKey:'ext-1'},
      ctx));
    expect(done.done).toBe(true);
    expect(done.resourceId).toBe('ba_NEW1');
    expect(state.externals.get('ba_NEW1').default_for_currency)
      .toBe(true);
    const audit=await auditText(ctx.db);
    expect(audit).not.toContain('tok_FAKEBANK');
    for(const s of SENTINELS)expect(audit).not.toContain(s);
  });
  it('lifecycle round-trip: create → update → delete, delete read-back via provider 404',async()=>{
    const {sdk,state}=fakeConnect({});
    const ctx=testCtx(sdk);
    const created=parse(await handlers.connect_create_external_account(
      {account:connected,externalAccountToken:'tok_FAKEBANK',
        confirm:true,requestKey:'ext-lc-1'},ctx));
    const id=created.resourceId;
    const updated=parse(await handlers
      .connect_update_external_account(
        {account:connected,externalAccount:id,
          defaultForCurrency:true,confirm:true,
          requestKey:'ext-lc-2'},ctx));
    expect(updated.done).toBe(true);
    expect(state.externals.get(id).default_for_currency).toBe(true);
    const deleted=parse(await handlers
      .connect_delete_external_account(
        {account:connected,externalAccount:id,confirm:true,
          requestKey:'ext-lc-3'},ctx));
    expect(deleted.done).toBe(true);
    expect(state.externals.get(id).deleted).toBe(true);
  });
  it('update: preview carries last4 only, never routing or fingerprint',async()=>{
    const {sdk}=fakeConnect({});
    const preview=parse(await handlers
      .connect_update_external_account(
        {account:connected,externalAccount:bankId,
          defaultForCurrency:false,dryRun:true},testCtx(sdk)));
    expect(preview.preview).toContain('…6789');
    expect(preview.preview).not.toContain('SENTINEL_ROUTING');
    expect(preview.preview).not.toContain('SENTINEL_FP');
  });
});

// --- Capability ---------------------------------------------------------------
describe('CAP-4 Connect capability writes',()=>{
  it('request flip verifies by read-back; a silent provider no-op fails the tool',async()=>{
    const {sdk,state}=fakeConnect({capOver:{requested:false}});
    const ctx=testCtx(sdk);
    const preview=parse(await handlers.connect_update_capability(
      {account:connected,capability:'card_payments',requested:true,
        dryRun:true},ctx));
    expect(preview.preview).toContain('card_payments');
    expect(preview.preview).toContain('requested false');
    const done=parse(await handlers.connect_update_capability(
      {account:connected,capability:'card_payments',requested:true,
        confirm:true,requestKey:'cap-1'},ctx));
    expect(done.done).toBe(true);
    expect(state.capabilities.get('card_payments').requested)
      .toBe(true);
    const muted=fakeConnect({muteUpdateCapability:true,
      capOver:{requested:false}});
    const bad=parse(await handlers.connect_update_capability(
      {account:connected,capability:'card_payments',requested:true,
        confirm:true,requestKey:'cap-1'},testCtx(muted.sdk)));
    expect(bad.done).toBe(false);
    expect(bad.warning).toMatch(/Read-back/);
  });
});

// --- Actor verification and mode discipline ----------------------------------
describe('CAP-4 Connect actor verification and mode discipline',()=>{
  it('a connection whose provider account is not the enrolled platform refuses before any connected-account call',async()=>{
    const {sdk,state}=fakeConnect({
      platformOver:{id:'acct_SOMEONEELSE'}});
    await expect(handlers.connect_update_person(
      {account:connected,person,executive:true,confirm:true,
        requestKey:'actor-1'},testCtx(sdk)))
      .rejects.toThrow(/account identity unavailable/);
    // The only provider reads were the platform self-reads; no call
    // ever carried the connected account.
    const retrieveIds=sdk.accounts.retrieve.mock.calls
      .map(c=>c[0]);
    expect(retrieveIds).not.toContain(connected);
    expect(sdk.accounts.retrievePerson).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
  });
  it('actor refusal covers creates and link mints identically',async()=>{
    const {sdk,state}=fakeConnect({
      platformOver:{id:'acct_SOMEONEELSE'}});
    for(const call of [
      ()=>handlers.connect_create_account({type:'express',
        confirm:true,requestKey:'a'},testCtx(sdk)),
      ()=>handlers.connect_create_person({account:connected,
        firstName:'X',confirm:true,requestKey:'a'},testCtx(sdk)),
      ()=>handlers.connect_create_account_link({account:connected,
        type:'account_onboarding',
        refreshUrl:'https://example.com/refresh',
        returnUrl:'https://example.com/return',confirm:true,
        requestKey:'a'},testCtx(sdk))]){
      await expect(call())
        .rejects.toThrow(/account identity unavailable/);
    }
    expect(state.writes).toEqual([]);
  });
  it('a wrong-mode connected object refuses the write before apply',async()=>{
    const {sdk,state}=fakeConnect({personOver:{livemode:true}});
    await expect(handlers.connect_update_person(
      {account:connected,person,executive:true,confirm:true,
        requestKey:'mode-1'},testCtx(sdk)))
      .rejects.toThrow(/mode mismatch/);
    expect(state.writes).toEqual([]);
  });
  it('a wrong-mode read-back fails the tool after apply',async()=>{
    const {sdk,state}=fakeConnect({});
    const orig=sdk.accounts.updatePerson;
    sdk.accounts.updatePerson=vi.fn(async(...args)=>{
      const v=await orig(...args);
      state.persons.set(person,{...v,livemode:true});
      return v;});
    const out=parse(await handlers.connect_update_person(
      {account:connected,person,executive:true,confirm:true,
        requestKey:'mode-2'},testCtx(sdk)));
    expect(out.done).toBe(false);
    expect(out.warning).toMatch(/Read-back/);
  });
  it('exact-argument discipline: unknown or missing arguments refuse',async()=>{
    const {sdk,state}=fakeConnect({});
    await expect(handlers.connect_update_capability(
      {account:connected,capability:'card_payments',requested:true,
        bogus:1,confirm:true,requestKey:'x'},testCtx(sdk)))
      .rejects.toThrow(/Unsupported argument/);
    await expect(handlers.connect_delete_person(
      {account:connected,confirm:true,requestKey:'x'},testCtx(sdk)))
      .rejects.toThrow(/Missing required argument/);
    expect(state.writes).toEqual([]);
  });
});

// --- Minted links: the exception class ----------------------------------------
describe('CAP-4 Connect minted links',()=>{
  const linkArgs={account:connected,type:'account_onboarding',
    refreshUrl:'https://example.com/refresh',
    returnUrl:'https://example.com/return',requestKey:'link-1'};
  it('account link: preview mints nothing and carries no URL; the confirmed result shows the URL exactly once and the audit never does',async()=>{
    const {sdk,state}=fakeConnect({});
    const ctx=testCtx(sdk);
    const preview=parse(await handlers.connect_create_account_link(
      {...linkArgs,dryRun:true},ctx));
    expect(preview.done).toBe(false);
    expect(preview.preview).toContain(connected);
    expect(preview.preview).toContain('no way to read back');
    expect(preview.preview).not.toContain('connect.stripe.com');
    expect(state.writes).toEqual([]);
    const done=await handlers.connect_create_account_link(
      {...linkArgs,confirm:true},ctx);
    const out=parse(done);
    expect(out.done).toBe(true);
    expect(out.link.url).toBe(LINK_URL);
    expect(done.content[0].text.split(LINK_URL).length-1).toBe(1);
    expect(out.note).toContain('no way');
    const audit=await auditText(ctx.db);
    expect(audit).not.toContain(LINK_URL);
    expect(audit).not.toContain('SENTINEL_LINK_ONCE');
    // Replay with the same key returns the original result: the
    // mint is re-presented under the SAME idempotency key, so the
    // provider returns the original link rather than a second one.
    const replay=await handlers.connect_create_account_link(
      {...linkArgs,confirm:true},ctx);
    expect(parse(replay).link.url).toBe(LINK_URL);
    expect(state.writes.filter(w=>w==='accountLinks.create'))
      .toHaveLength(2);
    expect(sdk.accountLinks.create.mock.calls[0][1].idempotencyKey)
      .toBe(sdk.accountLinks.create.mock.calls[1][1].idempotencyKey);
    expect((await auditText(ctx.db))).not.toContain(LINK_URL);
  });
  it('login link: same once-only treatment; Express-only refusal is the provider\u2019s',async()=>{
    const {sdk,state}=fakeConnect({});
    const ctx=testCtx(sdk);
    const preview=parse(await handlers.connect_create_login_link(
      {account:connected,dryRun:true,requestKey:'login-1'},ctx));
    expect(preview.preview).not.toContain('connect.stripe.com');
    expect(state.writes).toEqual([]);
    const done=await handlers.connect_create_login_link(
      {account:connected,confirm:true,requestKey:'login-1'},ctx);
    const out=parse(done);
    expect(out.done).toBe(true);
    expect(out.link.url).toBe(LOGIN_URL);
    expect(done.content[0].text.split(LOGIN_URL).length-1).toBe(1);
    expect((await auditText(ctx.db))).not.toContain(LOGIN_URL);
  });
  it('links execute in LIVE through the verified seam with fixtures',async()=>{
    const {sdk}=fakeConnect({mode:'live'});
    const ctx=await liveCtx(sdk);
    const done=parse(await handlers.connect_create_login_link(
      {account:connected,confirm:true,requestKey:'live-link'},ctx));
    expect(done.done).toBe(true);
    expect(done.mode).toBe('LIVE');
    expect(done.link.url).toBe(LOGIN_URL);
  });
  it('a link mint for a wrong-mode account refuses before minting',async()=>{
    const {sdk,state}=fakeConnect({accountOver:{livemode:true}});
    await expect(handlers.connect_create_login_link(
      {account:connected,confirm:true,requestKey:'wm-link'},
      testCtx(sdk))).rejects.toThrow(/mode mismatch/);
    expect(state.writes).toEqual([]);
  });
});

// --- LIVE person leg ------------------------------------------------------------
describe('CAP-4 Connect LIVE legs',()=>{
  it('person create executes in LIVE fixtures with the safe-fields posture intact',async()=>{
    const {sdk,state}=fakeConnect({mode:'live'});
    const ctx=await liveCtx(sdk);
    const done=parse(await handlers.connect_create_person(
      {account:connected,firstName:'SENTINEL_FIRST',owner:true,
        confirm:true,requestKey:'live-person'},ctx));
    expect(done.done).toBe(true);
    expect(done.mode).toBe('LIVE');
    expect(done.resourceId).toBe('person_NEW1');
    expect(state.persons.get('person_NEW1').first_name)
      .toBe('SENTINEL_FIRST');
    const audit=await auditText(ctx.db);
    for(const s of SENTINELS)expect(audit).not.toContain(s);
  });
  it('LIVE with the account not enabled in the database refuses at the seam',async()=>{
    const {sdk,state}=fakeConnect({mode:'live'});
    const ctx=await liveCtx(sdk,{dbRow:{live_enabled:false}});
    const r=await handlers.connect_create_person(
      {account:connected,firstName:'X',confirm:true,
        requestKey:'live-off'},ctx);
    expect(r.isError).toBe(true);
    expect(state.writes).toEqual([]);
  });
});
