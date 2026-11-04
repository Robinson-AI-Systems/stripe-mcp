// CAP-4 Connect slice 1 — native projected reads for CONNECTED
// accounts. At baseline the seven pinned v1 GETs had no native
// reader: six were served by the universal door in raw provider
// shape (unprojected third-party data) and the person-by-id GET
// was refused by the door's sensitive-family rule, which names a
// specialized native reader — this slice is that reader. (The
// door's rule matches the {person} path segment but not the
// 'persons' list segment, so the list was door-served; the card's
// drift table records the asymmetry for D-9.) The 13
// pinned POST/DELETE operations (slices 2 and 3, plus the minting
// class) must remain exactly as refused as at baseline; the final
// describe pins the door's own classification for every one.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {tools,handlers} from '../../src/tools/connect-reads.js';
import {handlers as universal} from '../../src/tools/universal.js';
import {registry} from '../../src/tools/index.js';
import {getOperation} from '../../src/stripe/openapi-index.js';
import {classifyUniversalWrite} from '../../src/stripe/universal-policy.js';
import {financialDecision} from '../../src/stripe/money-operations.js';
import {preferredNative} from '../../src/stripe/hand-built-map.js';

const platform='acct_PLATFORM1',connected='acct_CONNECT1',
  person='person_PERSON1',bankId='ba_BANK1',cardId='card_CARD1';
const parse=r=>JSON.parse(r.content[0].text);
const listOf=v=>({object:'list',data:Array.isArray(v)?v:[v],has_more:false});

function testCtx(sdk){
  return {connection:{stripeAccount:platform,mode:'test',profile:'full'},
    services:{stripeForConnection:async()=>sdk}};
}
async function liveCtx(sdk){
  vi.stubEnv('VERCEL_ENV','production');
  const db=createFakeDb({accounts:[{id:platform,live_enabled:true,
    live_connected:true,money_limit_cents:0}]});
  return {db,connection:{stripeAccount:platform,mode:'live',
    profile:'full'},services:{stripeForConnection:async()=>sdk}};
}
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});

// --- Fixtures -----------------------------------------------------------
const platformObj=(livemode,over={})=>({id:platform,object:'account',
  ...(livemode!==undefined?{livemode}:{}),...over});
const connectedObj=(livemode,over={})=>({id:connected,object:'account',
  livemode,type:'express',country:'US',default_currency:'usd',
  business_type:'individual',
  business_profile:{name:'FAKE BIZ',support_email:'sentinel-biz@example.com',
    url:'https://sentinel.example.com'},
  email:'sentinel-biz@example.com',
  company:{name:'FAKE CO',tax_id:'SENTINEL_TAX_ID'},
  individual:{first_name:'SENTINEL_FIRST'},
  metadata:{note:'SENTINEL_META'},
  charges_enabled:true,payouts_enabled:false,details_submitted:true,
  created:1760000000,
  requirements:{currently_due:['company.tax_id'],eventually_due:[],
    past_due:[],pending_verification:[],disabled_reason:null,
    current_deadline:1761000000},...over});
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
  documents:{passport:{front:'file_SENTINEL_DOC'}},
  verification:{status:'verified',document:{front:'file_SENTINEL_DOC'}},
  relationship:{owner:true,director:false,representative:true,
    executive:false,percent_ownership:87},
  requirements:{currently_due:['dob.day'],eventually_due:[],past_due:[],
    pending_verification:[],disabled_reason:null},...over});
const bankObj=(livemode,over={})=>({id:bankId,object:'bank_account',
  account:connected,livemode,bank_name:'FAKE BANK',last4:'6789',
  currency:'usd',country:'US',status:'new',default_for_currency:true,
  routing_number:'SENTINEL_ROUTING',fingerprint:'SENTINEL_FP',...over});
const cardObj=(livemode,over={})=>({id:cardId,object:'card',
  account:connected,livemode,brand:'Visa',last4:'4242',exp_month:12,
  exp_year:2030,country:'US',currency:'usd',funding:'credit',
  default_for_currency:false,fingerprint:'SENTINEL_CARDFP',...over});

function sdk({mode,platformOver,platformBalance,connectedOver,
    listOver,capOver,capListOver,personOver,personListOver,
    externalOver}={}){
  const live=mode==='live';
  const plat=platformObj(live,platformOver);
  const conn=connectedObj(live,connectedOver);
  return {
    accounts:{
      retrieve:vi.fn(async id=>id===undefined?plat:conn),
      list:vi.fn(async()=>listOf(listOver??conn)),
      listCapabilities:vi.fn(async()=>listOf(capListOver??
        capabilityObj(live,capOver))),
      retrieveCapability:vi.fn(async()=>capabilityObj(live,capOver)),
      listPersons:vi.fn(async()=>listOf(personListOver??
        personObj(live,personOver))),
      retrievePerson:vi.fn(async()=>personObj(live,personOver)),
      retrieveExternalAccount:vi.fn(async(_a,id)=>
        externalOver??(id===cardId?cardObj(live):bankObj(live)))
    },
    balance:{retrieve:vi.fn(async()=>({object:'balance',
      livemode:platformBalance??live}))}
  };
}
const ctx=(mode,s)=>mode==='live'?liveCtx(s):testCtx(s);

