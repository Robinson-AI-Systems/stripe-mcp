// P-3: app-aware 21-row readiness with genuine read evidence and individually guarded fixes.
// A workflow cannot invent provider state or bypass the native tool's own confirm/audit.
import {defineWrite,gone} from './write.js';
import {client,allProfiles,fullProfiles,reply,fail} from './billing-shared.js';
import {readVerifiedTestAccount} from '../stripe/test-account.js';
import {validateProfile} from '../apps/profiles.js';
import {webhookSafe} from './webhooks-read.js';
import {safeConfiguration} from './account-payment-settings.js';

const ids=Array.from({length:21},(_,i)=>'S'+(i+1));
const dashboard='https://dashboard.stripe.com/test/';
const acctOk=a=>typeof a==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(a);
const endpointOk=a=>typeof a==='string'&&/^we_[A-Za-z0-9]{2,100}$/.test(a);
const portalOk=a=>typeof a==='string'&&/^bpc_[A-Za-z0-9_]{3,190}$/.test(a);
const payConfigOk=a=>typeof a==='string'&&/^pmc_[A-Za-z0-9]{2,100}$/.test(a);
const choices=['done','missing','not_readable','needs_you','needs_decision','not_applicable'];
const titles=[
  'Account verification and payment capability','Customer-facing payment branding',
  'Public support/contact details','Recognizable card statement descriptor',
  'Stripe receipt-email delivery','Other customer-email policy',
  'After-final-failed-retry subscription policy','Smart Retries scheduling',
  'Card and ACH Checkout payment method availability','Billing Portal cancellation/plan/payment rules',
  'TEST webhook endpoint and required events','LIVE webhook endpoint and signing secret',
  'App restricted-key permissions','Phone card-not-present acceptance',
  'Payout bank account and schedule','Stripe team two-step sign-in',
  'Optional custom payment domain purchase','Customer language/Spanish readiness',
  'Phone-payment dispute readiness','Balance/payout read permissions',
  'TEST versus LIVE data separation and cleanup'
];
const isPlain=o=>o&&typeof o==='object'&&!Array.isArray(o);
function input(a){
  if(!isPlain(a)||Object.keys(a).some(k=>!['app','spec','mode','webhookEndpoint',
    'portalConfiguration','paymentMethodConfiguration'].includes(k))||
    Boolean(a.app)===Boolean(a.spec)||
    (a.mode!==undefined&&!['test','live'].includes(a.mode))||
    (a.app!==undefined&&!/^[a-z][a-z0-9-]{2,63}$/.test(a.app))||
    (a.webhookEndpoint!==undefined&&!endpointOk(a.webhookEndpoint))||
    (a.portalConfiguration!==undefined&&!portalOk(a.portalConfiguration))||
    (a.paymentMethodConfiguration!==undefined&&!payConfigOk(a.paymentMethodConfiguration)))
    throw new TypeError('Select one existing app or inline spec and exact TEST target IDs');
}
const isEvent=e=>typeof e==='string'&&e.length<=100&&
  /^[a-z][a-z0-9_]{1,60}\.[a-z][a-z0-9_.]{1,75}$/.test(e);
