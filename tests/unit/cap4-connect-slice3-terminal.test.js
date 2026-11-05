// CAP-4 Connect slice 3 — the terminal operations: account
// delete, reject and unreject, under the strongest ceremony the
// write contract offers (the full defineWrite lifecycle plus the
// exact-account confirmation shape: confirmAccount must repeat the
// exact connected-account ID). At baseline (main b55d3ec) none of
// these three tools existed: slices 1–2 landed the reads and the
// lifecycle writes, and a slice-1 suite pin asserted exactly this
// remainder. Baseline accounting for this suite against a pristine
// checkout: every test here fails as tool-missing (the handlers
// are absent and the registry totals are 340/166), none as
// behavior. The guard pins that pass at baseline pass because the
// machinery already refuses: the universal door's pinned Connect
// write classifications (slice-1 suite, unedited by this slice —
// D-9 owns the flip) and the generic defineWrite contract suite.
//
// The generic seven-case helper (tests/helpers/write-contract.js)
// is not reused, for the reason the slice-2 suite records; the
// same seven checks are proven per tool explicitly below.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {tools,handlers} from '../../src/tools/connect-writes.js';
import {registry} from '../../src/tools/index.js';
import {isGuardedTestWrite,isGuardedLiveWrite} from
  '../../src/core/profiles.js';

const platform='acct_PLATFORM1',connected='acct_CONNECT1';
const parse=r=>JSON.parse(r.content[0].text);
const SENTINELS=['SENTINEL_TAX_ID','sentinel-biz@example.com',
  'SENTINEL_META'];

// --- Fixtures (slice-1/2 shapes, sentinel-laden) --------------------------
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
  charges_enabled:true,payouts_enabled:true,details_submitted:true,
  created:1760000000,
  requirements:{currently_due:[],eventually_due:[],past_due:[],
    pending_verification:[],disabled_reason:null},
  ...over});
const missing=()=>{const e=new Error('No such resource');
  e.code='resource_missing';e.statusCode=404;return e;};

// Stateful fake provider world for the terminal surface: reject
// lands the Stripe-shaped disabled reason, unreject clears it,
// delete marks the account, and idempotency keys replay the
// ORIGINAL response object (the slice-2 world pattern).
function fakeTerminal({mode='test',platformOver,accountOver,
    accountDeleteRetrieve='marker',muteReject=false,
    muteUnreject=false}={}){
  const live=mode==='live';
  const state={platform:platformObj(live,platformOver),
    account:connectedObj(live,accountOver),deleted:false,
    idem:new Map(),writes:[],lastReject:null};
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
        if(id===state.account.id){
          if(state.deleted&&accountDeleteRetrieve==='missing')
            throw missing();
          return state.account;}
        throw missing();}),
      del:write('accounts.del',async(id,_params,opts)=>
        replay(opts,()=>{
          state.deleted=true;
          if(accountDeleteRetrieve==='marker')
            state.account={...state.account,deleted:true};
          return {id,object:'account',deleted:true};})),
      reject:write('accounts.reject',async(id,params,opts)=>
        replay(opts,()=>{
          state.lastReject=params;
          if(!muteReject){
            const dr=params.reason.startsWith('fraud')?
              'rejected.fraud':
              params.reason==='terms_of_service'?
                'rejected.terms_of_service':'rejected.other';
            state.account={...state.account,charges_enabled:false,
              payouts_enabled:params.payouts_action==='none'?
                state.account.payouts_enabled:false,
              requirements:{...state.account.requirements,
                disabled_reason:dr}};}
          return state.account;})),
      unreject:write('accounts.unreject',async(_id,_p,opts)=>
        replay(opts,()=>{
          if(!muteUnreject)
            state.account={...state.account,charges_enabled:true,
              requirements:{...state.account.requirements,
                disabled_reason:null}};
          return state.account;}))
    },
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
const terminalCalls={
  connect_delete_account:{account:connected,
    confirmAccount:connected},
  connect_reject_account:{account:connected,
    confirmAccount:connected,reason:'fraud_other'},
  connect_unreject_account:{account:connected,
    confirmAccount:connected}};

