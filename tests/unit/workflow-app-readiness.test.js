import {describe,it,expect} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {APP_SEED} from '../../src/apps/profiles.js';
import {safePortal} from '../../src/tools/workflow-app-readiness.js';
const account='acct_READINESS1',webhookId='we_READY123',
  portalId='bpc_READY123',pmc='pmc_READY123';
const parse=o=>JSON.parse(o.content[0].text);
function fixture({unreadable=false,wrongWebhookUrl=false,achAvailable=true,
  cardAvailable=true,cardOn=true,fullyBranded=false}={}){
  const db=createFakeDb({accounts:[{id:account,label:'App readiness'}]});
  let ach=false,card=cardOn,events=['checkout.session.completed','invoice.paid',
    'invoice.payment_failed','charge.refunded','customer.subscription.deleted'],
    portalControls={payment_method_update:false,invoice_history:true,
      subscription_cancel:true,subscription_update:true};
  const calls=[];
  const webhook=()=>({id:webhookId,object:'webhook_endpoint',livemode:false,
    created:1710000000,status:'enabled',url:wrongWebhookUrl?
      'https://unrelated.example/webhook':APP_SEED.webhook_url,
    enabled_events:events,description:'Existing TEST app webhook',metadata:{},
    application:null,api_version:'2026-09-30.endive'});
  const portal=()=>({id:portalId,object:'billing_portal.configuration',
    livemode:false,active:true,application:null,created:1710000000,
    metadata:{},features:Object.fromEntries(Object.entries(portalControls)
      .map(([k,v])=>[k,{enabled:v}]))});
  const config=()=>({id:pmc,object:'payment_method_configuration',active:true,
    application:null,parent:null,
    us_bank_account:{available:achAvailable,display_preference:{
      preference:ach?'on':'off',value:ach?'on':'off'}},
    card:{available:cardAvailable,display_preference:{
      preference:card?'on':'off',value:card?'on':'off'}}});
  const stripe={
    accounts:{retrieve:async()=>({id:account,object:'account',livemode:false,
      charges_enabled:false,details_submitted:false,
      business_profile:fullyBranded?{name:'A Business'}:{},
      settings:{branding:fullyBranded?{
        primary_color:'#123456',logo:'file_LOGO123',icon:'file_ICON123'}:{},payments:{}}})},
    paymentMethodConfigurations:{
      retrieve:async()=>{if(unreadable)throw Error('restricted TEST permission');
        return config();},
      update:async(id,values,opts)=>{
        const method=Object.hasOwn(values,'card')?'card':'us_bank_account';
        calls.push({kind:method==='card'?'card':'ach',id,values,opts});
        if(method==='card')card=values.card.display_preference.preference==='on';
        else ach=values.us_bank_account.display_preference.preference==='on';
        return config();
      }
    },
    billingPortal:{configurations:{
      retrieve:async()=>{if(unreadable)throw Error('restricted portal');return portal();},
      update:async(id,values,opts)=>{
        calls.push({kind:'portal',id,values,opts});
        for(const [k,v] of Object.entries(values.features??{}))portalControls[k]=v.enabled;
        return portal();
      }
    }},
    webhookEndpoints:{
      retrieve:async()=>{if(unreadable)throw Error('restricted webhook');return webhook();},
      update:async(id,values,opts)=>{
        calls.push({kind:'webhook',id,values,opts});
        events=values.enabled_events;
        return webhook();
      }
    },
    products:{create:async()=>{throw Error('READINESS MUST NOT CREATE PRODUCTS');}},
    prices:{create:async()=>{throw Error('READINESS MUST NOT CREATE PRICES');}},
    taxRates:{create:async()=>{throw Error('READINESS MUST NOT CREATE TAX RATES');}}
  };
  const connection={stripeAccount:account,mode:'test',profile:'full'};
  const ctx={db,connection,connectionId:'readiness-fixture',
    services:{stripeForConnection:async()=>stripe}};
  const select={app:'appliance-desk',webhookEndpoint:webhookId,
    portalConfiguration:portalId,paymentMethodConfiguration:pmc};
  const call=(name,args={})=>registry.handlers[name](args,ctx);
  return {db,ctx,call,select,calls,stripe};
}
async function bound(f){
  await f.db.bindKnownAppAccount({id:APP_SEED.id,account,
    expectedVersion:1,attach:true});
  await f.db.enableScopedAppGuard({account});
}
describe('P-3 twenty-one independent readiness rows and evidence boundaries',()=>{
  it('requires a selected, bound TEST app, returns exactly S1–S21, and never writes in reads',async()=>{
    const f=fixture();
    const unbound=await f.call('workflow_app_readiness',f.select);
    expect(unbound.isError).toBe(true);
    await bound(f);
    const result=parse(await f.call('workflow_app_readiness',f.select));
    expect(result).toMatchObject({account,app:APP_SEED.name,source:'bound_profile',
      mode:'test',ready:false,liveProviderQueried:false,providerObserved:true});
    expect(result.rows.map(x=>x.id)).toEqual(Array.from({length:21},(_,i)=>'S'+(i+1)));
    expect(result.rows.find(x=>x.id==='S13')).toMatchObject({
      status:'needs_you',permissionVerification:'not_verified',
      requiredPermissions:APP_SEED.key_permissions});
    expect(result.rows.find(x=>x.id==='S6')).toMatchObject({
      status:'needs_decision'});
    expect(result.rows.find(x=>x.id==='S7').note).toContain('past-due');
    expect(result.rows.find(x=>x.id==='S9')).toMatchObject({
      status:'missing',repair:{kind:'ach'}});
    expect(result.rows.find(x=>x.id==='S10')).toMatchObject({
      status:'missing',repair:{kind:'portal'}});
    expect(result.rows.find(x=>x.id==='S11')).toMatchObject({
      status:'missing',repair:{kind:'webhook'}});
    expect(result.rows.find(x=>x.id==='S17')).toMatchObject({
      status:'not_applicable'});
    expect(result.rows.find(x=>x.id==='S21')).toMatchObject({status:'done'});
    expect(f.calls).toHaveLength(0);
    expect(await f.db.listAuditForTest()).toHaveLength(0);
  });
  it('distinguishes unreadable provider state from disabled and keeps LIVE reads disabled',async()=>{
    const f=fixture({unreadable:true});
    await bound(f);
    const report=parse(await f.call('workflow_app_readiness',f.select));
    for(const id of ['S9','S10','S11']){
      const entry=report.rows.find(x=>x.id===id);
      expect(entry.status).toBe('not_readable');
      expect(entry).not.toHaveProperty('repair');
    }
    const live=parse(await f.call('workflow_app_readiness',{...f.select,mode:'live'}));
    expect(live.liveProviderQueried).toBe(false);
    expect(live.rows).toHaveLength(21);
    expect(live.rows.find(x=>x.id==='S11').status).toBe('needs_you');
    expect(f.calls).toHaveLength(0);
  });
  it('does not accept a foreign TEST webhook destination or unavailable ACH as a safe repair',async()=>{
    const f=fixture({wrongWebhookUrl:true,achAvailable:false});await bound(f);
    const report=parse(await f.call('workflow_app_readiness',f.select));
    const hook=report.rows.find(r=>r.id==='S11');
    expect(hook.status).toBe('needs_you');
    expect(hook).not.toHaveProperty('repair');
    const ach=report.rows.find(r=>r.id==='S9');
    expect(ach.status).toBe('missing');
    expect(ach).not.toHaveProperty('repair');
    await expect(f.call('workflow_app_readiness_fix',{
      ...f.select,target:'S11',requestKey:'foreign-webhook',confirm:true}))
      .rejects.toThrow(/No verified eligible repair/);
    expect(f.calls).toHaveLength(0);
  });
  it('never marks account branding complete without actual hosted-page evidence',async()=>{
    const f=fixture({fullyBranded:true});await bound(f);
    const report=parse(await f.call('workflow_app_readiness',f.select));
    expect(report.rows.find(r=>r.id==='S2')).toMatchObject({
      status:'needs_you',hostedPageVerified:false,
      observed:{businessNamePresent:true,logoPresent:true,iconPresent:true,
        primaryColorPresent:true}});
  });
  it('refuses unavailable card and fixes disabled card through one guarded action',async()=>{
    const unavailable=fixture({cardAvailable:false});await bound(unavailable);
    const blocked=parse(await unavailable.call('workflow_app_readiness',unavailable.select));
    expect(blocked.rows.find(r=>r.id==='S9')).toMatchObject({status:'missing'});
    expect(blocked.rows.find(r=>r.id==='S9')).not.toHaveProperty('repair');
    const f=fixture({cardOn:false});await bound(f);
    const initial=parse(await f.call('workflow_app_readiness',f.select));
    expect(initial.rows.find(r=>r.id==='S9').repair).toMatchObject({
      kind:'card',args:{method:'card'}});
    const step=parse(await f.call('workflow_app_readiness_fix',{
      ...f.select,target:'S9',confirm:true,requestKey:'fix-card-first'}));
    expect(step.done).toBe(true);
    expect(f.calls.map(c=>c.kind)).toEqual(['card']);
    const partial=parse(await f.call('workflow_app_readiness',f.select));
    expect(partial.rows.find(r=>r.id==='S9')).toMatchObject({status:'missing',
      repair:{kind:'ach'}});
    const second=parse(await f.call('workflow_app_readiness_fix',{
      ...f.select,target:'S9',confirm:true,requestKey:'fix-ach-second'}));
    expect(second.done).toBe(true);
    expect(f.calls.map(c=>c.kind)).toEqual(['card','ach']);
    expect(parse(await f.call('workflow_app_readiness',f.select))
      .rows.find(r=>r.id==='S9').status).toBe('done');
  });
  it('rejects undeclared or malformed restricted-key permission specs',async()=>{
    const f=fixture();
    const spec={name:'Custom',webhookEvents:[],paymentMethods:['card'],
      keyPermissions:{read:['valid_read','valid_read'],write:[]}};
    expect((await f.call('workflow_app_readiness',{spec})).isError).toBe(true);
    spec.keyPermissions={read:['refunds'],write:['customers']};
    const result=parse(await f.call('workflow_app_readiness',{spec}));
    expect(result.rows.find(r=>r.id==='S13').requiredPermissions)
      .toEqual({read:['refunds'],write:['customers']});
  });
  it('accepts an inline pre-project spec without guessing app ownership or executing repair',async()=>{
    const f=fixture();
    const spec={name:'New Service',webhookEvents:['invoice.paid'],
      paymentMethods:['card'],portalRules:{allow_cancel:false},
      ownsCatalog:true,ownsTaxRates:true};
    const report=parse(await f.call('workflow_app_readiness',{spec}));
    expect(report.source).toBe('inline_spec');
    expect(report.rows).toHaveLength(21);
    expect(report.rows.find(x=>x.id==='S9').status).toBe('needs_you');
    const withConfig=parse(await f.call('workflow_app_readiness',{
      spec,paymentMethodConfiguration:pmc}));
    expect(withConfig.rows.find(x=>x.id==='S9')).toMatchObject({
      status:'done',observed:{methods:{card:{ready:true}}}});
    expect(report.rows.find(x=>x.id==='S10').status).toBe('needs_you');
    expect(f.calls).toHaveLength(0);
    const bad=await f.call('workflow_app_readiness',{
      spec:{...spec,webhookEvents:['not a stripe event']}});
    expect(bad.isError).toBe(true);
    expect(await f.call('workflow_app_readiness',{
      app:'appliance-desk',spec})).toMatchObject({isError:true});
  });
});
describe('P-3 guarded per-row repair through existing native tool contracts',()=>{
  it('previews one row with no provider mutations then confirms exactly one webhook event union',async()=>{
    const f=fixture();await bound(f);
    const args={app:'appliance-desk',target:'S11',
      webhookEndpoint:webhookId,portalConfiguration:portalId,
      paymentMethodConfiguration:pmc,requestKey:'fix-webhook'};
    const preview=parse(await f.call('workflow_app_readiness_fix',{...args,dryRun:true}));
    expect(preview.done).toBe(false);
    expect(f.calls).toHaveLength(0);
    const done=parse(await f.call('workflow_app_readiness_fix',{...args,confirm:true}));
    expect(done.done).toBe(true);
    expect(f.calls.map(c=>c.kind)).toEqual(['webhook']);
    expect(f.calls[0].values.enabled_events).toHaveLength(7);
    expect(f.calls[0].values.enabled_events).toContain('checkout.session.async_payment_failed');
    expect(f.calls[0].values.enabled_events).toContain('checkout.session.async_payment_succeeded');
    const report=parse(await f.call('workflow_app_readiness',f.select));
    expect(report.rows.find(x=>x.id==='S11').status).toBe('done');
    await expect(f.call('workflow_app_readiness_fix',{...args,confirm:true}))
      .rejects.toThrow(/No verified eligible repair/);
  });
  it('corrects forbidden portal cancellation/plan switching then ACH via native guarded readback',async()=>{
    const f=fixture();await bound(f);
    for(const target of ['S10','S9']){
      const result=parse(await f.call('workflow_app_readiness_fix',{
        ...f.select,target,confirm:true,requestKey:'fix-'+target}));
      expect(result.done).toBe(true);
    }
    expect(f.calls.map(c=>c.kind)).toEqual(['portal','ach']);
    expect(f.calls[0].values.features).toEqual({
      payment_method_update:{enabled:true},
      subscription_cancel:{enabled:false},
      subscription_update:{enabled:false}
    });
    expect(f.calls[1].values.us_bank_account.display_preference.preference).toBe('on');
    const report=parse(await f.call('workflow_app_readiness',f.select));
    expect(report.rows.find(x=>x.id==='S9').status).toBe('done');
    expect(report.rows.find(x=>x.id==='S10').status).toBe('done');
    expect(report.rows.find(x=>x.id==='S6').status).toBe('needs_decision');
    expect(f.calls).toHaveLength(2);
  });
  it('refuses wrong account, read-only repair, unavailable eligibility and LIVE writes',async()=>{
    const f=fixture();await bound(f);
    const base={app:'appliance-desk',target:'S10',
      portalConfiguration:portalId,confirm:true,requestKey:'wrong-role'};
    const direct=registry.handlers.workflow_app_readiness_fix;
    expect(await direct(base,{...f.ctx,connection:{...f.ctx.connection,
      profile:'read_only'}})).toMatchObject({isError:true});
    const live=await direct(base,{...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
    expect(live.isError).toBe(true);
    await expect(f.call('workflow_app_readiness_fix',{
      ...base,target:'S12'})).rejects.toThrow(/actionable readiness/);
    expect(f.calls).toHaveLength(0);
  });
  it('validates portal object shape; no permissive fake can pass an incomplete provider state',()=>{
    expect(()=>safePortal({id:portalId,object:'billing_portal.configuration',
      active:true,livemode:false,features:{subscription_cancel:{enabled:false}}}))
      .toThrow(/not fully readable/);
  });
});