// --- Registration -------------------------------------------------------
describe('CAP-4 Connect slice 1 registration',()=>{
  it('registers exactly the seven read tools, all read-only connect area',()=>{
    expect(tools.map(t=>t.name)).toEqual([
      'connect_list_accounts','connect_get_account',
      'connect_list_capabilities','connect_get_capability',
      'connect_get_external_account','connect_list_persons',
      'connect_get_person']);
    for(const t of tools){
      expect(t.writes).toBe(false);
      expect(t.area).toBe('connect');
      expect(t.profiles).toEqual(['read_only','everyday','full']);
      expect(t.description.length).toBeLessThanOrEqual(160);
      expect(t.description).toContain('TEST or LIVE');
      expect(t.name).not.toMatch(/link|token/);
    }
    // Registry totals superseded by slice 2 (11 lifecycle writes):
    // 329+11 tools, 155+11 writes. The slice-1 tools' own pins above
    // are unchanged.
    expect(registry.tools).toHaveLength(340);
    expect(registry.tools.filter(t=>t.writes===true)).toHaveLength(166);
  });
});

// --- Accounts -----------------------------------------------------------
describe('CAP-4 Connect account reads',()=>{
  it('lists projected connected accounts on TEST and LIVE',async()=>{
    for(const mode of ['test','live']){
      const r=await handlers.connect_list_accounts({},
        await ctx(mode,sdk({mode})));
      expect(r.isError).toBeFalsy();
      const out=parse(r);
      expect(out.data).toHaveLength(1);
      expect(out.data[0]).toMatchObject({id:connected,type:'express',
        country:'US',defaultCurrency:'usd',businessName:'FAKE BIZ',
        chargesEnabled:true,payoutsEnabled:false,detailsSubmitted:true,
        requirements:{currentlyDue:['company.tax_id']}});
      const text=r.content[0].text;
      expect(text).not.toContain('SENTINEL');
      expect(text).not.toContain('sentinel-biz@example.com');
    }
  });
  it('refuses the list when a member is the wrong mode',async()=>{
    const s=sdk({mode:'test',listOver:[connectedObj(false),
      connectedObj(true)]});
    const r=await handlers.connect_list_accounts({},testCtx(s));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('mode mismatch');
  });
  it('gets one connected account on TEST and LIVE',async()=>{
    for(const mode of ['test','live']){
      const r=await handlers.connect_get_account({accountId:connected},
        await ctx(mode,sdk({mode})));
      expect(r.isError).toBeFalsy();
      expect(parse(r).id).toBe(connected);
    }
  });
  it('refuses a returned account whose ID differs from the argument',async()=>{
    const s=sdk({mode:'test'});
    // platformAccount verifies the platform via the no-arg retrieve;
    // the connected retrieve must be the one that mismatches.
    s.accounts.retrieve=vi.fn(async id=>id===undefined?
      platformObj(false):connectedObj(false,{id:'acct_OTHER99'}));
    const r=await handlers.connect_get_account({accountId:connected},
      testCtx(s));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('ID mismatch');
  });
  it('refuses missing and inexact connected-account arguments',async()=>{
    const s=sdk({mode:'test'});
    for(const args of [{},{accountId:'acct_'},{accountId:'cus_ABC123'},
        {accountId:connected,extra:1}]){
      const r=await handlers.connect_get_account(args,testCtx(s));
      expect(r.isError).toBe(true);
    }
    expect(s.accounts.retrieve).not.toHaveBeenCalled();
  });
});