// --- Registration ---------------------------------------------------------
describe('CAP-4 Connect slice 3 registration',()=>{
  it('registers exactly the three terminal writes after the slice-2 eleven, full profile, defineWrite-v1',()=>{
    expect(tools.map(t=>t.name).slice(-3)).toEqual([
      'connect_delete_account','connect_reject_account',
      'connect_unreject_account']);
    for(const t of tools.slice(-3)){
      expect(t.writes).toBe(true);
      expect(t.area).toBe('connect');
      expect(t.profiles).toEqual(['full']);
      expect(t.writeContract).toBe('defineWrite-v1');
      expect(t.description.length).toBeLessThanOrEqual(160);
      expect(typeof handlers[t.name]).toBe('function');
      expect(t.inputSchema.properties.confirmAccount.type)
        .toBe('string');
      expect(t.inputSchema.required).toContain('confirmAccount');
      expect(t.inputSchema.required).toContain('account');
    }
    expect(registry.tools).toHaveLength(344);
    expect(registry.tools.filter(t=>t.writes===true))
      .toHaveLength(169);
  });
  it('the guarded doors admit the terminal writes in TEST and LIVE',()=>{
    for(const t of registry.tools.filter(x=>
      ['connect_delete_account','connect_reject_account',
        'connect_unreject_account'].includes(x.name))){
      expect(isGuardedTestWrite(t,{mode:'test',profile:'full'}))
        .toBe(true);
      expect(isGuardedLiveWrite(t,{mode:'live',profile:'full',
        rtcLiveOwnerApproved:true,context:'customer'})).toBe(true);
      expect(isGuardedLiveWrite(t,{mode:'live',profile:'full',
        rtcLiveOwnerApproved:false,context:'customer'}))
        .toBe(false);
    }
  });
});

// --- The exact-account confirmation ceremony -------------------------------
describe('CAP-4 Connect slice 3 confirmation ceremony',()=>{
  for(const [name,args] of Object.entries(terminalCalls)){
    it(name+': a missing confirmAccount refuses before any provider call',async()=>{
      const {sdk,state}=fakeTerminal({});
      const {confirmAccount:_drop,...rest}=args;
      await expect(handlers[name](
        {...rest,confirm:true,requestKey:'ceremony'},
        testCtx(sdk)))
        .rejects.toThrow(/Missing required argument: confirmAccount/);
      expect(sdk.accounts.retrieve).not.toHaveBeenCalled();
      expect(state.writes).toEqual([]);
    });
    it(name+': a mismatched confirmAccount refuses before any provider call',async()=>{
      const {sdk,state}=fakeTerminal({});
      await expect(handlers[name](
        {...args,confirmAccount:'acct_OTHER99',confirm:true,
          requestKey:'ceremony'},testCtx(sdk)))
        .rejects.toThrow(/must repeat the exact connected account ID/);
      expect(sdk.accounts.retrieve).not.toHaveBeenCalled();
      expect(state.writes).toEqual([]);
    });
    it(name+': the platform account ID repeated as the confirmation refuses',async()=>{
      const {sdk,state}=fakeTerminal({});
      await expect(handlers[name](
        {...args,confirmAccount:platform,confirm:true,
          requestKey:'ceremony'},testCtx(sdk)))
        .rejects.toThrow(/must repeat the exact connected account ID/);
      expect(sdk.accounts.retrieve).not.toHaveBeenCalled();
      expect(state.writes).toEqual([]);
    });
    it(name+': the platform account offered as the subject refuses before any provider call',async()=>{
      const {sdk,state}=fakeTerminal({});
      await expect(handlers[name](
        {...args,account:platform,confirmAccount:platform,
          confirm:true,requestKey:'ceremony'},testCtx(sdk)))
        .rejects.toThrow(/never a Connect terminal subject/);
      expect(sdk.accounts.retrieve).not.toHaveBeenCalled();
      expect(state.writes).toEqual([]);
    });
  }
  it('even a dry-run preview demands the confirmation shape',async()=>{
    const {sdk,state}=fakeTerminal({});
    await expect(handlers.connect_delete_account(
      {account:connected,dryRun:true},testCtx(sdk)))
      .rejects.toThrow(/Missing required argument: confirmAccount/);
    expect(sdk.accounts.retrieve).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
  });
  it('reject: a reason outside Stripe\u2019s accepted values refuses by shape before any provider call',async()=>{
    const {sdk,state}=fakeTerminal({});
    await expect(handlers.connect_reject_account(
      {account:connected,confirmAccount:connected,reason:'bogus',
        confirm:true,requestKey:'reason'},testCtx(sdk)))
      .rejects.toThrow(/values Stripe accepts/);
    expect(sdk.accounts.retrieve).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
  });
  it('reject: an unknown payouts action refuses before any provider call',async()=>{
    const {sdk,state}=fakeTerminal({});
    await expect(handlers.connect_reject_account(
      {account:connected,confirmAccount:connected,
        reason:'fraud_other',payoutsAction:'halt',confirm:true,
        requestKey:'payouts'},testCtx(sdk)))
      .rejects.toThrow(/Payouts action must be pause or none/);
    expect(state.writes).toEqual([]);
  });
});

