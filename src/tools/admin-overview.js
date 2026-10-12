// G-6b: independent TEST owner overview and sanitized verification requirements.
import {client,reply,fail,allProfiles} from './billing-shared.js';
import {handlers as accountHandlers} from './account-profile.js';
import {handlers as capabilityHandlers} from './account-capabilities.js';
import {handlers as payoutHandlers} from './money-bank-reads.js';
import {handlers as methodHandlers} from './account-payment-settings.js';
import {handlers as domainHandlers} from './account-apple-pay-domains.js';
import {handlers as webhookHandlers} from './webhooks-read.js';
import {handlers as portalHandlers} from './checkout.js';
import {DASHBOARD_SETTINGS,whereIsSetting} from '../data/dashboard-map.js';
import {denverLocalTime} from './util.js';
import {requireAdminTestAccount,validateAdminArgs,readAdminTool,verifiedAdminIdentity} from './admin-read-safety.js';

const bad=m=>{throw new TypeError(m);};
const link='https://dashboard.stripe.com/settings';
const categories=Object.freeze({
  business_profile:'Business and public profile details',
  company:'Legal business information',
  individual:'Individual identity information',
  representative:'Business representative verification',
  person:'Associated person verification',
  external_account:'Payout account verification',
  tos_acceptance:'Terms of service acceptance',
  settings:'Payment or account settings',
  capabilities:'Capability eligibility',
  other:'Other account verification requirements'
});
function safeCount(rows){
  if(rows==null)return null;
  if(!Array.isArray(rows)||rows.length>1000||
    rows.some(x=>typeof x!=='string'||x.length>200))bad('Requirements are not safely readable');
  return rows.length;
}
function categoryFor(value){
  const key=value.split('.')[0];
  if(key==='person' || /^person_/.test(key))return 'person';
  return Object.hasOwn(categories,key)?key:'other';
}
function classify(rows){
  if(!Array.isArray(rows))return null;
  const counts={};
  for(const requirement of rows){
    const key=categoryFor(requirement);
    counts[key]=(counts[key]??0)+1;
  }
  return Object.keys(counts).sort().map(key=>({category:key,label:categories[key],count:counts[key]}));
}
function verifiedRequirementRecord(record,id){
  if(record?.object!=='account'||record.id!==id||record.livemode===true)
    bad('Independent TEST account identity verification failed');
  const req=record.requirements;
  const fields=['currently_due','past_due','pending_verification','eventually_due'];
  const sums={};
  for(const f of fields)sums[f]=safeCount(req?.[f]);
  const current=req?.currently_due, past=req?.past_due;
  const status=sums.currently_due===null||sums.past_due===null?'not_readable':
    sums.currently_due+sums.past_due>0?'needs_attention':'ok';
  let deadlineDenver=null;
  if(req?.current_deadline!=null){
    if(!Number.isSafeInteger(req.current_deadline)||req.current_deadline<946684800||
      req.current_deadline>4102444800)bad('Requirement deadline was invalid');
    deadlineDenver=denverLocalTime(req.current_deadline);
  }
  return {account:id,mode:'test',status,observed:status!=='not_readable',
    totals:{currentlyDue:sums.currently_due,pastDue:sums.past_due,
      pendingVerification:sums.pending_verification,eventuallyDue:sums.eventually_due},
    groups:{currentlyDue:classify(current),pastDue:classify(past),
      pendingVerification:classify(req?.pending_verification)},
    deadlineDenver,
    dashboardUrl:link,
    instructions:status==='not_readable'?
      'Open the selected Stripe account in Dashboard and inspect outstanding verification requirements.':
      'Open Dashboard account requirements to see and securely submit the specific requested documents or details.',
    note:'Category counts only. Personal names, requirement paths, identity data and document details are never returned.'};
}
export const tools=[
  {name:'admin_list_requirements',area:'admin',writes:false,profiles:allProfiles,
    annotations:{readOnlyHint:true},
    description:'Read safe TEST verification requirement category counts, due dates and owner Dashboard steps without personal data.',
    inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'stripe_admin_overview',area:'admin',writes:false,profiles:allProfiles,
    annotations:{readOnlyHint:true},
    description:'Summarize TEST owner account health with observed and unreadable sections kept distinct; never modify settings.',
    inputSchema:{type:'object',properties:{},additionalProperties:false}}
];
export const handlers={
  async admin_list_requirements(a,ctx){
    try{
      validateAdminArgs(a);
      const id=requireAdminTestAccount(ctx);
      const sdk=await client(ctx);
      let record;
      try{record=await sdk.accounts.retrieve();}
      catch(e){
        if([403,404].includes(e?.statusCode??e?.status)||
          ['permission_denied','resource_missing'].includes(e?.code))
          return reply({account:id,mode:'test',status:'not_readable',observed:false,
            dashboardUrl:link,groups:null,totals:null,deadlineDenver:null,
            instructions:'Inspect identity and required documents in the selected Stripe Dashboard; this TEST key could not read the requirements.'});
        throw e;
      }
      return reply(verifiedRequirementRecord(record,id));
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  },
  async stripe_admin_overview(a,ctx){
    try{
      validateAdminArgs(a);
      const id=requireAdminTestAccount(ctx);
      const sections={};
      const guide=(setting)=>whereIsSetting(setting).url;
      const acc=await readAdminTool(accountHandlers.account_get,{detail:'full'},ctx);
      const ownAccount=verifiedAdminIdentity(acc,id);
      const accountObserved=ownAccount&&['ok','needs_attention'].includes(acc.verification);
      sections.account={status:accountObserved?acc.verification:'not_readable',
        observed:accountObserved,detail:accountObserved?{
          country:acc.country,defaultCurrency:acc.defaultCurrency,
          chargesEnabled:acc.chargesEnabled,payoutsEnabled:acc.payoutsEnabled,
          detailsSubmitted:acc.detailsSubmitted,dueCount:acc.dueCount,
          pastDueCount:acc.pastDueCount,deadlineDenver:acc.deadlineDenver}:null,
        dashboardUrl:guide('account_verification')};
      // Capability statuses are raw observed facts, not an assertion that every method is enabled.
      const caps=ownAccount?
        await readAdminTool(capabilityHandlers.account_list_capabilities,{limit:20},ctx):null;
      // A bounded first page is evidence, not proof of a full capability
      // inventory. Preserve partial observations instead of erasing them.
      const capObserved=ownAccount&&caps?.account===id&&caps?.available===true&&
        Array.isArray(caps.capabilities)&&caps.capabilities.length<=20&&
        typeof caps.hasMore==='boolean'&&
        Number.isSafeInteger(caps.totalObserved)&&caps.totalObserved>=caps.capabilities.length;
      sections.capabilities={status:capObserved?'observed':'not_readable',
        observed:capObserved,complete:capObserved?!caps.hasMore:false,
        hasMore:capObserved?caps.hasMore:null,
        detail:capObserved?{
          capabilities:caps.capabilities.map(v=>({id:v.id,status:v.status})),
          totalObserved:caps.totalObserved}:null,
        dashboardUrl:guide('payment_methods')};
      const guides={
        payoutDestination:'bank_account',payoutSchedule:'payout_schedule',
        branding:'public_branding',descriptor:'statement_descriptor',
        paymentMethods:'payment_methods',paymentDomains:'payment_method_domains',
        tax:'tax_registrations',webhooks:'webhook_events',
        customerPortal:'customer_portal',teamSecurity:'team_members',
        fees:'stripe_billing_fees'};
      for(const [name,setting] of Object.entries(guides)){
        sections[name]={status:'not_readable',observed:false,detail:null,
          dashboardUrl:guide(setting),verifyWith:whereIsSetting(setting).verifyWith};
      }
      // Reuse the existing registered TEST readers. A reader error is an
      // unobserved section, never an empty successful inventory.
      const read=(fn,args)=>readAdminTool(fn,args,ctx);
      const [banks,schedule,methods,domains,hooks,portal]=ownAccount?await Promise.all([
        read(payoutHandlers.money_list_bank_accounts,{limit:5}),
        read(payoutHandlers.money_get_payout_schedule,{}),
        read(methodHandlers.account_list_payment_method_settings,{limit:5}),
        read(domainHandlers.account_list_apple_pay_domains,{limit:5}),
        read(webhookHandlers.webhook_list,{limit:5}),
        read(portalHandlers.portal_list_configurations,{limit:5})
      ]):[null,null,null,null,null,null];
      const observe=(name,detail,complete)=>{
        sections[name]={...sections[name],status:'observed',observed:true,
          complete,detail};
      };
      if(banks?.available===true&&Array.isArray(banks.data)&&
        banks.data.length<=5&&typeof banks.has_more==='boolean'){
        observe('payoutDestination',{destinations:banks.data.map(v=>({
          id:v.id,last4:v.last4,status:v.status,
          defaultForCurrency:v.defaultForCurrency}))},!banks.has_more);
      }
      if(schedule?.available===true&&schedule.accountId===id&&
        ['daily','weekly','monthly','manual'].includes(schedule.interval))
        observe('payoutSchedule',{interval:schedule.interval,
          delayDays:schedule.delayDays??null},true);
      if(methods?.account===id&&methods.available===true&&
        Array.isArray(methods.configurations)&&methods.configurations.length<=5&&
        typeof methods.hasMore==='boolean')
        observe('paymentMethods',{configurations:methods.configurations.map(v=>({
          id:v.id,active:v.active,methods:v.methods}))},!methods.hasMore);
      if(domains?.account===id&&domains.available===true&&Array.isArray(domains.domains)&&
        domains.domains.length<=5&&typeof domains.hasMore==='boolean')
        observe('paymentDomains',{domains:domains.domains.map(v=>({
          id:v.id,enabled:v.enabled,applePayStatus:v.applePayStatus,
          applePayReady:v.applePayReady}))},!domains.hasMore);
      if(Array.isArray(hooks?.data)&&hooks.data.length<=5&&
        typeof hooks.has_more==='boolean'&&hooks.data.every(v=>
          typeof v.id==='string'&&['enabled','disabled'].includes(v.status)))
        observe('webhooks',{endpoints:hooks.data.map(v=>({
          id:v.id,status:v.status,eventCount:v.enabledEventCount}))},!hooks.has_more);
      if(Array.isArray(portal?.data)&&portal.data.length<=5&&
        typeof portal.has_more==='boolean'&&portal.data.every(v=>
          typeof v.id==='string'&&typeof v.active==='boolean'))
        observe('customerPortal',{configurations:portal.data.map(v=>({
          id:v.id,active:v.active,isDefault:v.isDefault,
          features:v.features}))},!portal.has_more);
      const guidedState={
        account_verification:sections.account.status,
        bank_account:sections.payoutDestination.status,
        payout_schedule:sections.payoutSchedule.status,
        payment_methods:sections.paymentMethods.status,
        payment_method_domains:sections.paymentDomains.status,
        webhook_events:sections.webhooks.status,
        customer_portal:sections.customerPortal.status
      };
      // 'observed' describes a native read, not proof the intended Dashboard
      // configuration is correct or that Stripe has enabled a method.
      const guidedSettings=Object.keys(DASHBOARD_SETTINGS).sort().map(setting=>({
        setting,status:guidedState[setting]??'not_readable',
        verifyWith:whereIsSetting(setting).verifyWith
      }));
      // A provider observation is not the owner's confirmation of Dashboard intent.
      // Offer a bounded checklist covering each high-impact G-6 administration area,
      // without storing a user's answer or fabricating a completed walkthrough.
      const priority=['account_verification','bank_account','payout_schedule',
        'payment_methods','payment_method_domains','webhook_events',
        'customer_portal','two_step_login','team_members','api_keys',
        'receipt_emails','subscription_retries','tax_registrations',
        'account_closure'];
      const ownerWalkthrough=priority.map(setting=>{
        const guide=whereIsSetting(setting);
        return {setting,section:guide.section,status:guidedState[setting]??'not_readable',
          verifyWith:guide.verifyWith,ownerConfirmed:false,
          requiresDashboardReview:true,dashboardUrl:guide.url};
      });
      const verifiedNative=guidedSettings.filter(x=>
        ['ok','needs_attention','observed'].includes(x.status)).length;
      const nativeSections=['capabilities','payoutDestination','payoutSchedule',
        'paymentMethods','paymentDomains','webhooks','customerPortal']
        .map(name=>sections[name]);
      const verificationReadiness={
        status:'awaiting_owner',dashboardWalkthroughVerified:false,
        totalSettings:guidedSettings.length,nativeObserved:verifiedNative,
        nativeComplete:nativeSections.filter(s=>s.observed&&s.complete===true).length,
        nativePartial:nativeSections.filter(s=>s.observed&&s.complete===false).length,
        nativeUnreadable:nativeSections.filter(s=>!s.observed).length,
        needsManualVerification:guidedSettings.length,
        priorityChecks:ownerWalkthrough.length,
        note:'These are review tasks, not proof an owner has inspected Stripe Dashboard. All settings require authenticated owner comparison in TEST mode.'
      };
      return reply({account:id,mode:'test',sections,guidedSettings,
        verificationReadiness,ownerWalkthrough,
        attention:Object.entries(sections).filter(([,v])=>v.status==='needs_attention')
          .map(([k])=>k),
        unreadable:Object.entries(sections).filter(([,v])=>v.status==='not_readable')
          .map(([k])=>k),
        note:'Unobserved is never healthy. Dashboard-only state is not independently verified; account and capability reads are scoped to the selected TEST account. No settings or money were changed.'});
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
