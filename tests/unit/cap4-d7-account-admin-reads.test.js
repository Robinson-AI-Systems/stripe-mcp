// CAP-4 D-7 — account and admin READ tools follow the connection's
// own mode. At baseline the family was TEST-gated in five places (the
// account_get and account_list_capabilities handler gates, the shared
// requireAdminTestAccount gate behind every admin tool, the fees
// projection's categorical LIVE refusal, and the verified-record
// helpers' hardcoded livemode===false), while payload mode fields
// were hardcoded 'test' throughout the admin modules. The conversion
// fits semantics per site to baseline evidence: the account record
// check stays STRICT (baseline always required an explicit livemode),
// parameterized by mode; the fees row check uses DEFAULT
// (optional-mode) semantics because the baseline accepted a TEST row
// with livemode false OR absent and refused only livemode===true, so
// the baseline TEST read set is unchanged and a wrong-mode row now
// refuses with the standard mismatch text in either direction. Every
// refusal/note that names the mode substitutes the connection's mode
// word, so TEST outputs stay byte-identical.
// FLAGGED IN D-7, CONVERTED BY CAP-4 D7b: stripe_check_key_permissions.
// In this build its handler and the reprobe service stayed TEST-only
// because a LIVE probe result could not be persisted without changing
// src/db.js — db.updateKeyPermissions matched only test_key_enc and
// wrote the single shared key_permissions/key_checked_at columns.
// D7b paid that schema cost (per-mode probe records), so the probe
// pins below and the LIVE security-review pin were updated in D7b to
// the per-mode contract (each mode probes its own key; the refusal
// text names both modes; the description names both modes). The
// deeper per-mode persistence and whoami proof lives in
// tests/unit/cap4-d7b-key-probe-per-mode.test.js and
// tests/db/key-reprobe.test.js. Baseline accounting (pristine-baseline
// run, recorded in the D-7 card): 16 of these 30 tests fail at
// baseline — every LIVE happy path, both no-connection gate texts,
// the mode-named unreadable notes, the fees standard-refusal text,
// the guided LIVE pins and the descriptions. Fourteen pass at
// baseline and after, each accounted: the five TEST byte/shape pins
// (account, TEST requirements, TEST overview summary, TEST fee
// sample, TEST security review) and the TEST guided-list mode pin,
// which TEST was already fully serving; the accountSafe no-mode
// contract and the absent-livemode TEST fee row, the very fixture
// shape that forced default semantics in the fees projection; the
// capabilities wrong-mode refusal, outcome-identical at baseline
// (gate refusal before any provider call; verified-reader refusal
// after); and the four probe pins, which in D-7 held the baseline
// contract of the one leg that build deliberately did not convert.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {handlers as accountHandlers,tools as accountTools,accountSafe}
  from '../../src/tools/account-profile.js';
import {handlers as capabilityHandlers,tools as capabilityTools}
  from '../../src/tools/account-capabilities.js';
import {handlers as overviewHandlers,tools as overviewTools}
  from '../../src/tools/admin-overview.js';
import {handlers as feeHandlers,tools as feeTools}
  from '../../src/tools/admin-fees.js';
import {handlers as securityHandlers,tools as securityTools}
  from '../../src/tools/admin-security.js';
import {handlers as guidedHandlers}
  from '../../src/tools/admin-guided.js';
import {handlers as serverHandlers,tools as serverTools}
  from '../../src/tools/server.js';

const acct='acct_D7FAKE';
const parse=r=>JSON.parse(r.content[0].text);
const PII='D7_PII_SENTINEL';
afterEach(()=>vi.unstubAllEnvs());

const accountObj=(livemode,over={})=>({object:'account',id:acct,livemode,
  country:'US',default_currency:'usd',charges_enabled:true,
  payouts_enabled:true,details_submitted:true,
  requirements:{currently_due:['company.tax_id'],past_due:[],
    pending_verification:[],eventually_due:[],current_deadline:1794000000},
  email:PII,...over});
const capsPage=()=>({object:'list',has_more:false,data:[
  {object:'capability',id:'card_payments',status:'active',account:acct}]});
