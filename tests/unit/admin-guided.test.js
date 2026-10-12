import {describe,it,expect,vi} from 'vitest';
import {DASHBOARD_SETTINGS,SETTING_READERS,whereIsSetting} from '../../src/data/dashboard-map.js';
import {handlers,tools} from '../../src/tools/admin-guided.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const acct='acct_GUIDEDTEST',secret='PRIVATE_ACCOUNT_PII';
const parse=x=>JSON.parse(x.content[0].text);
function fixture({due=0,refused=false}={}){
  const sdk={accounts:{retrieve:vi.fn(async()=>{
    if(refused)throw {statusCode:403,code:'permission_denied'};
    return {object:'account',id:acct,livemode:false,charges_enabled:true,
      payouts_enabled:false,details_submitted:true,country:'US',
      requirements:{currently_due:due?['person.'+secret]:[],past_due:[],
        pending_verification:[],current_deadline:1794000000},
      email:secret,address:{line1:secret}};
  })}};
  const ctx={connection:{mode:'test',profile:'read_only',stripeAccount:acct},
    services:{stripeForConnection:async()=>sdk}};
  return {ctx,sdk};
}
describe('G-6a owner guided settings and honest account verification',()=>{
  it('catalog entry is read-only across profiles with no write tools',()=>{
    expect(tools).toHaveLength(2);
    expect(tools.every(x=>x.writes===false)).toBe(true);
    expect(registry.tools.filter(x=>tools.some(y=>x.name===y.name))).toHaveLength(2);
  });
  it('every mapped key has actionable steps and an explicit expected outcome',()=>{
    const names=new Set(registry.tools.map(x=>x.name));
    for(const [key,entry] of Object.entries(DASHBOARD_SETTINGS)){
      expect(entry.steps.length).toBeGreaterThanOrEqual(3);
      expect(entry.steps.every(x=>typeof x==='string'&&x.length>12)).toBe(true);
      const guide=whereIsSetting(key);
      expect(guide).toMatchObject({found:true,changeMade:false});
      expect(guide.url).toMatch(/^https:\/\/dashboard\.stripe\.com\//);
      expect(guide.expected).toContain('Verify');
      if(SETTING_READERS[key])expect(names.has(SETTING_READERS[key])).toBe(true);
    }
    expect(Object.keys(DASHBOARD_SETTINGS)).toContain('account_closure');
    expect(SETTING_READERS.account_closure).toBeUndefined();
  });
  it('lists bounded pages and only safe Dashboard steps; no claim of changes',async()=>{
    const f=fixture(),p=parse(await handlers.admin_list_guided_settings({
      section:'security',detail:'full',limit:2},f.ctx));
    expect(p.settings).toHaveLength(2);
    expect(p.settings.every(x=>x.changeMade===false&&
      x.verification==='not_readable')).toBe(true);
    expect(p.nextOffset).toBe(2);
    expect(JSON.stringify(p)).not.toContain(secret);
    expect(f.sdk.accounts.retrieve).not.toHaveBeenCalled();
    expect((await handlers.admin_list_guided_settings({limit:50},f.ctx)).isError).toBe(true);
  });
  it('checks account verification with fresh observed TEST provider counts only',async()=>{
    const f=fixture({due:1});
    const v=parse(await handlers.admin_check_setting({setting:'account_verification'},f.ctx));
    expect(v).toMatchObject({status:'needs_attention',observed:true,dueCount:1});
    expect(JSON.stringify(v)).not.toContain(secret);
    expect(f.sdk.accounts.retrieve).toHaveBeenCalledTimes(1);
    const ok=parse(await handlers.admin_check_setting({setting:'account_verification'},
      fixture().ctx));
    expect(ok.status).toBe('ok');
  });
  it('Dash-only values and refused APIs are not_readable, not healthy',async()=>{
    const f=fixture();
    const missing=parse(await handlers.admin_check_setting({setting:'two_step_login'},f.ctx));
    expect(missing).toMatchObject({status:'not_readable',observed:false,
      changeMade:false});
    expect(f.sdk.accounts.retrieve).not.toHaveBeenCalled();
    const restricted=parse(await handlers.admin_check_setting({setting:'account_verification'},
      fixture({refused:true}).ctx));
    expect(restricted.status).toBe('not_readable');
    expect(restricted.observed).toBe(false);
  });
  it('LIVE, malformed and indirect read-only gates fail closed',async()=>{
    const f=fixture();
    expect((await handlers.admin_check_setting({setting:'unknown_setting'},f.ctx)).isError)
      .toBe(true);
    expect((await handlers.admin_check_setting({setting:'two_step_login'},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    const response=await dispatchReadOnlyTool({registry,name:'admin_check_setting',
      args:{setting:'account_verification'},connection:f.ctx.connection,services:f.ctx.services,db:{}});
    expect(response.isError).toBeUndefined();
    expect(JSON.stringify(response)).not.toContain(secret);
  });
  it('observes six native TEST settings without asserting intended configuration',async()=>{
    const f=fixture();
    f.sdk.accounts.retrieve=vi.fn(async()=>({
      object:'account',id:acct,livemode:false,country:'US',
      charges_enabled:true,payouts_enabled:false,details_submitted:true,
      requirements:{currently_due:[],past_due:[]},
      settings:{payouts:{schedule:{interval:'daily',delay_days:2}}}}));
    f.sdk.accounts.listExternalAccounts=vi.fn(async()=>({
      object:'list',has_more:false,data:[{object:'bank_account',
        id:'ba_TEST123',account:acct,last4:'1234',
        currency:'usd',country:'US',status:'new',default_for_currency:true}]}));
    f.sdk.paymentMethodConfigurations={list:vi.fn(async()=>({
      object:'list',has_more:false,data:[{
        object:'payment_method_configuration',id:'pmc_TEST123',active:true,
        card:{available:true,display_preference:{preference:'on',value:'on'}}}]}))};
    f.sdk.paymentMethodDomains={list:vi.fn(async()=>({
      object:'list',has_more:false,data:[{
        object:'payment_method_domain',id:'pmd_TEST123',domain_name:'example.org',
        enabled:true,livemode:false,apple_pay:{status:'active'}}]}))};
    f.sdk.webhookEndpoints={list:vi.fn(async()=>({
      object:'list',has_more:false,data:[{
        object:'webhook_endpoint',id:'we_TEST123',status:'enabled',created:1790000000,
        livemode:false,enabled_events:['invoice.paid'],
        url:'https://example.org/SECRET_PRIVATE_WEBHOOK'}]}))};
    f.sdk.billingPortal={configurations:{list:vi.fn(async()=>({
      object:'list',has_more:false,data:[{
        id:'bpc_TEST123',active:true,is_default:true,features:{invoice_history:{enabled:true}},
        default_return_url:'https://example.org/SECRET_PRIVATE_PORTAL'}]}))}};
    for(const setting of ['bank_account','payout_schedule','payment_methods',
      'payment_method_domains','webhook_events','customer_portal']){
      const out=parse(await handlers.admin_check_setting({setting},f.ctx));
      expect(out).toMatchObject({status:'observed',verification:'observed',
        observed:true,complete:true,changeMade:false});
      expect(out).not.toHaveProperty('done');
      expect(out.note).toMatch(/NOT proof/);
      expect(JSON.stringify(out)).not.toContain('SECRET_PRIVATE');
    }
    expect(parse(await handlers.admin_check_setting(
      {setting:'two_step_login'},f.ctx)).status).toBe('not_readable');
    expect(parse(await handlers.admin_check_setting(
      {setting:'restricted_key_creation'},f.ctx)).status).toBe('not_readable');
  });
  it('does not treat an unrelated Stripe account as owner verification',async()=>{
    const f=fixture();
    f.sdk.accounts.retrieve=vi.fn(async()=>({
      object:'account',id:'acct_DIFFERENT',livemode:false,
      charges_enabled:true,payouts_enabled:true,details_submitted:true,
      requirements:{currently_due:[],past_due:[]}
    }));
    const v=parse(await handlers.admin_check_setting({setting:'account_verification'},f.ctx));
    expect(v).toMatchObject({status:'not_readable',observed:false});
  });
  it('covers additional admin Dashboard-only controls without inventing API support',async()=>{
    const f=fixture();
    const settings=['dashboard_timezone','card_decline_rules',
      'payout_negative_balances','invoice_tax_ids','invoice_delivery',
      'reporting_exports','developer_api_version','stripe_tax_settings',
      'payment_link_defaults','team_sso','support_contact'];
    for(const setting of settings){
      const guide=whereIsSetting(setting);
      expect(guide).toMatchObject({found:true,changeMade:false,verifyWith:null});
      expect(guide.steps.length).toBeGreaterThanOrEqual(3);
      expect(guide.url).toBe('https://dashboard.stripe.com/settings');
      const status=parse(await handlers.admin_check_setting({setting},f.ctx));
      expect(status).toMatchObject({status:'not_readable',observed:false,
        complete:false,changeMade:false});
    }
    expect(f.sdk.accounts.retrieve).not.toHaveBeenCalled();
    const catalog=parse(await handlers.admin_list_guided_settings({
      section:'developers',limit:20},f.ctx));
    expect(catalog.settings.some(s=>s.setting==='developer_api_version')).toBe(true);
    expect(catalog.settings.some(s=>s.setting==='webhook_events')).toBe(true);
    expect(JSON.stringify(catalog)).not.toContain(secret);
  });
  it('preserves partial and refused native observations without success claims',async()=>{
    const f=fixture();
    f.sdk.webhookEndpoints={list:vi.fn(async()=>({
      object:'list',has_more:true,data:[{
        object:'webhook_endpoint',id:'we_TEST123',status:'enabled',created:1790000000,
        livemode:false,enabled_events:['invoice.paid'],
        url:'https://example.org/path-secret'}]}))};
    const partial=parse(await handlers.admin_check_setting({setting:'webhook_events'},f.ctx));
    expect(partial).toMatchObject({status:'observed',complete:false,observed:true});
    f.sdk.webhookEndpoints.list=vi.fn(async()=>{throw {statusCode:403,code:'permission_denied'};});
    const denied=parse(await handlers.admin_check_setting({setting:'webhook_events'},f.ctx));
    expect(denied).toMatchObject({status:'not_readable',observed:false,complete:false});
    const restricted=fixture({refused:true});
    const identity=parse(await handlers.admin_check_setting(
      {setting:'payment_methods'},restricted.ctx));
    expect(identity.status).toBe('not_readable');
    expect(restricted.sdk.accounts.retrieve).toHaveBeenCalledTimes(1);
    const malicious=fixture();
    malicious.sdk.accounts.listExternalAccounts=vi.fn(async()=>({
      object:'list',has_more:false,data:[{object:'bank_account',id:'ba_TEST123',
        account:acct,last4:'1234',currency:'usd',country:'US',
        status:'PRIVATE_BANK_ACCOUNT_VALUE'}]}));
    const masked=parse(await handlers.admin_check_setting(
      {setting:'bank_account'},malicious.ctx));
    expect(masked.status).toBe('observed');
    expect(masked.detail.destinations[0].status).toBeNull();
    expect(JSON.stringify(masked)).not.toContain('PRIVATE_BANK_ACCOUNT_VALUE');
  });

});
