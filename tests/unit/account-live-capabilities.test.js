import {describe,it,expect,vi,afterEach} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {isGuardedLiveWrite,listingForConnection} from '../../src/core/profiles.js';
import {handlers as prefHandlers} from '../../src/tools/account-payment-settings-write.js';
import {handlers as settingHandlers} from '../../src/tools/account-payment-settings.js';
import {handlers as domainHandlers} from '../../src/tools/account-apple-pay-domains.js';
import {handlers as addHandlers} from '../../src/tools/account-apple-pay-domain-add.js';
const acct='acct_LIVEPAY',domain='payments.example.com',cid='pmc_LIVEPAY',did='pmd_LIVEPAY';
const parse=r=>{try{return JSON.parse(r.content[0].text);}catch{return r.content[0].text;}};
const preference=v=>({available:true,display_preference:{preference:v,value:v}});
afterEach(()=>vi.unstubAllEnvs());
function fixture({grant=true,accountEnabled=true,providerMode='live',
  stale=false,managed=false,readProfile=false,duplicate=false}={}){
  vi.stubEnv('VERCEL_ENV','production');
  const db=createFakeDb({accounts:[{id:acct,label:'Synthetic owner LIVE',
    live_enabled:accountEnabled,live_connected:true,money_limit_cents:50000}]});
  const events={reads:0,updates:0,creates:0,lists:0};
  let config={id:cid,object:'payment_method_configuration',active:true,
    livemode:providerMode==='live',parent:managed?'pmc_PARENT':null,
    card:preference('on'),us_bank_account:preference('off'),metadata:{}};
  const domainRecord={id:did,object:'payment_method_domain',domain_name:domain,
    enabled:true,livemode:providerMode==='live',apple_pay:{status:'pending'}};
  const stripe={
    accounts:{retrieve:async()=>({id:acct,object:'account'})},
    balance:{retrieve:async()=>({object:'balance',livemode:providerMode==='live'})},
    paymentMethodConfigurations:{
      list:async()=>({object:'list',has_more:false,data:[config]}),
      retrieve:async()=>{events.reads++;return config;},
      update:async(_id,body,opts)=>{
        expect(opts.idempotencyKey).toMatch(/^rmcp_/);
        events.updates++;
        if(!stale)config={...config,
          us_bank_account:preference(body.us_bank_account.display_preference.preference)};
        return config;
      }
    },
    paymentMethodDomains:{
      list:async()=>{events.lists++;return {object:'list',has_more:false,
        data:(duplicate||events.creates>0)?[domainRecord]:[]};},
      create:async(body,opts)=>{
        expect(opts.idempotencyKey).toMatch(/^rmcp_/);
        expect(body).toEqual({domain_name:domain,enabled:true});
        events.creates++;return domainRecord;},
      retrieve:async()=>domainRecord
    }
  };
  const connection={mode:'live',profile:readProfile?'read_only':'full',
    stripeAccount:acct,listing:'catalog',rtcLiveOwnerApproved:grant,moneyLimitCents:0};
  const ctx={db,connection,connectionId:'live-g5-synthetic',
    liveAccessGranted:grant,services:{stripeForConnection:async c=>{
      expect(c.stripeAccount).toBe(acct);
      expect(c.mode).toBe('live');return stripe;
    }}};
  return {db,events,ctx};
}
describe('G-5c/d authentic owner LIVE nonmoney account operations',()=>{
  it('exposes only the two reviewed account LIVE writes, without enabling unrelated legacy account tools',()=>{
    const f=fixture();
    const listed=listingForConnection(registry,f.ctx.connection).map(t=>t.name);
    for(const name of ['account_update_payment_method_settings','account_add_apple_pay_domain']){
      const tool=registry.tools.find(t=>t.name===name);
      expect(isGuardedLiveWrite(tool,f.ctx.connection)).toBe(true);
      expect(listed).toContain(name);
      expect(isGuardedLiveWrite(tool,{...f.ctx.connection,rtcLiveOwnerApproved:false})).toBe(false);
      expect(isGuardedLiveWrite(tool,{...f.ctx.connection,profile:'read_only'})).toBe(false);
    }
    for(const name of ['account_set_default','account_create_payment_method_configuration']){
      const tool=registry.tools.find(t=>t.name===name);
      if(tool?.writes===true)
        expect(isGuardedLiveWrite(tool,f.ctx.connection)).toBe(false);
    }
    const withheld=listed.filter(n=>n.startsWith('account_')&&
      registry.tools.find(t=>t.name===n)?.writes===true);
    expect(withheld.sort()).toEqual(['account_add_apple_pay_domain',
      'account_update_payment_method_settings']);
  });
  it('lists matched LIVE configuration and domain evidence through authenticated native tools',async()=>{
    const f=fixture({duplicate:true});
    const settings=parse(await settingHandlers.account_list_payment_method_settings({},f.ctx));
    expect(settings.configurations).toMatchObject([{id:cid,managedByConnect:false}]);
    const domains=parse(await domainHandlers.account_list_apple_pay_domains({},f.ctx));
    expect(domains.domains).toMatchObject([{id:did,domain,applePayStatus:'pending',
      applePayReady:false}]);
    const direct=await dispatchReadOnlyTool({registry,
      name:'account_list_apple_pay_domains',args:{},
      connection:f.ctx.connection,db:f.ctx.db,services:f.ctx.services});
    expect(direct.isError).toBeUndefined();
  });
  it('confirms LIVE direct preference only after preview, audit and provider readback',async()=>{
    const f=fixture(),args={configuration:cid,method:'us_bank_account',preference:'on'};
    const preview=parse(await prefHandlers.account_update_payment_method_settings(args,f.ctx));
    expect(preview).toMatchObject({done:false,mode:'LIVE',needsConfirmation:true});
    expect(preview.preview).toContain('LIVE MODE');
    expect(f.events.updates).toBe(0);
    const confirmed=parse(await prefHandlers.account_update_payment_method_settings({
      ...args,confirm:true,requestKey:'live-pref-once'},f.ctx));
    expect(confirmed).toMatchObject({done:true,confirmed:true,mode:'LIVE'});
    expect(f.events.updates).toBe(1);
    expect((await f.db.listAuditForTest()).length).toBeGreaterThan(0);
  });
  it('registers only a new LIVE domain and verifies the exact provider resource',async()=>{
    const f=fixture(),args={domain};
    const preview=parse(await addHandlers.account_add_apple_pay_domain(args,f.ctx));
    expect(preview).toMatchObject({mode:'LIVE',done:false,needsConfirmation:true});
    expect(f.events.creates).toBe(0);
    const done=parse(await addHandlers.account_add_apple_pay_domain({
      ...args,confirm:true,requestKey:'live-domain-once'},f.ctx));
    expect(done).toMatchObject({mode:'LIVE',done:true,confirmed:true});
    expect(done.note).toContain('not guaranteed');
    expect(f.events.creates).toBe(1);
    const dup=fixture({duplicate:true});
    await expect(addHandlers.account_add_apple_pay_domain({
      domain,confirm:true,requestKey:'duplicate-domain'},dup.ctx)).rejects.toThrow();
    expect(dup.events.creates).toBe(0);
  });
  it('fails closed on missing consent, disabled account, mismatched mode and Connect-managed config',async()=>{
    const args={configuration:cid,method:'us_bank_account',preference:'on',
      confirm:true,requestKey:'would-write'};
    const noGrant=fixture({grant:false});
    const denied=parse(await prefHandlers.account_update_payment_method_settings(args,noGrant.ctx));
    expect(denied.done).toBe(false);
    expect(noGrant.events.updates).toBe(0);
    const disabled=fixture({accountEnabled:false});
    expect((await settingHandlers.account_list_payment_method_settings({},disabled.ctx)).isError).toBe(true);
    const disabledAdd=await addHandlers.account_add_apple_pay_domain({
      domain,confirm:true},disabled.ctx);
    expect(disabledAdd.isError).toBe(true);
    expect(parse(disabledAdd).done).toBe(false);
    expect(disabled.events.creates).toBe(0);
    const wrongMode=fixture({providerMode:'test'});
    expect((await domainHandlers.account_list_apple_pay_domains({},wrongMode.ctx)).isError).toBe(true);
    await expect(prefHandlers.account_update_payment_method_settings(args,wrongMode.ctx))
      .rejects.toThrow();
    expect(wrongMode.events.updates).toBe(0);
    const managed=fixture({managed:true});
    await expect(prefHandlers.account_update_payment_method_settings(args,managed.ctx)).rejects.toThrow();
    expect(managed.events.updates).toBe(0);
    const readOnly=fixture({readProfile:true});
    const deniedDispatch=await dispatchReadOnlyTool({registry,
      name:'account_add_apple_pay_domain',args:{domain,confirm:true,requestKey:'unapproved'},
      connection:readOnly.ctx.connection,db:readOnly.ctx.db,services:readOnly.ctx.services});
    expect(deniedDispatch.isError).toBe(true);
    expect(readOnly.events.creates).toBe(0);
  });
  it('unknown provider outcomes never count as verified updates',async()=>{
    const f=fixture({stale:true});
    const result=parse(await prefHandlers.account_update_payment_method_settings({
      configuration:cid,method:'us_bank_account',preference:'on',
      confirm:true,requestKey:'live-unverified'},f.ctx));
    expect(result).toMatchObject({done:false,verified:false});
    expect(f.events.updates).toBe(1);
  });
});
