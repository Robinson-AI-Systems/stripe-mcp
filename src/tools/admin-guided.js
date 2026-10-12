// G-6a: owner-facing guided settings with no fabricated account state or writes.
import {DASHBOARD_SETTINGS,DASHBOARD_SECTION,whereIsSetting} from '../data/dashboard-map.js';
import {handlers as accountHandlers} from './account-profile.js';
import {handlers as payoutHandlers} from './money-bank-reads.js';
import {handlers as methodHandlers} from './account-payment-settings.js';
import {handlers as domainHandlers} from './account-apple-pay-domains.js';
import {handlers as webhookHandlers} from './webhooks-read.js';
import {handlers as portalHandlers} from './checkout.js';
import {reply,fail,allProfiles} from './billing-shared.js';
import {requireAdminTestAccount,parseAdminReply,verifiedAdminIdentity} from './admin-read-safety.js';
const categories=['account','payments','billing','security','tax','developers','other'];
const bad=message=>{throw new TypeError(message);};
function validateList(a){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!['section','limit','offset','detail'].includes(k))||
    (a.section!==undefined&&!categories.includes(a.section))||
    (a.limit!==undefined&&(!Number.isInteger(a.limit)||a.limit<1||a.limit>20))||
    (a.offset!==undefined&&(!Number.isInteger(a.offset)||a.offset<0||a.offset>200))||
    (a.detail!==undefined&&!['summary','full'].includes(a.detail)))
    bad('Use a supported section, detail and bounded settings page');
}
const asGuide=(key,detail)=>{
  const v=whereIsSetting(key);
  if(!v.found)bad('Unrecognized settings map entry');
  return {setting:key,title:v.title,section:v.section,url:v.url,
    expected:v.expected,verifyWith:v.verifyWith,
    verification:'not_readable',changeMade:false,
    ...(detail==='full'?{steps:DASHBOARD_SETTINGS[key].steps}:{} )};
};

// A reader is independently scoped to the selected TEST account, and only its
// deliberately whitelisted projection may appear in the owner verification.
const NATIVE_SETTING_READS=Object.freeze({
  bank_account:[payoutHandlers.money_list_bank_accounts,{limit:5}],
  payout_schedule:[payoutHandlers.money_get_payout_schedule,{}],
  payment_methods:[methodHandlers.account_list_payment_method_settings,{limit:5}],
  payment_method_domains:[domainHandlers.account_list_apple_pay_domains,{limit:5}],
  webhook_events:[webhookHandlers.webhook_list,{limit:5}],
  customer_portal:[portalHandlers.portal_list_configurations,{limit:5}]
});
async function readNative(setting,ctx){
  const [fn,args]=NATIVE_SETTING_READS[setting]??[];
  if(!fn)return null; // Even a registered key-permission probe cannot verify key creation.
  let value;
  try{value=parseAdminReply(await fn(args,ctx));}
  catch{return null;}
  if(!value)return null;
  const account=ctx.connection.stripeAccount;
  if(setting==='bank_account'&&value.available===true&&
    Array.isArray(value.data)&&value.data.length<=5&&
    typeof value.has_more==='boolean'&&value.data.every(x=>
      /^ba_[A-Za-z0-9]{2,100}$/.test(x.id)&&/^[0-9]{4}$/.test(x.last4)))
    return {complete:!value.has_more,detail:{destinations:value.data.map(x=>({
      id:x.id,last4:x.last4,status:['new','validated','verified','verification_failed','errored'].includes(x.status)?x.status:null}))}};
  if(setting==='payout_schedule'&&value.available===true&&
    value.accountId===account&&['daily','weekly','monthly','manual'].includes(value.interval))
    return {complete:true,detail:{interval:value.interval,
      delayDays:value.delayDays??null,weeklyAnchor:value.weeklyAnchor??null,
      monthlyAnchor:value.monthlyAnchor??null}};
  if(setting==='payment_methods'&&value.available===true&&
    value.account===account&&Array.isArray(value.configurations)&&
    value.configurations.length<=5&&typeof value.hasMore==='boolean'&&
    value.configurations.every(x=>/^pmc_[A-Za-z0-9]{2,100}$/.test(x.id)))
    return {complete:!value.hasMore,detail:{configurations:value.configurations.map(x=>({
      id:x.id,active:x.active,methods:x.methods}))}};
  if(setting==='payment_method_domains'&&value.available===true&&
    value.account===account&&Array.isArray(value.domains)&&value.domains.length<=5&&
    typeof value.hasMore==='boolean'&&value.domains.every(x=>
      /^pmd_[A-Za-z0-9]{2,100}$/.test(x.id)))
    return {complete:!value.hasMore,detail:{domains:value.domains.map(x=>({
      id:x.id,enabled:x.enabled,applePayStatus:x.applePayStatus,
      applePayReady:x.applePayReady}))}};
  if(setting==='webhook_events'&&Array.isArray(value.data)&&
    value.data.length<=5&&typeof value.has_more==='boolean'&&
    value.data.every(x=>/^we_[A-Za-z0-9]{2,100}$/.test(x.id)&&
      ['enabled','disabled'].includes(x.status)))
    return {complete:!value.has_more,detail:{endpoints:value.data.map(x=>({
      id:x.id,status:x.status,enabledEventCount:x.enabledEventCount}))}};
  if(setting==='customer_portal'&&Array.isArray(value.data)&&
    value.data.length<=5&&typeof value.has_more==='boolean'&&
    value.data.every(x=>typeof x.id==='string'&&/^bpc_[A-Za-z0-9_]{3,190}$/.test(x.id)&&
      typeof x.active==='boolean'))
    return {complete:!value.has_more,detail:{configurations:value.data.map(x=>({
      id:x.id,active:x.active,isDefault:x.isDefault,features:x.features}))}};
  return null;
}