// --- Actor verification and mode discipline ---------------------------------
describe('CAP-4 Connect slice 3 actor and mode discipline',()=>{
  it('a non-platform connection refuses every terminal tool before any connected-account call',async()=>{
    const {sdk,state}=fakeTerminal({
      platformOver:{id:'acct_SOMEONEELSE'}});
    for(const [name,args] of Object.entries(terminalCalls)){
      await expect(handlers[name](
        {...args,confirm:true,requestKey:'actor'},testCtx(sdk)))
        .rejects.toThrow(/account identity unavailable/);
    }
    const retrieveIds=sdk.accounts.retrieve.mock.calls.map(c=>c[0]);
    expect(retrieveIds).not.toContain(connected);
    expect(state.writes).toEqual([]);
  });
  it('a wrong-mode connected account refuses the terminal write before apply',async()=>{
    const {sdk,state}=fakeTerminal({accountOver:{livemode:true}});
    await expect(handlers.connect_reject_account(
      {account:connected,confirmAccount:connected,
        reason:'fraud_other',confirm:true,requestKey:'mode-1'},
      testCtx(sdk))).rejects.toThrow(/mode mismatch/);
    expect(state.writes).toEqual([]);
  });
  it('a wrong-mode read-back after reject fails the tool as uncertain',async()=>{
    const {sdk,state}=fakeTerminal({});
    const orig=sdk.accounts.reject;
    sdk.accounts.reject=vi.fn(async(...args)=>{
      const v=await orig(...args);
      state.account={...state.account,livemode:true};
      return v;});
    const out=parse(await handlers.connect_reject_account(
      {account:connected,confirmAccount:connected,
        reason:'fraud_other',confirm:true,requestKey:'mode-2'},
      testCtx(sdk)));
    expect(out.done).toBe(false);
    expect(out.warning).toMatch(/Read-back/);
  });
});

