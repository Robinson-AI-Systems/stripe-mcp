// CAP-4 D-12 — brand reads and guided tools follow the connection's
// mode. At baseline the family was TEST-only in two modules: the
// guided handlers and template reads rode brand-account.js's TEST-only
// selector/verified reader (the dispatch refused outright with 'TEST
// own-account guidance only'), and brand_get rode brand-kit.js's
// TEST-only verified() gate and read the kit store's TEST partition
// unconditionally. The conversion adopts the either-mode twins V2
// already built for the family's writes (selectedEitherMode,
// modeAccount, verifiedMode) — no new idiom: guidance text is
// mode-templated (the spec steps are written once with the TEST word;
// a LIVE connection receives the same steps naming LIVE, and the
// manual settings URL loses its /test/ segment), the read-back
// verifies against the mode-verified account, template projections
// verify provider mode evidence against the connection mode when a
// template carries it (default semantics — the baseline list fixture
// carries no livemode and was served, so required semantics would
// shrink the baseline TEST read set), and brand_get reads the kit
// revision from the connection's own mode partition. TEST outputs
// stay byte-identical apart from the one named refusal correction:
// the unselected-account guide refusal no longer asserts TEST as a
// requirement ('Own-account guidance requires a selected account').
// ANNEX (D-7 coordinator ruling): the two admin guided tools' gate
// already followed the shared admin helper in D-7; this suite pins
// admin_check_setting's full verification flow (identity + native
// reader observed) in both modes, which D-7's suite did not cover,
// and the descriptions now name the connection mode.
// Baseline accounting (pristine-baseline run, recorded in the D-12
// card): 13 of these 25 tests fail at baseline — the six LIVE guides,
// the read-back test's LIVE legs, the corrected unselected refusal
// text, template list/get on LIVE, the wrong-mode template member
// (baseline served a live-mode template on a TEST connection: the
// projection never verified), the no-livemode template test's LIVE
// leg, brand_get on LIVE and the both-modes descriptions. Twelve
// pass at baseline and after, each accounted: the six TEST guide
// shape pins and the full TEST guide byte-identical pin (TEST was
// already fully served); the TEST template list and brand_get TEST
// partition pins; the brand_get wrong-mode account refusal
// (outcome-identical — the baseline TEST gates refused both
// directions); and the annex observed flow in BOTH modes, whose
// behavioral conversion was D-7's carried gate — the annex's own
// delta in this build is the description/text work, proven by the
// descriptions test that fails at baseline.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {handlers as brandHandlers,tools as brandTools}
  from '../../src/tools/brand-account.js';
import {handlers as kitHandlers,tools as kitTools}
  from '../../src/tools/brand-kit.js';
import {handlers as guidedHandlers,tools as guidedTools}
  from '../../src/tools/admin-guided.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';

const acct='acct_D12FAKE',templateId='inr_D12TPL';
const parse=r=>JSON.parse(r.content[0].text);
afterEach(()=>vi.unstubAllEnvs());

const accountObj=(livemode)=>({id:acct,object:'account',livemode,
  settings:{branding:{primary_color:livemode?'#00aa00':'#aa0000',
      secondary_color:null,logo:'file_LOGO',icon:null},
    card_payments:{decline_on:{avs_failure:true,cvc_failure:false},
      statement_descriptor_prefix:'D12CARD'},
    payments:{statement_descriptor:'D12 DESCRIPTOR'},
    dashboard:{timezone:'America/Denver'}},
  business_profile:{name:'D12 Shop',support_email:'hi@example.test',
    support_phone:null,url:'https://example.test'}});
