// G-6b: independent TEST owner overview and sanitized verification requirements.
import {client,reply,fail,allProfiles} from './billing-shared.js';
import {handlers as accountHandlers} from './account-profile.js';
import {handlers as capabilityHandlers} from './account-capabilities.js';
import {whereIsSetting} from '../data/dashboard-map.js';
import {denverLocalTime} from './util.js';

const accountOk=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(x);
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
function requireTest(ctx){
  const id=ctx?.connection?.stripeAccount;
  if(ctx?.connection?.mode!=='test'||!accountOk(id))bad('Select a connected TEST Stripe account');
  return id;
}
function validate(a,keys){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!keys.includes(k)))bad('Unsupported owner read arguments');
}
const unpack=v=>{
  if(v?.isError||!Array.isArray(v?.content)||v.content.length!==1)return null;
  try{return JSON.parse(v.content[0].text);}catch{return null;}
};
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
      validate(a,[]);
      const id=requireTest(ctx);
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
      validate(a,[]);
      const id=requireTest(ctx);
      const sections={};
      const guide=(setting)=>whereIsSetting(setting).url;
      const acc=unpack(await accountHandlers.account_get({detail:'full'},ctx));
      const accountObserved=acc?.id===id&&acc?.verification!=='not_readable'&&
        acc?.available!==false&&['ok','needs_attention'].includes(acc?.verification);
      sections.account={status:accountObserved?acc.verification:'not_readable',
        observed:accountObserved,detail:accountObserved?{
          country:acc.country,defaultCurrency:acc.defaultCurrency,
          chargesEnabled:acc.chargesEnabled,payoutsEnabled:acc.payoutsEnabled,
          detailsSubmitted:acc.detailsSubmitted,dueCount:acc.dueCount,
          pastDueCount:acc.pastDueCount,deadlineDenver:acc.deadlineDenver}:null,
        dashboardUrl:guide('account_verification')};
      // Capability statuses are raw observed facts, not an assertion that every method is enabled.
      let caps=null;
      try{caps=unpack(await capabilityHandlers.account_list_capabilities({limit:20},ctx));}
      catch{/* A failed read must never imply healthy capabilities. */}
      const capObserved=caps?.account===id&&caps?.available===true&&
        Array.isArray(caps.capabilities)&&caps.hasMore===false;
      sections.capabilities={status:capObserved?'observed':'not_readable',
        observed:capObserved,detail:capObserved?{
          capabilities:caps.capabilities.map(v=>({id:v.id,status:v.status})),
          totalObserved:caps.totalObserved}:null,
        dashboardUrl:guide('payment_methods')};
      for(const [name,setting] of Object.entries({
        payoutDestination:'bank_account',payoutSchedule:'payout_schedule',
        branding:'public_branding',descriptor:'statement_descriptor',
        paymentMethods:'payment_methods',tax:'tax_registrations',
        webhooks:'webhook_events',customerPortal:'customer_portal',
        teamSecurity:'team_members',fees:'stripe_billing_fees'})){
        sections[name]={status:'not_readable',observed:false,detail:null,
          dashboardUrl:guide(setting),verifyWith:whereIsSetting(setting).verifyWith};
      }
      return reply({account:id,mode:'test',sections,
        attention:Object.entries(sections).filter(([,v])=>v.status==='needs_attention')
          .map(([k])=>k),
        unreadable:Object.entries(sections).filter(([,v])=>v.status==='not_readable')
          .map(([k])=>k),
        note:'Unobserved is never healthy. Dashboard-only state is not independently verified; account and capability reads are scoped to the selected TEST account. No settings or money were changed.'});
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