// --- Delete -------------------------------------------------------------------
describe('CAP-4 Connect delete account',()=>{
  const args={account:connected,confirmAccount:connected,
    requestKey:'del-1'};
  it('preview names the exact account and the final effect, writes nothing, and surfaces no identity values',async()=>{
    const {sdk,state}=fakeTerminal({});
    const ctx=testCtx(sdk);
    const preview=parse(await handlers.connect_delete_account(
      {...args,dryRun:true},ctx));
    expect(preview.done).toBe(false);
    expect(preview.preview).toContain('TEST MODE');
    expect(preview.preview).toContain(connected);
    expect(preview.preview).toContain('PERMANENTLY DELETES');
    expect(preview.preview).toContain('cannot be restored');
    for(const s of SENTINELS)
      expect(preview.preview).not.toContain(s);
    expect(state.writes).toEqual([]);
    const audit=await ctx.db.listAuditForTest();
    expect(audit).toHaveLength(1);
    expect(audit[0].dry_run).toBe(true);
  });
  it('no-confirm never writes; confirm deletes, verifies the marker, and replay returns the original',async()=>{
    const {sdk,state}=fakeTerminal({});
    const ctx=testCtx(sdk);
    const pending=parse(await handlers.connect_delete_account(
      {...args},ctx));
    expect(pending.done).toBe(false);
    expect(pending.needsConfirmation).toBe(true);
    expect(state.writes).toEqual([]);
    const done=parse(await handlers.connect_delete_account(
      {...args,confirm:true},ctx));
    expect(done.done).toBe(true);
    expect(state.deleted).toBe(true);
    expect(sdk.accounts.del.mock.calls[0][0]).toBe(connected);
    const audit=await ctx.db.listAuditForTest();
    expect(audit.at(-1).tool).toBe('connect_delete_account');
    expect(audit.at(-1).dry_run).toBe(false);
    expect(audit.at(-1).idempotency_key).toBe(done.idempotencyKey);
    const replay=parse(await handlers.connect_delete_account(
      {...args,confirm:true},ctx));
    expect(replay.done).toBe(true);
    expect(replay.idempotencyKey).toBe(done.idempotencyKey);
    for(const c of sdk.accounts.del.mock.calls)
      expect(c[2]?.idempotencyKey).toBe(done.idempotencyKey);
  });
  it('a provider 404 on read-back still verifies as deleted (the resource_missing shape)',async()=>{
    const {sdk}=fakeTerminal({accountDeleteRetrieve:'missing'});
    const done=parse(await handlers.connect_delete_account(
      {...args,confirm:true},testCtx(sdk)));
    expect(done.done).toBe(true);
    expect(done.resourceId).toBe(connected);
  });
  it('a read-back that still shows a live account fails the tool as uncertain',async()=>{
    const {sdk}=fakeTerminal({accountDeleteRetrieve:'alive'});
    const out=parse(await handlers.connect_delete_account(
      {...args,confirm:true},testCtx(sdk)));
    expect(out.done).toBe(false);
    expect(out.warning).toMatch(/Read-back/);
  });
});