// --- Capabilities ---------------------------------------------------------
describe('CAP-4 Connect capability reads',()=>{
  it('lists and gets capabilities on TEST and LIVE',async()=>{
    for(const mode of ['test','live']){
      const list=await handlers.connect_list_capabilities(
        {accountId:connected},await ctx(mode,sdk({mode})));
      expect(list.isError).toBeFalsy();
      expect(parse(list).data[0]).toMatchObject({id:'card_payments',
        account:connected,status:'active',requested:true});
      const get=await handlers.connect_get_capability(
        {accountId:connected,capability:'card_payments'},
        await ctx(mode,sdk({mode})));
      expect(get.isError).toBeFalsy();
      expect(parse(get).status).toBe('active');
    }
  });
  it('refuses a wrong-mode capability in both directions',async()=>{
    const onLive=await handlers.connect_get_capability(
      {accountId:connected,capability:'card_payments'},
      await liveCtx(sdk({mode:'live',capOver:{livemode:false}})));
    expect(onLive.isError).toBe(true);
    expect(onLive.content[0].text).toContain('mode mismatch');
    const onTest=await handlers.connect_get_capability(
      {accountId:connected,capability:'card_payments'},
      testCtx(sdk({mode:'test',capOver:{livemode:true}})));
    expect(onTest.isError).toBe(true);
  });
  it('refuses a capability belonging to a different account',async()=>{
    const s=sdk({mode:'test',capOver:{account:'acct_OTHER99'}});
    const r=await handlers.connect_get_capability(
      {accountId:connected,capability:'card_payments'},testCtx(s));
    expect(r.isError).toBe(true);
  });
});

// --- External accounts ----------------------------------------------------
describe('CAP-4 Connect external-account reads',()=>{
  it('projects a masked bank destination on TEST and LIVE',async()=>{
    for(const mode of ['test','live']){
      const r=await handlers.connect_get_external_account(
        {accountId:connected,externalAccountId:bankId},
        await ctx(mode,sdk({mode})));
      expect(r.isError).toBeFalsy();
      expect(parse(r)).toMatchObject({id:bankId,object:'bank_account',
        last4:'6789',bankName:'FAKE BANK',status:'new'});
      expect(r.content[0].text).not.toContain('SENTINEL');
    }
  });
  it('projects a masked card destination without its fingerprint',async()=>{
    const r=await handlers.connect_get_external_account(
      {accountId:connected,externalAccountId:cardId},
      testCtx(sdk({mode:'test'})));
    expect(r.isError).toBeFalsy();
    expect(parse(r)).toMatchObject({id:cardId,object:'card',
      brand:'Visa',last4:'4242',expMonth:12,expYear:2030});
    expect(r.content[0].text).not.toContain('SENTINEL');
  });
  it('refuses a wrong-mode external account and a foreign one',async()=>{
    const wrong=await handlers.connect_get_external_account(
      {accountId:connected,externalAccountId:bankId},
      await liveCtx(sdk({mode:'live',
        externalOver:bankObj(false)})));
    expect(wrong.isError).toBe(true);
    const foreign=await handlers.connect_get_external_account(
      {accountId:connected,externalAccountId:bankId},
      testCtx(sdk({mode:'test',
        externalOver:bankObj(false,{account:'acct_OTHER99'})})));
    expect(foreign.isError).toBe(true);
  });
});

// --- Persons ---------------------------------------------------------------
describe('CAP-4 Connect person reads',()=>{
  it('lists and gets persons on TEST and LIVE with safe fields only',async()=>{
    for(const mode of ['test','live']){
      const list=await handlers.connect_list_persons(
        {accountId:connected},await ctx(mode,sdk({mode})));
      expect(list.isError).toBeFalsy();
      expect(parse(list).data[0]).toMatchObject({id:person,
        account:connected,verificationStatus:'verified',
        relationship:{owner:true,representative:true},
        requirements:{currentlyDue:['dob.day']}});
      const get=await handlers.connect_get_person(
        {accountId:connected,personId:person},
        await ctx(mode,sdk({mode})));
      expect(get.isError).toBeFalsy();
      expect(parse(get).id).toBe(person);
    }
  });
  it('pins the person field set: no personal data can appear',async()=>{
    const r=await handlers.connect_get_person(
      {accountId:connected,personId:person},testCtx(sdk({mode:'test'})));
    expect(r.isError).toBeFalsy();
    const out=parse(r);
    expect(Object.keys(out).sort()).toEqual(['account','createdAt','id',
      'relationship','requirements','verificationStatus']);
    expect(Object.keys(out.relationship).sort()).toEqual(
      ['director','executive','owner','representative']);
    expect(Object.keys(out.requirements).sort()).toEqual(
      ['currentlyDue','disabledReason','eventuallyDue','pastDue',
        'pendingVerification']);
    const text=r.content[0].text;
    expect(text).not.toContain('SENTINEL');
    expect(text).not.toContain('sentinel-person@example.com');
    expect(text).not.toContain('1990');
    expect(text).not.toContain('percent');
  });
  it('refuses a wrong-mode person in both directions',async()=>{
    const onLive=await handlers.connect_get_person(
      {accountId:connected,personId:person},
      await liveCtx(sdk({mode:'live',personOver:{livemode:false}})));
    expect(onLive.isError).toBe(true);
    const onTest=await handlers.connect_get_person(
      {accountId:connected,personId:person},
      testCtx(sdk({mode:'test',personOver:{livemode:true}})));
    expect(onTest.isError).toBe(true);
  });
  it('refuses a person belonging to a different account',async()=>{
    const s=sdk({mode:'test',personOver:{account:'acct_OTHER99'}});
    const r=await handlers.connect_get_person(
      {accountId:connected,personId:person},testCtx(s));
    expect(r.isError).toBe(true);
  });
});