function sdkFor(livemode,{accountLivemode=livemode,
    templateLivemode=livemode}={}){
  const template={id:templateId,object:'invoice_rendering_template',
    status:'active',nickname:'Main',created:1790000000,
    ...(templateLivemode==='absent'?{}:{livemode:templateLivemode})};
  return {
    accounts:{retrieve:vi.fn(async()=>accountObj(accountLivemode))},
    balance:{retrieve:vi.fn(async()=>({object:'balance',
      livemode:accountLivemode}))},
    invoiceRenderingTemplates:{
      list:vi.fn(async()=>({object:'list',has_more:false,data:[template]})),
      retrieve:vi.fn(async()=>({...template}))}
  };
}
const testCtx=(sdk,extra={})=>({connection:{mode:'test',
    stripeAccount:acct,profile:'full'},
  services:{stripeForConnection:async()=>sdk},...extra});
const liveCtx=(sdk,extra={})=>{
  vi.stubEnv('VERCEL_ENV','production');
  return {connection:{mode:'live',stripeAccount:acct,profile:'full'},
    db:{getStripeAccount:async()=>({id:acct,live_enabled:true,
      live_connected:true})},
    services:{stripeForConnection:async()=>sdk},...extra};
};

const GUIDES=[
  ['brand_set_account_branding',{primaryColor:'#123456'}],
  ['brand_set_statement_descriptor',{descriptor:'D12 DESCRIPTOR'}],
  ['brand_set_public_details',{businessName:'D12 Shop'}],
  ['brand_set_invoice_defaults',{footer:'Thanks for your purchase'}],
  ['setup_set_card_safety',{declineWrongZip:true}],
  ['setup_set_dashboard_timezone',{timezone:'America/Denver'}]
];
describe('CAP-4 D-12 guided tools',()=>{
  it.each(GUIDES)('%s serves TEST guidance byte-identically in shape',
    async(name,args)=>{
      const out=parse(await brandHandlers[name](args,testCtx(sdkFor(false))));
      expect(out).toMatchObject({done:false,account:acct,mode:'test',
        changeMade:false,requiresOwnerAction:true,ownerConfirmed:false,
        manualSettingsUrl:'https://dashboard.stripe.com/test/settings',
        verifyWith:name});
      expect(out.steps.join(' ')).toMatch(/\bTEST\b/);
    });
  it.each(GUIDES)('%s serves LIVE guidance naming LIVE throughout',
    async(name,args)=>{
      const out=parse(await brandHandlers[name](args,liveCtx(sdkFor(true))));
      expect(out).toMatchObject({done:false,account:acct,mode:'live',
        changeMade:false,requiresOwnerAction:true,ownerConfirmed:false,
        manualSettingsUrl:'https://dashboard.stripe.com/settings',
        verifyWith:name});
      expect(out.steps.join(' ')).toMatch(/\bLIVE\b/);
      expect(out.steps.join(' ')).not.toMatch(/\bTEST\b/);
    });
  it('pins the full TEST guide output byte-identically',async()=>{
    const out=parse(await brandHandlers.brand_set_account_branding(
      {primaryColor:'#123456'},testCtx(sdkFor(false))));
    expect(out).toEqual({done:false,account:acct,mode:'test',
      requested:{primaryColor:'#123456'},
      observed:{primaryColor:'#aa0000',secondaryColor:null,
        logoFileId:'file_LOGO',iconFileId:null},
      comparison:'not_confirmed',changeMade:false,
      requiresOwnerAction:true,ownerConfirmed:false,
      manualSettingsUrl:'https://dashboard.stripe.com/test/settings',
      steps:['Open Stripe Dashboard in TEST mode and select Business > Branding.',
        'Review the requested colors and uploaded business images; save manually.',
        'Reopen the exact setting and compare its observed values.'],
      verifyWith:'brand_set_account_branding',
      note:'No own-account API mutation was attempted. Readback is an observation, not proof of who changed it.'});
  });
  it('verifies the read-back against the same-mode account and refuses a wrong-mode one',async()=>{
    const live=parse(await brandHandlers.brand_set_account_branding(
      {primaryColor:'#00aa00'},liveCtx(sdkFor(true))));
    expect(live.observed.primaryColor).toBe('#00aa00');
    expect(live.comparison).toBe('matches_requested_values');
    const wrongLive=await brandHandlers.brand_set_account_branding(
      {primaryColor:'#123456'},liveCtx(sdkFor(true,{accountLivemode:false})));
    expect(wrongLive.isError).toBe(true);
    const wrongTest=await brandHandlers.brand_set_account_branding(
      {primaryColor:'#123456'},testCtx(sdkFor(false,{accountLivemode:true})));
    expect(wrongTest.isError).toBe(true);
  });
  it('refuses an unselected account without asserting TEST as a requirement',async()=>{
    for(const mode of ['test','live']){
      const out=await brandHandlers.brand_set_account_branding(
        {primaryColor:'#123456'},
        {connection:{mode,profile:'full'},services:{}});
      expect(out.isError).toBe(true);
      expect(parse(out)).toMatchObject({done:false,
        error:'Own-account guidance requires a selected account'});
    }
  });
});