// --- Reject / unreject ---------------------------------------------------------
describe('CAP-4 Connect reject and unreject',()=>{
  const rejectedOver={requirements:{currently_due:[],
    eventually_due:[],past_due:[],pending_verification:[],
    disabled_reason:'rejected.fraud'},charges_enabled:false,
    payouts_enabled:false};
  it('reject: preview shows the exact reason that will be sent; confirm verifies the rejected state by re-reading the account',async()=>{
    const {sdk,state}=fakeTerminal({});
    const ctx=testCtx(sdk);
    const args={account:connected,confirmAccount:connected,
      reason:'fraud_other',requestKey:'rej-1'};
    const preview=parse(await handlers.connect_reject_account(
      {...args,dryRun:true},ctx));
    expect(preview.preview).toContain(connected);
    expect(preview.preview).toContain('exact Stripe reason fraud_other');
    expect(preview.preview).toContain('payouts action pause');
    expect(preview.preview).toContain('no direct read-back');
    expect(state.writes).toEqual([]);
    const done=parse(await handlers.connect_reject_account(
      {...args,confirm:true},ctx));
    expect(done.done).toBe(true);
    expect(state.lastReject).toEqual({reason:'fraud_other'});
    expect(state.account.requirements.disabled_reason)
      .toBe('rejected.fraud');
    expect(state.account.charges_enabled).toBe(false);
    const replay=parse(await handlers.connect_reject_account(
      {...args,confirm:true},ctx));
    expect(replay.done).toBe(true);
    expect(replay.idempotencyKey).toBe(done.idempotencyKey);
  });
  it('reject with payoutsAction none sends payouts_action and leaves payouts enabled',async()=>{
    const {sdk,state}=fakeTerminal({});
    const done=parse(await handlers.connect_reject_account(
      {account:connected,confirmAccount:connected,reason:'credit',
        payoutsAction:'none',confirm:true,requestKey:'rej-2'},
      testCtx(sdk)));
    expect(done.done).toBe(true);
    expect(state.lastReject).toEqual({reason:'credit',
      payouts_action:'none'});
    expect(state.account.payouts_enabled).toBe(true);
    expect(state.account.requirements.disabled_reason)
      .toBe('rejected.other');
  });
  it('reject: a provider that silently keeps the account unrejected fails the tool as uncertain',async()=>{
    const {sdk}=fakeTerminal({muteReject:true});
    const out=parse(await handlers.connect_reject_account(
      {account:connected,confirmAccount:connected,
        reason:'fraud_other',confirm:true,requestKey:'rej-3'},
      testCtx(sdk)));
    expect(out.done).toBe(false);
    expect(out.warning).toMatch(/Read-back/);
    expect(out.resourceId).toBeUndefined();
  });
  it('unreject: preview shows the rejected before-state; confirm verifies the restored state by re-reading',async()=>{
    const {sdk,state}=fakeTerminal({accountOver:rejectedOver});
    const ctx=testCtx(sdk);
    const args={account:connected,confirmAccount:connected,
      requestKey:'unrej-1'};
    const preview=parse(await handlers.connect_unreject_account(
      {...args,dryRun:true},ctx));
    expect(preview.preview).toContain('UNREJECTS');
    expect(preview.preview).toContain('disabled reason rejected.fraud');
    const done=parse(await handlers.connect_unreject_account(
      {...args,confirm:true},ctx));
    expect(done.done).toBe(true);
    expect(state.account.requirements.disabled_reason).toBeNull();
    expect(state.account.charges_enabled).toBe(true);
  });
  it('unreject: a provider that silently keeps the rejection fails the tool as uncertain',async()=>{
    const {sdk}=fakeTerminal({accountOver:rejectedOver,
      muteUnreject:true});
    const out=parse(await handlers.connect_unreject_account(
      {account:connected,confirmAccount:connected,confirm:true,
        requestKey:'unrej-2'},testCtx(sdk)));
    expect(out.done).toBe(false);
    expect(out.warning).toMatch(/Read-back/);
  });
  it('round-trip: reject then unreject on one fake world ends restored',async()=>{
    const {sdk,state}=fakeTerminal({});
    const ctx=testCtx(sdk);
    const rejected=parse(await handlers.connect_reject_account(
      {account:connected,confirmAccount:connected,
        reason:'terms_of_service',confirm:true,requestKey:'rt-1'},
      ctx));
    expect(rejected.done).toBe(true);
    expect(state.account.requirements.disabled_reason)
      .toBe('rejected.terms_of_service');
    const restored=parse(await handlers.connect_unreject_account(
      {account:connected,confirmAccount:connected,confirm:true,
        requestKey:'rt-2'},ctx));
    expect(restored.done).toBe(true);
    expect(state.account.requirements.disabled_reason).toBeNull();
    const audit=await auditText(ctx.db);
    expect(audit).toContain('terms_of_service');
    for(const s of SENTINELS)expect(audit).not.toContain(s);
  });
});

// --- LIVE legs -------------------------------------------------------------------
describe('CAP-4 Connect slice 3 LIVE legs',()=>{
  it('reject executes in LIVE through the verified seam with fixtures',async()=>{
    const {sdk,state}=fakeTerminal({mode:'live'});
    const ctx=await liveCtx(sdk);
    const done=parse(await handlers.connect_reject_account(
      {account:connected,confirmAccount:connected,
        reason:'fraud_other',confirm:true,requestKey:'live-rej'},
      ctx));
    expect(done.done).toBe(true);
    expect(done.mode).toBe('LIVE');
    expect(state.account.requirements.disabled_reason)
      .toBe('rejected.fraud');
  });
  it('delete in LIVE without the owner grant refuses with zero provider writes',async()=>{
    const {sdk,state}=fakeTerminal({mode:'live'});
    const ctx=await liveCtx(sdk,{granted:false});
    const out=parse(await handlers.connect_delete_account(
      {account:connected,confirmAccount:connected,confirm:true,
        requestKey:'live-del'},ctx));
    expect(out.done).toBe(false);
    expect(state.writes).toEqual([]);
    expect(state.deleted).toBe(false);
  });
});