function permissionList(value){
  if(value===null||value===undefined)return null;
  if(!isPlain(value)||Object.keys(value).some(k=>!['read','write'].includes(k)))
    throw new TypeError('Explicit restricted-key read/write permission lists required');
  const result={};
  for(const type of ['read','write']){
    const list=value[type]??[];
    if(!Array.isArray(list)||list.length>60||new Set(list).size!==list.length||
      list.some(p=>typeof p!=='string'||p.length>60||
        !/^[a-z][a-z0-9_]{1,59}$/.test(p)))
      throw new TypeError('Invalid restricted-key permission names or duplicates');
    result[type]=[...list];
  }
  return result;
}
function inlineSpec(spec){
  if(!isPlain(spec)||Object.keys(spec).some(k=>![
    'name','webhookEvents','webhookUrl','paymentMethods','portalRules','ownsCatalog',
    'ownsTaxRates','keyPermissions','requiresSpanish','subscriptionBilling'].includes(k))||
    typeof spec.name!=='string'||spec.name.length<1||spec.name.length>100)
    throw new TypeError('Inline project spec must state a name and supported explicit requirements');
  const events=spec.webhookEvents??[];
  if(!Array.isArray(events)||events.length>100||new Set(events).size!==events.length||
    events.some(e=>!isEvent(e)))throw new TypeError('Unknown/duplicate Stripe webhook event');
  if(spec.webhookUrl!==undefined){
    let u;try{u=new URL(spec.webhookUrl);}catch{}
    if(!u||u.protocol!=='https:'||u.username||u.password||u.hash||u.port||
      !u.hostname.includes('.'))throw new TypeError('Safe HTTPS project webhook URL required');
  }
  const methods=spec.paymentMethods??[];
  if(!Array.isArray(methods)||methods.some(m=>!['card','us_bank_account'].includes(m))||
    new Set(methods).size!==methods.length)throw new TypeError('Unsupported payment method requirement');
  const keys=['allow_cancel','allow_plan_switch','allow_payment_method_update',
    'allow_invoice_history'];
  if(spec.portalRules!==undefined&&(!isPlain(spec.portalRules)||
    Object.keys(spec.portalRules).some(k=>!keys.includes(k)||
      typeof spec.portalRules[k]!=='boolean')))
    throw new TypeError('Invalid Portal feature requirement');
  for(const key of ['ownsCatalog','ownsTaxRates','requiresSpanish','subscriptionBilling'])
    if(spec[key]!==undefined&&typeof spec[key]!=='boolean')
      throw new TypeError('Unsupported inline project boolean');
  return {name:spec.name,webhook_events:events,webhook_url:spec.webhookUrl??null,
    payment_methods:methods,
    portal_rules:spec.portalRules??null,owns_catalog:spec.ownsCatalog,
    owns_tax_rates:spec.ownsTaxRates,key_permissions:permissionList(spec.keyPermissions),
    requires_spanish:spec.requiresSpanish,subscription_billing:spec.subscriptionBilling};
}
function declared(profile){
  const p=validateProfile(profile);
  return {name:p.name,webhook_events:p.webhook_events,
    webhook_url:p.webhook_url,
    payment_methods:p.payment_methods,
    portal_rules:p.portal_rules,owns_catalog:p.owns_catalog,
    owns_tax_rates:p.owns_tax_rates,key_permissions:permissionList(p.key_permissions),
    requires_spanish:null,subscription_billing:true};
}
async function source(a,ctx){
  if(a.spec)return {profile:inlineSpec(a.spec),source:'inline_spec',canFix:false};
  if(!ctx.db?.getKnownApp)throw new TypeError('Durable app profile database unavailable');
  const p=await ctx.db.getKnownApp(a.app);
  if(!p||p.status!=='active')throw new TypeError('Active application profile unavailable');
  const bound=p.profile.stripe_accounts.includes(ctx.connection.stripeAccount);
  if(!bound)throw new TypeError('Application profile is not bound to selected TEST account');
  return {profile:declared(p.profile),source:'bound_profile',canFix:true,version:p.version};
}
const row=(id,status,note,extra={})=>{
  if(!ids.includes(id)||!choices.includes(status))
    throw new TypeError('Unsupported readiness state');
  return {id,title:titles[Number(id.slice(1))-1],status,
    note:String(note).slice(0,320),...extra};
};
const dashboardStep=(id,status,note,url,action)=>
  row(id,status,note,{ownerAction:action,settingsUrl:dashboard+url});
async function observed(fn){
  try{return {ok:true,value:await fn()};}
  catch{return {ok:false,value:null};} // No private provider error escapes.
}
export function safePortal(value){
  if(value?.object!=='billing_portal.configuration'||
    !portalOk(value.id)||value.livemode!==false||
    typeof value.active!=='boolean')
    throw new TypeError('Verified TEST Portal configuration unavailable');
  const fields=['payment_method_update','invoice_history',
    'subscription_cancel','subscription_update'];
  const features={};
  for(const key of fields){
    if(typeof value.features?.[key]?.enabled!=='boolean')
      throw new TypeError('Portal features not fully readable');
    features[key]=value.features[key].enabled;
  }
  return {id:value.id,active:value.active,features,
    isDefault:value.is_default===true,
    managedByConnect:Boolean(value.application),verified:true};
}
const portalFields={payment_method_update:'paymentMethodUpdate',
  invoice_history:'invoiceHistory',subscription_cancel:'subscriptionCancel',
  subscription_update:'subscriptionUpdate'};