describe('CAP-4 D-12 invoice template reads',()=>{
  it('lists templates in TEST byte-identically',async()=>{
    const out=parse(await brandHandlers.brand_list_invoice_templates({},
      testCtx(sdkFor(false))));
    expect(out).toEqual({account:acct,hasMore:false,next:null,data:[{
      id:templateId,status:'active',nickname:'Main',created:1790000000,
      livemode:false}]});
  });
  it('lists and gets templates on a LIVE connection',async()=>{
    const list=parse(await brandHandlers.brand_list_invoice_templates({},
      liveCtx(sdkFor(true))));
    expect(list.data[0]).toMatchObject({id:templateId,livemode:true});
    const get=parse(await brandHandlers.brand_get_invoice_template(
      {templateId},liveCtx(sdkFor(true))));
    expect(get).toEqual({account:acct,template:{id:templateId,
      status:'active',nickname:'Main',created:1790000000,livemode:true}});
  });
  it('refuses a wrong-mode template member in both directions',async()=>{
    const liveList=await brandHandlers.brand_list_invoice_templates({},
      liveCtx(sdkFor(true,{templateLivemode:false})));
    expect(liveList.isError).toBe(true);
    expect(liveList.content[0].text)
      .toContain('Stripe provider resource mode mismatch');
    const testGet=await brandHandlers.brand_get_invoice_template(
      {templateId},testCtx(sdkFor(false,{templateLivemode:true})));
    expect(testGet.isError).toBe(true);
    expect(testGet.content[0].text)
      .toContain('Stripe provider resource mode mismatch');
  });
  it('serves a template carrying no mode evidence in both modes (baseline read set)',async()=>{
    for(const [ctx] of [[testCtx(sdkFor(false,{templateLivemode:'absent'}))],
        [liveCtx(sdkFor(true,{templateLivemode:'absent'}))]]){
      const out=parse(await brandHandlers.brand_get_invoice_template(
        {templateId},ctx));
      expect(out.template).toMatchObject({id:templateId,livemode:null});
    }
  });
});