function sdkFor(livemode,{capsThrows=null,accountThrows=null}={}){
  return {
    accounts:{
      retrieve:vi.fn(async()=>{
        if(accountThrows)throw accountThrows;
        return accountObj(livemode);}),
      listCapabilities:vi.fn(async()=>{
        if(capsThrows)throw capsThrows;
        return capsPage();})},
    balance:{retrieve:vi.fn(async()=>({object:'balance',livemode}))},
    webhookEndpoints:{list:vi.fn(async()=>({object:'list',has_more:false,
      data:[{object:'webhook_endpoint',id:'we_D7HOOK',status:'enabled',
        livemode,created:1790000000,enabled_events:['invoice.paid'],
        url:'https://example.com/'+PII}]}))},
    balanceTransactions:{list:vi.fn(async()=>({object:'list',has_more:false,
      data:[]}))}
  };
}
const testCtx=sdk=>({connection:{mode:'test',stripeAccount:acct,profile:'read_only'},
  services:{stripeForConnection:async()=>sdk}});
const liveRow={id:acct,label:'D7 fixture',live_enabled:true,live_connected:true,
  live_key_kind:'restricted',live_key_last4:'9876',
  test_key_kind:'restricted',test_key_last4:'1234',money_limit_cents:50000};
const liveCtx=(sdk,extra={})=>{
  vi.stubEnv('VERCEL_ENV','production');
  return {connection:{mode:'live',stripeAccount:acct,profile:'read_only'},
    db:{getStripeAccount:async()=>({...liveRow}),
      listConnectionsForAccount:async()=>[]},
    services:{stripeForConnection:async()=>sdk},...extra};
};

describe('CAP-4 D-7 account_get',()=>{
  it('serves the TEST projection byte-identically',async()=>{
    const out=parse(await accountHandlers.account_get({},testCtx(sdkFor(false))));
    expect(out).toEqual({id:acct,country:'US',defaultCurrency:'usd',
      chargesEnabled:true,payoutsEnabled:true,detailsSubmitted:true,
      verification:'needs_attention'});
    expect(JSON.stringify(out)).not.toContain(PII);
  });
  it('serves the same projection on a LIVE connection',async()=>{
    const out=parse(await accountHandlers.account_get({},liveCtx(sdkFor(true))));
    expect(out).toEqual({id:acct,country:'US',defaultCurrency:'usd',
      chargesEnabled:true,payoutsEnabled:true,detailsSubmitted:true,
      verification:'needs_attention'});
  });
  it('refuses a wrong-mode provider account in both directions',async()=>{
    const liveOut=await accountHandlers.account_get({},liveCtx(sdkFor(false)));
    expect(liveOut.isError).toBe(true);
    expect(liveOut.content[0].text).toContain('Exact LIVE account identity');
    const testOut=await accountHandlers.account_get({},testCtx(sdkFor(true)));
    expect(testOut.isError).toBe(true);
    expect(testOut.content[0].text).toContain('Non-TEST');
  });
  it('names both modes in the no-connection gate refusal',async()=>{
    const out=await accountHandlers.account_get({},{});
    expect(out.isError).toBe(true);
    expect(out.content[0].text)
      .toBe('Select an authorized TEST or LIVE Stripe account first');
  });
  it('keeps the no-mode projection contract (default TEST semantics)',()=>{
    expect(accountSafe(accountObj(false),acct).verification)
      .toBe('needs_attention');
    expect(()=>accountSafe(accountObj(true),acct))
      .toThrow('Selected TEST Stripe account status unavailable');
  });
});

describe('CAP-4 D-7 account_list_capabilities',()=>{
  it('serves TEST capabilities with the baseline shape',async()=>{
    const out=parse(await capabilityHandlers
      .account_list_capabilities({},testCtx(sdkFor(false))));
    expect(out).toMatchObject({account:acct,available:true,
      capabilities:[{id:'card_payments',status:'active'}],totalObserved:1});
  });
  it('serves LIVE capabilities on a LIVE connection',async()=>{
    const out=parse(await capabilityHandlers
      .account_list_capabilities({},liveCtx(sdkFor(true))));
    expect(out).toMatchObject({account:acct,available:true,
      capabilities:[{id:'card_payments',status:'active'}],totalObserved:1});
  });
  it('refuses when the provider account belongs to the other mode',async()=>{
    const out=await capabilityHandlers
      .account_list_capabilities({},liveCtx(sdkFor(false)));
    expect(out.isError).toBe(true);
  });
  it('marks an unpermitted listing unreadable, naming the connection mode',async()=>{
    const denied={statusCode:403,code:'permission_denied'};
    const t=parse(await capabilityHandlers.account_list_capabilities({},
      testCtx(sdkFor(false,{capsThrows:denied}))));
    expect(t.available).toBe(false);
    expect(t.note).toContain('on this TEST key');
    const l=parse(await capabilityHandlers.account_list_capabilities({},
      liveCtx(sdkFor(true,{capsThrows:denied}))));
    expect(l.available).toBe(false);
    expect(l.note).toContain('on this LIVE key');
  });
  it('names both modes in the no-connection gate refusal',async()=>{
    const out=await capabilityHandlers.account_list_capabilities({},{});
    expect(out.content[0].text)
      .toBe('Select a configured TEST or LIVE account');
  });
});