// --- Actor verification -----------------------------------------------------
describe('CAP-4 Connect actor verification',()=>{
  it('refuses before any connected-account call when the provider account is not the enrolled platform',async()=>{
    const s=sdk({mode:'test'});
    s.accounts.retrieve=vi.fn(async() =>
      ({id:'acct_OTHER99',object:'account',livemode:false}));
    const r=await handlers.connect_get_person(
      {accountId:connected,personId:person},testCtx(s));
    expect(r.isError).toBe(true);
    expect(s.accounts.retrievePerson).not.toHaveBeenCalled();
    expect(s.accounts.listPersons).not.toHaveBeenCalled();
    expect(s.accounts.list).not.toHaveBeenCalled();
  });
  it('refuses when independent mode evidence contradicts the connection',async()=>{
    const s=sdk({mode:'test',platformBalance:true});
    s.accounts.retrieve=vi.fn(async id=>id===undefined?
      {id:platform,object:'account'}:connectedObj(false));
    const r=await handlers.connect_list_accounts({},testCtx(s));
    expect(r.isError).toBe(true);
    expect(s.accounts.list).not.toHaveBeenCalled();
  });
  it('rejects a connection with no usable mode at the shared seam',async()=>{
    const s=sdk({mode:'test'});
    const bad={connection:{stripeAccount:platform,mode:'bogus',
      profile:'full'},services:{stripeForConnection:async()=>s}};
    await expect(handlers.connect_get_account({accountId:connected},bad))
      .rejects.toThrow();
  });
});

// --- Slices 2 and 3 stay exactly as refused --------------------------------
describe('CAP-4 Connect slices 2-3 baseline refusals unchanged',()=>{
  const financial='Financial or unclassified money-moving operation requires an original provider-derived amount and separate owner approval; this is an unimplemented capability, not permanent user policy';
  const gap='Operation needs provider-specific ownership/cost classification and original readback; currently a tracked capability gap, not a permanent end-user restriction';
  const expected={
    PostAccounts:financial,PostAccountsAccount:gap,
    DeleteAccountsAccount:financial,
    PostAccountsAccountCapabilitiesCapability:gap,
    PostAccountsAccountExternalAccounts:financial,
    PostAccountsAccountExternalAccountsId:gap,
    DeleteAccountsAccountExternalAccountsId:financial,
    PostAccountsAccountLoginLinks:financial,
    PostAccountsAccountPersons:financial,
    PostAccountsAccountPersonsPerson:gap,
    DeleteAccountsAccountPersonsPerson:financial,
    PostAccountsAccountReject:gap,PostAccountsAccountUnreject:gap};
  it('the universal door still refuses all 13 pinned write operations with the baseline reasons',()=>{
    for(const [opId,reason] of Object.entries(expected)){
      const record=getOperation(opId);
      expect(preferredNative(record)).toBeNull();
      const policy=classifyUniversalWrite(record,{},{
        metadataOnly:false,
        moneyLike:financialDecision(record,{}).financial});
      expect(policy.allowed).toBe(false);
      expect(policy.reason).toBe(reason);
    }
  });
  it('the door still refuses the person-by-id GET as a sensitive family (the native reader above is the specialized route)',async()=>{
    const rawRequest=vi.fn(async()=>{throw new Error('must not be called');});
    const s={rawRequest};
    const c={connection:{stripeAccount:platform,mode:'test',
      profile:'full'},services:{stripeForConnection:async()=>s}};
    const r=await universal.api_read({op:'GetAccountsAccountPersonsPerson',
      pathParams:{account:connected,person}},c);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('Sensitive universal family');
    expect(rawRequest).not.toHaveBeenCalled();
  });
  it('no native write tool covers any slice 3 operation (slice 2 landed separately)',()=>{
    // Slice 2 (PR after #324) landed the lifecycle writes; the door
    // classification pins above are untouched because D-9 owns the
    // door flip. Slice 3 — account delete, reject, unreject and the
    // v2 close — still has no native write tool.
    const connectWrites=registry.tools.filter(t=>
      t.area==='connect'&&t.writes===true).map(t=>t.name);
    expect(connectWrites).not.toContain('connect_delete_account');
    expect(connectWrites).not.toContain('connect_reject_account');
    expect(connectWrites).not.toContain('connect_unreject_account');
  });
});
