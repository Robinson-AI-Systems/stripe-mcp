import {describe,it,expect,vi} from 'vitest';
import {tools,handlers} from '../../src/tools/admin-overview.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const id='acct_OWNEROVERVIEW',pii='PERSONAL_PRIVATE_SENTINEL';
const parse=v=>JSON.parse(v.content[0].text);
function fixture({due=['company.tax_id','representative.verification.document'],
  past=[],refused=false,capRefused=false,unknown=false}={}){
  const sdk={accounts:{
    retrieve:vi.fn(async()=>{
      if(refused)throw {statusCode:403,code:'permission_denied'};
      return {object:'account',id,livemode:false,charges_enabled:true,
        payouts_enabled:false,details_submitted:true,
        requirements:unknown?null:{currently_due:due,past_due:past,
          pending_verification:[],eventually_due:[],current_deadline:1794000000},
        email:pii,tax_id:pii,individual:{first_name:pii}};
    }),
    listCapabilities:vi.fn(async()=>{
      if(capRefused)throw {statusCode:403,code:'permission_denied'};
      return {object:'list',has_more:false,data:[{object:'capability',
        id:'card_payments',status:'active'}]};
    })}};
  const ctx={connection:{mode:'test',stripeAccount:id,profile:'read_only'},
    services:{stripeForConnection:async()=>sdk}};
  return {sdk,ctx};
}
describe('G-6b owner overview and safe requirements',()=>{
  it('registers only TEST reads for all profiles',()=>{
    expect(tools.map(x=>x.name)).toEqual(['admin_list_requirements','stripe_admin_overview']);
    for(const t of tools){
      expect(t.writes).toBe(false);
      expect(t.profiles).toContain('read_only');
      expect(registry.tools.filter(v=>v.name===t.name)).toHaveLength(1);
    }
  });
  it('groups category counts and deadline without exposing requirement paths',async()=>{
    const f=fixture();
    const result=parse(await handlers.admin_list_requirements({},f.ctx));
    expect(result.status).toBe('needs_attention');
    expect(result.totals.currentlyDue).toBe(2);
    expect(result.groups.currentlyDue).toEqual([
      {category:'company',label:'Legal business information',count:1},
      {category:'representative',label:'Business representative verification',count:1}
    ]);
    expect(result.deadlineDenver).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain('tax_id');
    expect(JSON.stringify(result)).not.toContain('verification.document');
    expect(JSON.stringify(result)).not.toContain(pii);
    expect(f.sdk.accounts.retrieve).toHaveBeenCalledTimes(1);
  });
  it('does not confuse unreadable requirements with completed requirements',async()=>{
    expect(parse(await handlers.admin_list_requirements({},
      fixture({due:[],past:[]}).ctx)).status).toBe('ok');
    expect(parse(await handlers.admin_list_requirements({},
      fixture({unknown:true}).ctx)).status).toBe('not_readable');
    const denied=parse(await handlers.admin_list_requirements({},
      fixture({refused:true}).ctx));
    expect(denied).toMatchObject({status:'not_readable',observed:false,totals:null});
  });
  it('overview independently identifies observed and unreadable account sections',async()=>{
    const f=fixture();
    const v=parse(await handlers.stripe_admin_overview({},f.ctx));
    expect(v.sections.account).toMatchObject({status:'needs_attention',observed:true});
    expect(v.sections.capabilities).toMatchObject({status:'observed',observed:true});
    expect(v.sections.teamSecurity).toMatchObject({status:'not_readable',observed:false});
    expect(v.sections.fees.status).toBe('not_readable');
    expect(v.unreadable).toContain('tax');
    expect(v.verificationReadiness).toMatchObject({
      status:'awaiting_owner',dashboardWalkthroughVerified:false,
      needsManualVerification:v.guidedSettings.length,
      totalSettings:v.guidedSettings.length});
    expect(v.ownerWalkthrough.length).toBeGreaterThanOrEqual(12);
    expect(v.ownerWalkthrough.every(x=>x.ownerConfirmed===false&&
      x.requiresDashboardReview===true&&x.dashboardUrl.startsWith(
        'https://dashboard.stripe.com/'))).toBe(true);
    expect(v.ownerWalkthrough.find(x=>x.setting==='account_closure')).toMatchObject({
      status:'not_readable',ownerConfirmed:false});
    expect(v.verificationReadiness.nativeObserved).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(v)).not.toContain(pii);
    expect(f.sdk.accounts.listCapabilities).toHaveBeenCalledTimes(1);
  });
  it('requires own TEST identity before checking native payment and webhook summaries',async()=>{
    const f=fixture({refused:true});
    const result=parse(await handlers.stripe_admin_overview({},f.ctx));
    for(const key of ['capabilities','payoutDestination','webhooks',
      'paymentMethods','paymentDomains','customerPortal'])
      expect(result.sections[key].status).toBe('not_readable');
    expect(f.sdk.accounts.listCapabilities).not.toHaveBeenCalled();
    expect(result.verificationReadiness.dashboardWalkthroughVerified).toBe(false);
    expect(result.ownerWalkthrough.every(x=>x.ownerConfirmed===false)).toBe(true);
    expect(result.ownerWalkthrough.find(x=>x.setting==='webhook_events').status)
      .toBe('not_readable');
  });
  it('refuses absent or nonboolean provider TEST mode before native owner readback',async()=>{
    for(const livemode of [undefined,null,'false']){
      const f=fixture();
      const original=f.sdk.accounts.retrieve;
      f.sdk.accounts.retrieve=vi.fn(async()=>({...await original(),livemode}));
      expect((await handlers.admin_list_requirements({},f.ctx)).isError).toBe(true);
      const result=parse(await handlers.stripe_admin_overview({},f.ctx));
      expect(result.sections.account.status).toBe('not_readable');
      expect(f.sdk.accounts.listCapabilities).not.toHaveBeenCalled();
    }
  });
  it('does not trust an incomplete own-account profile as independent identity',async()=>{
    const f=fixture();
    f.sdk.accounts.retrieve=vi.fn(async()=>({object:'account',id,
      livemode:false,charges_enabled:null,payouts_enabled:true,
      details_submitted:true,requirements:{currently_due:[],past_due:[]}}));
    const out=parse(await handlers.stripe_admin_overview({},f.ctx));
    for(const key of ['account','capabilities','paymentMethods','webhooks'])
      expect(out.sections[key].status).toBe('not_readable');
    expect(f.sdk.accounts.listCapabilities).not.toHaveBeenCalled();
  });
  it('retains truthful partial capability observations rather than calling them absent',async()=>{
    const f=fixture({due:[],past:[]});
    f.sdk.accounts.listCapabilities=vi.fn(async()=>({
      object:'list',has_more:false,
      data:Array.from({length:22},(_,n)=>({
        object:'capability',id:'cap_'+n,status:'active'}))
    }));
    const output=parse(await handlers.stripe_admin_overview({},f.ctx));
    expect(output.sections.capabilities).toMatchObject({
      status:'observed',observed:true,complete:false,hasMore:true});
    expect(output.sections.capabilities.detail.capabilities).toHaveLength(20);
    expect(output.sections.capabilities.detail.totalObserved).toBe(22);
    expect(output.verificationReadiness.nativePartial).toBeGreaterThanOrEqual(1);
    expect(output.verificationReadiness.dashboardWalkthroughVerified).toBe(false);
    expect(output.ownerWalkthrough.every(x=>x.ownerConfirmed===false)).toBe(true);
  });
  it('counts complete and unreadable native section observations separately',async()=>{
    const f=fixture();
    const output=parse(await handlers.stripe_admin_overview({},f.ctx));
    expect(output.verificationReadiness.nativeComplete).toBeGreaterThanOrEqual(0);
    expect(output.verificationReadiness.nativePartial).toBe(0);
    expect(output.verificationReadiness.nativeUnreadable).toBeGreaterThan(0);
    expect(output.verificationReadiness.nativeComplete+
      output.verificationReadiness.nativePartial+
      output.verificationReadiness.nativeUnreadable).toBe(7);
  });
  it('restricted capabilities and account reads never cause a healthy overview',async()=>{
    const v=parse(await handlers.stripe_admin_overview({},
      fixture({refused:true,capRefused:true}).ctx));
    expect(v.sections.account.status).toBe('not_readable');
    expect(v.sections.capabilities.status).toBe('not_readable');
  });
  it('fail closed on LIVE, invalid schema and foreign account',async()=>{
    const f=fixture();
    for(const name of ['admin_list_requirements','stripe_admin_overview']){
      expect((await handlers[name]({unknown:true},f.ctx)).isError).toBe(true);
      expect((await handlers[name]({},{
        ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    }
    const indirect=await dispatchReadOnlyTool({registry,name:'admin_list_requirements',
      args:{},connection:f.ctx.connection,services:f.ctx.services,db:{}});
    expect(indirect.isError).toBeUndefined();
    expect(JSON.stringify(indirect)).not.toContain(pii);
    expect(f.sdk.accounts.retrieve).toHaveBeenCalledTimes(1);
  });
  it('reuses sanitized native readers and reports observed owner sections only',async()=>{
    const f=fixture();
    f.sdk.accounts.listExternalAccounts=vi.fn(async()=>({
      object:'list',has_more:false,data:[{
        object:'bank_account',id:'ba_SAFE1',last4:'1234',
        currency:'usd',country:'US',status:'new',
        default_for_currency:true,account:id}]}));
    f.sdk.accounts.retrieve=vi.fn(async()=>({
      object:'account',id,livemode:false,charges_enabled:true,
      payouts_enabled:true,details_submitted:true,
      requirements:{currently_due:[],past_due:[]},
      settings:{payouts:{schedule:{interval:'daily',delay_days:2}}}}));
    f.sdk.paymentMethodConfigurations={list:vi.fn(async()=>({
      object:'list',has_more:false,data:[{
        object:'payment_method_configuration',id:'pmc_TEST123',
        active:true,card:{available:true,
          display_preference:{preference:'on',value:'on'}}}]}))};
    f.sdk.paymentMethodDomains={list:vi.fn(async()=>({
      object:'list',has_more:false,data:[{
        object:'payment_method_domain',id:'pmd_TEST123',
        domain_name:'example.org',enabled:true,livemode:false,
        apple_pay:{status:'active'}}]}))};
    f.sdk.webhookEndpoints={list:vi.fn(async()=>({
      object:'list',has_more:false,data:[{
        object:'webhook_endpoint',id:'we_TEST123',livemode:false,
        created:1790000000,status:'enabled',enabled_events:['invoice.paid'],
        url:'https://example.org/PRIVATE_PATH'}]}))};
    f.sdk.billingPortal={configurations:{list:vi.fn(async()=>({
      object:'list',has_more:false,data:[{
        id:'bpc_TEST123',active:true,is_default:true,
        default_return_url:'https://example.org/PRIVATE_TOKEN',
        features:{invoice_history:{enabled:true}}}]}))}};
    const v=parse(await handlers.stripe_admin_overview({},f.ctx));
    for(const name of ['payoutDestination','payoutSchedule','paymentMethods',
      'paymentDomains','webhooks','customerPortal']){
      expect(v.sections[name].status).toBe('observed');
      expect(v.sections[name].complete).toBe(true);
    }
    expect(v.sections.tax.status).toBe('not_readable');
    expect(v.guidedSettings.find(x=>x.setting==='account_verification').status).toBe('ok');
    expect(v.guidedSettings.find(x=>x.setting==='two_step_login').status)
      .toBe('not_readable');
    expect(JSON.stringify(v)).not.toContain('PRIVATE_PATH');
    expect(JSON.stringify(v)).not.toContain('PRIVATE_TOKEN');
    expect(JSON.stringify(v)).not.toContain(pii);
  });
  it('preserves unreadable states for absent provider methods and incomplete pages',async()=>{
    const f=fixture();
    const v=parse(await handlers.stripe_admin_overview({},f.ctx));
    expect(v.sections.paymentMethods.status).toBe('not_readable');
    expect(v.sections.customerPortal.status).toBe('not_readable');
    expect(v.guidedSettings).toHaveLength(
      Object.keys((await import('../../src/data/dashboard-map.js')).DASHBOARD_SETTINGS).length);
  });
});