describe('CAP-4 D-7 admin requirements and overview',()=>{
  it('serves TEST requirements byte-identically',async()=>{
    const out=parse(await overviewHandlers
      .admin_list_requirements({},testCtx(sdkFor(false))));
    expect(out).toMatchObject({account:acct,mode:'test',
      status:'needs_attention',observed:true,
      totals:{currentlyDue:1,pastDue:0,pendingVerification:0,eventuallyDue:0}});
    expect(JSON.stringify(out)).not.toContain('tax_id');
  });
  it('serves LIVE requirements with payload mode live',async()=>{
    const out=parse(await overviewHandlers
      .admin_list_requirements({},liveCtx(sdkFor(true))));
    expect(out).toMatchObject({account:acct,mode:'live',
      status:'needs_attention',observed:true,
      totals:{currentlyDue:1,pastDue:0,pendingVerification:0,eventuallyDue:0}});
  });
  it('reports an unpermitted requirements read in the connection mode',async()=>{
    const denied={statusCode:403,code:'permission_denied'};
    const t=parse(await overviewHandlers.admin_list_requirements({},
      testCtx(sdkFor(false,{accountThrows:denied}))));
    expect(t).toMatchObject({mode:'test',status:'not_readable'});
    expect(t.instructions).toContain('this TEST key');
    const l=parse(await overviewHandlers.admin_list_requirements({},
      liveCtx(sdkFor(true,{accountThrows:denied}))));
    expect(l).toMatchObject({mode:'live',status:'not_readable'});
    expect(l.instructions).toContain('this LIVE key');
  });
  it('serves the TEST overview summary with payload mode test',async()=>{
    const out=parse(await overviewHandlers
      .stripe_admin_overview({detail:'summary'},testCtx(sdkFor(false))));
    expect(out).toMatchObject({account:acct,mode:'test',summaryOnly:true});
    expect(out.sections.account.status).toBe('needs_attention');
    expect(out.sections.capabilities.status).toBe('observed');
  });
  it('serves the LIVE overview in both details with payload mode live',async()=>{
    const summary=parse(await overviewHandlers
      .stripe_admin_overview({detail:'summary'},liveCtx(sdkFor(true))));
    expect(summary).toMatchObject({account:acct,mode:'live',summaryOnly:true});
    expect(summary.sections.account.status).toBe('needs_attention');
    expect(summary.sections.capabilities.status).toBe('observed');
    expect(summary.verificationReadiness.note).toContain('in LIVE mode');
    const full=parse(await overviewHandlers
      .stripe_admin_overview({},liveCtx(sdkFor(true))));
    expect(full.mode).toBe('live');
    expect(full.note).toContain('selected LIVE account');
  });
});