export const tools=[
  {name:'admin_list_guided_settings',area:'admin',writes:false,profiles:allProfiles,
    annotations:{readOnlyHint:true},
    description:'List paged owner Dashboard settings with safe steps and real verification tool names, never inferred state.',
    inputSchema:{type:'object',properties:{
      section:{type:'string',enum:categories},
      limit:{type:'integer',minimum:1,maximum:20},
      offset:{type:'integer',minimum:0,maximum:200},
      detail:{type:'string',enum:['summary','full']}},additionalProperties:false}},
  {name:'admin_check_setting',area:'admin',writes:false,profiles:allProfiles,
    annotations:{readOnlyHint:true},
    description:'Observe native TEST setting readers when available; Dashboard-only changes remain unverified and read-only.',
    inputSchema:{type:'object',properties:{
      setting:{type:'string',maxLength:100}},required:['setting'],additionalProperties:false}}
];
export const handlers={
  async admin_list_guided_settings(a,ctx){
    try{
      requireAdminTestAccount(ctx);validateList(a);
      const keys=Object.keys(DASHBOARD_SETTINGS).sort()
        .filter(k=>a.section===undefined||(DASHBOARD_SECTION[k]??'other')===a.section);
      const offset=a.offset??0,limit=Math.min(a.limit??10,a.detail==='full'?5:20);
      return reply({account:ctx.connection.stripeAccount,mode:'test',
        section:a.section??null,settings:keys.slice(offset,offset+limit)
          .map(k=>asGuide(k,a.detail??'summary')),
        total:keys.length,hasMore:keys.length>offset+limit,
        nextOffset:keys.length>offset+limit?offset+limit:null,
        note:'Guides never change Stripe or prove a setting is configured. Only independent API readback may establish observed state.'});
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  },
  async admin_check_setting(a,ctx){
    try{
      requireAdminTestAccount(ctx);
      if(!a||typeof a!=='object'||Array.isArray(a)||
        Object.keys(a).some(k=>k!=='setting')||
        typeof a.setting!=='string'||a.setting.length>100)
        bad('Select one supported Dashboard setting');
      const lookup=whereIsSetting(a.setting);
      if(!lookup.found)bad('Unsupported Dashboard setting');
      const guided=asGuide(lookup.setting,'full');
      if(lookup.setting!=='account_verification'){
        if(!Object.hasOwn(NATIVE_SETTING_READS,lookup.setting))
          return reply({...guided,account:ctx.connection.stripeAccount,
            status:'not_readable',observed:false,complete:false,
            note:'This Dashboard-only setting has no native verification. Follow the owner steps and check it in Stripe.'});
        let identity;
        try{identity=parseAdminReply(await accountHandlers.account_get({},ctx));}
        catch{/* Provider identity access can fail; never infer a successful setting. */}
        if(!verifiedAdminIdentity(identity,ctx.connection.stripeAccount))
          return reply({...guided,account:ctx.connection.stripeAccount,
            status:'not_readable',observed:false,complete:false,
            note:'Own-account TEST identity could not be independently confirmed.'});
        const native=await readNative(lookup.setting,ctx);
        return reply({...guided,account:ctx.connection.stripeAccount,
          status:native?'observed':'not_readable',verification:native?'observed':'not_readable',
          observed:Boolean(native),complete:native?.complete??false,
          ...(native?{detail:native.detail}:{}),
          note:native?
            'Native TEST data was observed, but this is NOT proof the intended owner Dashboard setting is configured or enabled. Compare to the expected result in Stripe.':
            'Native reader was unavailable or refused; no account setting is assumed configured.'});
      }
      const result=await accountHandlers.account_get({detail:'full'},ctx);
      if(result?.isError)return reply({...guided,account:ctx.connection.stripeAccount,
        status:'not_readable',observed:false,
        note:'Account verification read was refused or unavailable.'});
      const value=parseAdminReply(result);
      const state=!verifiedAdminIdentity(value,ctx.connection.stripeAccount)?'not_readable':
        value?.verification==='ok'?'ok':
        value?.verification==='needs_attention'?'needs_attention':'not_readable';
      return reply({...guided,account:ctx.connection.stripeAccount,
        status:state,verification:state,observed:state!=='not_readable',complete:state!=='not_readable',
        ...(state!=='not_readable'?{dueCount:value.dueCount,
          pastDueCount:value.pastDueCount,deadlineDenver:value.deadlineDenver}:{}),
        note:'Only provider-verified requirement counts were inspected; no business identity or documents were returned.'});
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