const mapping={allow_cancel:'subscription_cancel',allow_plan_switch:'subscription_update',
  allow_payment_method_update:'payment_method_update',
  allow_invoice_history:'invoice_history'};
async function readiness(a,ctx){
  input(a);
  const account=ctx?.connection?.stripeAccount;
  if(!acctOk(account)||ctx?.connection?.mode!=='test')
    throw new TypeError('Select an enrolled TEST account');
  const spec=await source(a,ctx),mode=a.mode??'test';
  const rows=[];
  if(mode==='live'){
    for(const id of ids)rows.push(id==='S21'?
      row(id,'done','TEST and LIVE resources are isolated; no data copy is scheduled'):
      dashboardStep(id,'needs_you','LIVE provider state was not queried and cannot be inferred from TEST.',
        'account','Complete separately approved owner LIVE review; production activation stays OFF'));
    return {account,app:spec.profile.name,source:spec.source,mode:'live',
      ready:false,liveProviderQueried:false,rows,counts:count(rows),
      ownerAction:'Separate approved LIVE account and Dashboard acceptance required'};
  }
  const sdk=await client(ctx);
  const accountInfo=await observed(()=>readVerifiedTestAccount(sdk,account));
  if(!accountInfo.ok)throw new TypeError('Independent selected Stripe TEST identity unavailable');
  const info=accountInfo.value;
  const profile=info.business_profile??{};
  const brand=info.settings?.branding??{};
  rows.push(row('S1',info.charges_enabled===true&&info.details_submitted===true?
    'done':'needs_you','TEST account read; verify owner identity and required business details in Dashboard',
    {settingsUrl:dashboard+'account'}));
  rows.push(row('S2','needs_you',
    'Account name, logo, icon, brand color and actual hosted TEST Checkout presentation all require owner verification',
    {settingsUrl:dashboard+'settings/branding',
      ownerAction:'Verify all required assets and inspect an actual TEST hosted Checkout page',
      observed:{businessNamePresent:Boolean(info.business_profile?.name),
        logoPresent:Boolean(brand.logo),iconPresent:Boolean(brand.icon),
        primaryColorPresent:Boolean(brand.primary_color)},
      hostedPageVerified:false}));
  rows.push(dashboardStep('S3',
    profile.support_email&&profile.support_phone?'done':'needs_you',
    'Public customer support email and phone are required','settings/public-details',
    'Review own-account public details'));
  rows.push(dashboardStep('S4',
    typeof info.settings?.payments?.statement_descriptor==='string'&&
    info.settings.payments.statement_descriptor.length>=5?'done':'needs_you',
    'Owner statement descriptor is a Dashboard-controlled own-account setting',
    'settings/public-details','Verify recognizable statement text'));
  rows.push(dashboardStep('S5','needs_you','Receipt-email delivery preference is Dashboard-only',
    'settings/emails','Check customer payment receipt emails'));
  rows.push(dashboardStep('S6','needs_decision','IN-09: Choose which extra Stripe customer emails do not duplicate app notices',
    'settings/emails','Record owner email policy'));
  rows.push(dashboardStep('S7','needs_decision',
    'IN-08: Recommend leave past-due subscription/invoice open after retries because app owns delinquency',
    'settings/billing/automatic','Owner must approve final-failure policy'));
  rows.push(dashboardStep('S8','needs_decision','IN-08: Smart Retries cadence requires owner decision',
    'settings/billing/automatic','Approve retry schedule and compare observed Dashboard settings'));
  // Three native provider operations are independently probed; unsupported
  // restricted-key reads always stay not_readable rather than treated as OFF.
  const methods=spec.profile.payment_methods??[];
  const conf=a.paymentMethodConfiguration&&methods.length?
    await observed(()=>sdk.paymentMethodConfigurations.retrieve(a.paymentMethodConfiguration)):null;
  let paymentConfig=null;
  if(conf?.ok){
    try{paymentConfig=safeConfiguration(conf.value);}catch{paymentConfig=null;}
  }
  const observedMethods=paymentConfig?Object.fromEntries(methods.map(method=>{
    const item=paymentConfig.methods[method];
    return [method,{available:item?.available??false,
      preference:item?.preference??null,effective:item?.effective??null,
      ready:paymentConfig.active&&!paymentConfig.managedByConnect&&
        item?.available===true&&item?.preference==='on'&&item?.effective==='on'}];
  })):{};
  const unresolved=methods.filter(method=>!observedMethods[method]?.ready);
  const repairable=paymentConfig?.active&&!paymentConfig?.managedByConnect?
    unresolved.find(method=>observedMethods[method]?.available===true&&
      observedMethods[method]?.preference!=='on'):null;
  rows.push(!methods.length?row('S9','not_applicable','Project declares no supported card or ACH requirement'):
    !a.paymentMethodConfiguration?dashboardStep('S9','needs_you',
      'Choose exact active own TEST payment configuration for all declared methods',
      'settings/payment_methods','Identify direct payment-method configuration'):
    !paymentConfig?row('S9','not_readable','Direct Stripe payment configuration unavailable'):
    row('S9',unresolved.length?'missing':'done',
      unresolved.length?'One or more required card/ACH methods are not verified available and ON':
        'Every required card/ACH method is available, preferred ON and effective ON; verify Checkout separately',
      {observed:{configuration:paymentConfig.id,methods:observedMethods},
        ...(repairable?{repair:{kind:repairable==='us_bank_account'?'ach':'card',
          nativeTool:'account_update_payment_method_settings',
          args:{configuration:paymentConfig.id,method:repairable,preference:'on'}}}:{})}));
  const targetPortal=a.portalConfiguration?
    await observed(()=>sdk.billingPortal.configurations.retrieve(a.portalConfiguration)):null;
  let portal=null;
  if(targetPortal?.ok){try{portal=safePortal(targetPortal.value);}catch{portal=null;}}
  const rules=spec.profile.portal_rules;
  const features=rules?Object.fromEntries(Object.entries(mapping)
    .filter(([k])=>rules[k]!==undefined)
    .map(([k,v])=>[v,Boolean(rules[k])===true])):null;
  const mismatches=portal&&features?Object.fromEntries(Object.entries(features)
    .filter(([k,value])=>portal.features[k]!==value)):{};
  rows.push(!rules?row('S10','needs_decision','No Portal terms were selected by the project'):
    !a.portalConfiguration?dashboardStep('S10','needs_you',
      'Select exact TEST portal configuration','settings/billing/portal',
      'Identify portal configuration used by the application'):
    !portal?row('S10','not_readable','Portal configuration unavailable'):
    row('S10',Object.keys(mismatches).length?'missing':'done',
      Object.keys(mismatches).length?'Portal controls differ from application ownership policy':
        'Exact provider Portal features match this project',
      {observed:{configuration:portal.id,features:portal.features},
        ...(Object.keys(mismatches).length&&!portal.managedByConnect&&portal.active?
          {repair:{kind:'portal',nativeTool:'portal_update_configuration',
            args:{configId:portal.id,...Object.fromEntries(
              Object.entries(mismatches).map(([k,value])=>[portalFields[k],value]))}}}:{})}));
  const webhook=a.webhookEndpoint?
    await observed(()=>sdk.webhookEndpoints.retrieve(a.webhookEndpoint)):null;
  let hook=null,rawHook=null;
  if(webhook?.ok){
    try{
      rawHook=webhook.value;
      hook=webhookSafe(rawHook,{detail:'full'});
      if(rawHook?.application||rawHook?.connect||rawHook?.livemode!==false)
        throw new TypeError('Unsupported connected or LIVE webhook');
    }catch{hook=null;rawHook=null;}
  }
  const required=spec.profile.webhook_events;
  const missing=hook?required.filter(x=>!rawHook.enabled_events.includes(x)):[];
  const destinationMatches=Boolean(hook&&spec.profile.webhook_url&&
    rawHook.url===spec.profile.webhook_url);
  rows.push(!required.length?row('S11','not_applicable','Project declared no webhook events'):
    !a.webhookEndpoint?dashboardStep('S11','needs_you',
      'Select the existing TEST webhook endpoint used by this application',
      'webhooks','Choose exact endpoint and verify destination privately'):
    !hook?row('S11','not_readable','Selected own TEST webhook endpoint unreadable'):
    !destinationMatches?row('S11','needs_you',
      'Selected endpoint destination has not been verified against the application webhook URL'):
    row('S11',missing.length?'missing':'done',
      missing.length?'Required TEST webhook subscriptions missing':
        'Required event set appears in selected TEST webhook endpoint',
      {observed:{endpoint:hook.id,missingEvents:missing,enabledEventCount:rawHook.enabled_events.length},
        ...(missing.length<=8&&missing.length>0&&
          !rawHook.enabled_events.includes('*')?{
          repair:{kind:'webhook',nativeTool:'webhook_add_events',
            args:{endpointId:hook.id,events:missing}}}:{})}));
  rows.push(dashboardStep('S12','needs_you',
    'Separate LIVE webhook/secret delivery cannot be inferred from TEST','webhooks',
    'After LIVE approval, configure exact seven events and store signing secret privately'));
  rows.push(row('S13','needs_you',
    'Owner must verify the exact declared read/write restricted-key permissions in Stripe Dashboard',
    {settingsUrl:dashboard+'apikeys',
      ownerAction:'Create or inspect app key using exactly these permissions; never share secret bytes in chat',
      requiredPermissions:permissionList(spec.profile.key_permissions),
      permissionVerification:'not_verified'}));
  rows.push(dashboardStep('S14','needs_you','Phone card-not-present acceptance may need Stripe support',
    'account','Confirm phone payment support and separate fraud procedures'));
  rows.push(dashboardStep('S15','needs_you','Payout destination and schedule require private owner verification',
    'payouts','Review bank destination without exposing digits'));
  rows.push(dashboardStep('S16','needs_you','Two-step sign-in and permitted team roles are Dashboard-controlled',
    'team','Require 2FA for owner/team members'));
  rows.push(row('S17','not_applicable',
    'Optional paid custom payment domain is not selected; no purchase attempted'));
  rows.push(row('S18',spec.profile.requires_spanish===true?'needs_you':'not_applicable',
    spec.profile.requires_spanish?'App must verify Spanish locale in its own Checkout and customer settings':
      'No explicit Spanish requirement in selected project profile'));
  rows.push(row('S19','needs_you',
    'Dispute and phone-payment procedures must be reviewed before live card-not-present use'));
  rows.push(row('S20','needs_you',
    'Balance transaction/payout read permission cannot be inferred from a restricted key string'));
  rows.push(row('S21','done',
    'Separate TEST and LIVE datasets; no TEST cleanup/copy to LIVE is necessary'));
  const counts=count(rows);
  return {account,app:spec.profile.name,source:spec.source,profileVersion:spec.version??null,
    mode:'test',ready:rows.every(r=>['done','not_applicable'].includes(r.status)),
    liveProviderQueried:false,providerObserved:true,rows,counts,
    action:'Use workflow_app_readiness_fix for one individually confirmed eligible TEST repair; rerun readiness afterward. Dashboard/owner decisions cannot be auto-fixed.'};
}
function count(rows){
  return Object.fromEntries(choices.map(c=>[c,rows.filter(r=>r.status===c).length]));
}
function verifiedInput(a){
  if(!isPlain(a)||Object.keys(a).some(k=>!['app','target',
    'webhookEndpoint','portalConfiguration','paymentMethodConfiguration',
    'dryRun','confirm','requestKey'].includes(k))||
    !/^[a-z][a-z0-9-]{2,63}$/.test(a.app??'')||
    !['S9','S10','S11'].includes(a.target))
    throw new TypeError('Exact bound app and one actionable readiness row required');
}
function fixWrite(){
  let target=null;
  return defineWrite({
    name:'workflow_app_readiness_fix',
    read:async(a,ctx)=>{
      verifiedInput(a);
      if(ctx?.connection?.profile!=='full')
        throw new TypeError('Owner full profile required for readiness changes');
      const report=await readiness({app:a.app,
        webhookEndpoint:a.webhookEndpoint,portalConfiguration:a.portalConfiguration,
        paymentMethodConfiguration:a.paymentMethodConfiguration},ctx);
      const match=report.rows.find(r=>r.id===a.target);
      if(match?.status!=='missing'||!match.repair)
        throw new TypeError('No verified eligible repair; refresh the exact TEST observation');
      target=match.repair;
      return {id:report.account,metadata:{},row:a.target};
    },
    summarize:(_old,a)=>'TEST MODE: one distinct guarded '+a.target+
      ' readiness repair for '+a.app+' via '+target.nativeTool+
      '. No other project rows, LIVE operations, catalog, money or owner policy decisions change.',
    apply:async(a,ctx)=>{
      // Runtime import avoids a static registry cycle; registry is the canonical
      // existing wrapped tool surface, not a parallel Stripe mutation path.
      const {registry}=await import('./index.js');
      const entry=registry.tools.find(t=>t.name===target.nativeTool);
      if(!entry?.writes||!entry.profiles?.includes(ctx.connection.profile))
        throw new TypeError('Guarded native Stripe repair tool unavailable for this profile');
      const outcome=await registry.handlers[target.nativeTool]({
        ...target.args,confirm:true,requestKey:String(a.requestKey??'')+'-'+a.target},ctx);
      let receipt;
      try{receipt=JSON.parse(outcome.content?.[0]?.text);}catch{}
      if(outcome.isError||receipt?.done!==true||receipt?.confirmed!==true)
        throw new TypeError('Native guarded repair not independently confirmed');
    },
    readAfter:async(a,ctx)=>{
      const report=await readiness({app:a.app,webhookEndpoint:a.webhookEndpoint,
        portalConfiguration:a.portalConfiguration,
        paymentMethodConfiguration:a.paymentMethodConfiguration},ctx);
      return report.rows.find(r=>r.id===a.target);
    },
    verify:(_before,after,a)=>after?.id===a.target&&
      (after.status==='done'||(a.target==='S9'&&
        after.observed?.methods?.[target?.args?.method]?.ready===true))
  });
}
const write=fixWrite();
export const tools=[
  {name:'workflow_app_readiness',area:'projects',writes:false,
    profiles:allProfiles,annotations:{readOnlyHint:true},
    description:'Observe all 21 project setup rows with honest unknown, owner decision and repair plans. Never changes Stripe.',
    inputSchema:{type:'object',properties:{
      app:{type:'string',pattern:'^[a-z][a-z0-9-]{2,63}$'},
      spec:{type:'object'},mode:{type:'string',enum:['test','live']},
      webhookEndpoint:{type:'string',pattern:'^we_[A-Za-z0-9]{2,100}$'},
      portalConfiguration:{type:'string',pattern:'^bpc_[A-Za-z0-9_]{3,190}$'},
      paymentMethodConfiguration:{type:'string',pattern:'^pmc_[A-Za-z0-9]{2,100}$'}},
      additionalProperties:false}},
  {...write.tool,area:'projects',profiles:fullProfiles,
    description:'Individually confirmed TEST repair of one observed P-3 gap through its guarded native tool.',
    inputSchema:{type:'object',properties:{
      app:{type:'string',pattern:'^[a-z][a-z0-9-]{2,63}$'},
      target:{type:'string',enum:['S9','S10','S11']},
      webhookEndpoint:{type:'string',pattern:'^we_[A-Za-z0-9]{2,100}$'},
      portalConfiguration:{type:'string',pattern:'^bpc_[A-Za-z0-9_]{3,190}$'},
      paymentMethodConfiguration:{type:'string',pattern:'^pmc_[A-Za-z0-9]{2,100}$'},
      dryRun:{type:'boolean'},confirm:{type:'boolean'},
      requestKey:{type:'string',minLength:1,maxLength:128}},
      required:['app','target'],additionalProperties:false}}
];
export const handlers={
  async workflow_app_readiness(a,ctx){
    try{return reply(await readiness(a,ctx));}
    catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  },
  workflow_app_readiness_fix:(a,ctx)=>ctx?.connection?.mode==='test'?
    fixWrite().handler(a,ctx):gone('Readiness changes are TEST-only')
};