describe('CAP-4 D-7 admin fees',()=>{
  const start=1790000000,end=start+86400;
  const row=(livemode,suffix='A123')=>({object:'balance_transaction',
    id:'txn_'+suffix,created:start+60,currency:'usd',amount:1000,fee:59,
    net:941,reporting_category:'charge',livemode,
    fee_details:[{type:'stripe_fee',amount:59,currency:'usd'}],
    description:PII});
  const feeCtx=(mode,rows)=>{
    const sdk=sdkFor(mode==='live');
    sdk.balanceTransactions.list=vi.fn(async()=>(
      {object:'list',has_more:false,data:rows}));
    return mode==='live'?liveCtx(sdk):testCtx(sdk);
  };
  it('serves the TEST fee sample byte-identically in shape',async()=>{
    const out=parse(await feeHandlers.admin_fees_and_billing(
      {from:start,to:end},feeCtx('test',[row(false)])));
    expect(out).toMatchObject({account:acct,mode:'test',available:true,
      complete:true,transactionsScanned:1,
      sampleTotals:[{currency:'usd',grossMinor:1000,feeMinor:59,
        netMinor:941,transactions:1}]});
    expect(JSON.stringify(out)).not.toContain(PII);
  });
  it('still serves a TEST row whose livemode is absent (baseline set)',async()=>{
    const bare=row(false);delete bare.livemode;
    const out=parse(await feeHandlers.admin_fees_and_billing(
      {from:start,to:end},feeCtx('test',[bare])));
    expect(out.available).toBe(true);
  });
  it('serves LIVE balance fixtures on a LIVE connection',async()=>{
    const out=parse(await feeHandlers.admin_fees_and_billing(
      {from:start,to:end},feeCtx('live',[row(true)])));
    expect(out).toMatchObject({account:acct,mode:'live',available:true,
      complete:true,transactionsScanned:1,
      sampleTotals:[{currency:'usd',grossMinor:1000,feeMinor:59,
        netMinor:941,transactions:1}]});
    expect(out.ownerSteps[1]).toContain('observed LIVE ledger sample');
  });
  it('refuses wrong-mode balance data with the standard refusal',async()=>{
    const live=await feeHandlers.admin_fees_and_billing(
      {from:start,to:end},feeCtx('live',[row(false)]));
    expect(live.isError).toBe(true);
    expect(live.content[0].text).toBe('Stripe provider resource mode mismatch');
    const test=await feeHandlers.admin_fees_and_billing(
      {from:start,to:end},feeCtx('test',[row(true)]));
    expect(test.isError).toBe(true);
    expect(test.content[0].text).toBe('Stripe provider resource mode mismatch');
  });
  it('reports an unpermitted fee read in the connection mode',async()=>{
    const sdk=sdkFor(true,{accountThrows:{statusCode:403,code:'permission_denied'}});
    const out=parse(await feeHandlers.admin_fees_and_billing(
      {from:start,to:end},liveCtx(sdk)));
    expect(out).toMatchObject({account:acct,mode:'live',available:false});
    expect(out.note).toContain('The selected LIVE account');
  });
});

describe('CAP-4 D-7 admin security review',()=>{
  const probeResult=mode=>({account:acct,mode,
    permissions:{customers:'ok'},checkedAt:'2026-11-04T00:00:00.000Z'});
  const secCtx=(mode,sdk)=>{
    const base=mode==='live'?liveCtx(sdk):testCtx(sdk);
    if(mode==='test')base.db={getStripeAccount:async()=>({...liveRow}),
      listConnectionsForAccount:async()=>[]};
    base.services.stripePermissionReprobe=vi.fn(async({mode:m})=>probeResult(m));
    return base;
  };
  it('serves the TEST review with an observed probe section',async()=>{
    const out=parse(await securityHandlers
      .admin_review_security({},secCtx('test',sdkFor(false))));
    expect(out).toMatchObject({account:acct,mode:'test',readOnly:true});
    expect(out.sections.key.keyLast4).toBe('••••1234');
    expect(out.sections.keyPermissions.status).toBe('observed');
    expect(out.sections.keyPermissions.note)
      .toContain('Fresh TEST permission probe ran');
    expect(out.sections.webhooks.note)
      .toContain('Only TEST endpoint metadata');
  });
  it('serves the LIVE review in mode with an observed LIVE probe section',async()=>{
    // CAP-4 D7b converted the flagged probe leg: the LIVE review now
    // invokes the probe for the LIVE key and safeProbe's mode
    // re-validation (mode-aware since D-7) accepts the LIVE result.
    const ctx=secCtx('live',sdkFor(true));
    const out=parse(await securityHandlers.admin_review_security({},ctx));
    expect(out).toMatchObject({account:acct,mode:'live',readOnly:true});
    expect(out.sections.key.keyLast4).toBe('••••9876');
    expect(out.sections.keyPermissions.status).toBe('observed');
    expect(out.sections.keyPermissions.note)
      .toContain('Fresh LIVE permission probe ran');
    expect(ctx.services.stripePermissionReprobe)
      .toHaveBeenCalledWith({account:acct,mode:'live'});
    expect(out.sections.webhooks.note)
      .toContain('Only LIVE endpoint metadata');
    expect(JSON.stringify(out)).not.toContain(PII);
  });
});