describe('CAP-4 D-12 brand_get',()=>{
  async function seededDb(){
    const db=createFakeDb({accounts:[{id:acct,label:'D12 fixture'}]});
    await db.saveBrandKit({account:acct,mode:'test',
      settings:{displayName:'TEST kit'},expectedVersion:0});
    await db.saveBrandKit({account:acct,mode:'live',
      settings:{displayName:'LIVE kit'},expectedVersion:0});
    db.getStripeAccount=async()=>({id:acct,live_enabled:true,
      live_connected:true});
    return db;
  }
  it('reads the TEST partition and TEST provider branding',async()=>{
    const db=await seededDb();
    const out=parse(await kitHandlers.brand_get({},
      testCtx(sdkFor(false),{db})));
    expect(out).toMatchObject({account:acct,mode:'test',version:1,
      kit:{displayName:'TEST kit'},
      accountBranding:{primaryColor:'#aa0000',logoPresent:true,
        iconPresent:false},appCreatedPagesAffected:false});
  });
  it('reads the LIVE partition and LIVE provider branding',async()=>{
    const db=await seededDb();
    const out=parse(await kitHandlers.brand_get({},
      liveCtx(sdkFor(true),{db})));
    expect(out).toMatchObject({account:acct,mode:'live',version:1,
      kit:{displayName:'LIVE kit'},
      accountBranding:{primaryColor:'#00aa00',logoPresent:true,
        iconPresent:false},appCreatedPagesAffected:false});
  });
  it('refuses a wrong-mode provider account in both directions',async()=>{
    const db=await seededDb();
    const wrongLive=await kitHandlers.brand_get({},
      liveCtx(sdkFor(true,{accountLivemode:false}),{db}));
    expect(wrongLive.isError).toBe(true);
    const wrongTest=await kitHandlers.brand_get({},
      testCtx(sdkFor(false,{accountLivemode:true}),{db}));
    expect(wrongTest.isError).toBe(true);
  });
});

describe('CAP-4 D-12 annex — admin guided tools (D-7 ruling)',()=>{
  const annexSdk=livemode=>({
    accounts:{retrieve:vi.fn(async()=>({object:'account',id:acct,
      livemode,country:'US',default_currency:'usd',charges_enabled:true,
      payouts_enabled:true,details_submitted:true,
      requirements:{currently_due:['company.tax_id'],past_due:[],
        pending_verification:[],eventually_due:[],
        current_deadline:1794000000}}))},
    balance:{retrieve:vi.fn(async()=>({object:'balance',livemode}))},
    webhookEndpoints:{list:vi.fn(async()=>({object:'list',
      has_more:false,data:[{object:'webhook_endpoint',id:'we_D12HOOK',
        status:'enabled',livemode,created:1790000000,
        enabled_events:['invoice.paid'],
        url:'https://example.com/hook'}]}))}
  });
  const annexCtx=(mode,sdk)=>{
    if(mode==='live')vi.stubEnv('VERCEL_ENV','production');
    return {connection:{mode,stripeAccount:acct,profile:'read_only'},
      ...(mode==='live'?{db:{getStripeAccount:async()=>({id:acct,
        live_enabled:true,live_connected:true})}}:{}),
      services:{stripeForConnection:async()=>sdk}};
  };
  it.each([['test',false],['live',true]])(
    'observes a native reader end-to-end on a %s connection',
    async(mode,live)=>{
      const out=parse(await guidedHandlers.admin_check_setting(
        {setting:'webhook_events'},annexCtx(mode,annexSdk(live))));
      expect(out).toMatchObject({account:acct,status:'observed',
        verification:'observed',observed:true,complete:true});
      expect(out.detail.endpoints).toEqual([{id:'we_D12HOOK',
        status:'enabled',enabledEventCount:1}]);
      expect(out.note).toContain('Native '+mode.toUpperCase()+' data was observed');
    });
});

describe('CAP-4 D-12 descriptions',()=>{
  it('names the connection mode and never TEST only',()=>{
    const wanted=new Map();
    for(const t of [...brandTools,...kitTools,...guidedTools])
      wanted.set(t.name,t.description);
    for(const name of ['brand_get','brand_list_invoice_templates',
        'brand_get_invoice_template','brand_set_account_branding',
        'brand_set_statement_descriptor','brand_set_public_details',
        'brand_set_invoice_defaults','setup_set_card_safety',
        'setup_set_dashboard_timezone','admin_check_setting'])
      expect(wanted.get(name),name).toContain('connection mode');
    expect(wanted.get('admin_list_guided_settings'))
      .not.toMatch(/\bTEST\b/);
    for(const name of ['brand_get','brand_list_invoice_templates',
        'brand_get_invoice_template','admin_check_setting'])
      expect(wanted.get(name),name).not.toMatch(/\bTEST\b/);
  });
});