describe('CAP-4 D-7 guided settings (coordinator ruling pins)',()=>{
  it('keeps the TEST guided list payload byte-identical in mode',async()=>{
    const out=parse(await guidedHandlers
      .admin_list_guided_settings({},testCtx(sdkFor(false))));
    expect(out).toMatchObject({account:acct,mode:'test'});
  });
  it('reports mode live on a LIVE connection (gate follows the shared helper)',async()=>{
    const out=parse(await guidedHandlers.admin_list_guided_settings({},
      {connection:{mode:'live',stripeAccount:acct,profile:'read_only'}}));
    expect(out).toMatchObject({account:acct,mode:'live'});
  });
  it('names the connection mode in the check-setting identity note',async()=>{
    // No provider services: the independent identity read cannot
    // succeed in either mode, so the refusal note is what answers.
    const t=parse(await guidedHandlers.admin_check_setting(
      {setting:'bank_account'},
      {connection:{mode:'test',stripeAccount:acct,profile:'read_only'}}));
    expect(t.note).toContain('Own-account TEST identity');
    const l=parse(await guidedHandlers.admin_check_setting(
      {setting:'bank_account'},
      {connection:{mode:'live',stripeAccount:acct,profile:'read_only'}}));
    expect(l.note).toContain('Own-account LIVE identity');
  });
});

describe('CAP-4 D-7 key-permission probe (per-mode contract after CAP-4 D7b)',()=>{
  it('probes the enrolled TEST key on a TEST connection',async()=>{
    const probe=vi.fn(async({account:a,mode})=>({account:a,mode,
      permissions:{customers:'ok'},checkedAt:'2026-11-04T00:00:00.000Z'}));
    const out=parse(await serverHandlers.stripe_check_key_permissions({},
      {connection:{mode:'test',stripeAccount:acct},
        services:{stripePermissionReprobe:probe}}));
    expect(probe).toHaveBeenCalledWith({account:acct,mode:'test'});
    expect(out).toEqual({account:acct,mode:'test',
      permissions:{customers:'ok'}});
    const full=parse(await serverHandlers.stripe_check_key_permissions(
      {detail:'full'},
      {connection:{mode:'test',stripeAccount:acct},
        services:{stripePermissionReprobe:probe}}));
    expect(full.source).toBe('Fresh TEST key read-only Stripe probes');
  });
  it('probes the enrolled LIVE key on a LIVE connection',async()=>{
    const probe=vi.fn(async({account:a,mode})=>({account:a,mode,
      permissions:{customers:'ok'},checkedAt:'2026-11-04T00:00:00.000Z'}));
    const out=parse(await serverHandlers.stripe_check_key_permissions({},
      {connection:{mode:'live',stripeAccount:acct},
        services:{stripePermissionReprobe:probe}}));
    expect(probe).toHaveBeenCalledWith({account:acct,mode:'live'});
    expect(out).toEqual({account:acct,mode:'live',
      permissions:{customers:'ok'}});
    const full=parse(await serverHandlers.stripe_check_key_permissions(
      {detail:'full'},
      {connection:{mode:'live',stripeAccount:acct},
        services:{stripePermissionReprobe:probe}}));
    expect(full.source).toBe('Fresh LIVE key read-only Stripe probes');
  });
  it('refuses when no probe service is configured, in either mode',async()=>{
    for(const mode of ['test','live']){
      const out=await serverHandlers.stripe_check_key_permissions({},
        {connection:{mode,stripeAccount:acct},services:{}});
      expect(out.isError).toBe(true);
      expect(out.content[0].text).toBe(
        'Only a configured TEST or LIVE account with server-side key access may be checked');
    }
  });
});

describe('CAP-4 D-7 descriptions',()=>{
  it('names both modes in every converted description',()=>{
    const byName=n=>[...accountTools,...capabilityTools,...overviewTools,
      ...feeTools,...securityTools].find(t=>t.name===n);
    for(const n of ['account_get','account_list_capabilities',
      'admin_list_requirements','stripe_admin_overview',
      'admin_fees_and_billing','admin_review_security']){
      expect(byName(n).description).toContain('TEST or LIVE');
      expect(byName(n).description.length).toBeLessThanOrEqual(160);
    }
  });
  it('names both modes in the probe description converted by CAP-4 D7b',()=>{
    const description=serverTools.find(t=>t.name==='stripe_check_key_permissions')
      .description;
    expect(description)
      .toBe('Recheck TEST or LIVE key read permissions without revealing it.');
    expect(description.length).toBeLessThanOrEqual(160);
  });
});
