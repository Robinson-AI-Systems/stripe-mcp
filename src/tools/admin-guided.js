// G-6a: owner-facing guided settings with no fabricated account state or writes.
import {DASHBOARD_SETTINGS,DASHBOARD_SECTION,whereIsSetting} from '../data/dashboard-map.js';
import {handlers as accountHandlers} from './account-profile.js';
import {reply,fail,allProfiles} from './billing-shared.js';
const categories=['account','payments','billing','security','tax','developers','other'];
const bad=message=>{throw new TypeError(message);};
const idOk=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(x);
function checkCtx(ctx){
  if(ctx?.connection?.mode!=='test'||!idOk(ctx?.connection?.stripeAccount))
    bad('Select a connected TEST Stripe account');
}
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
    description:'Read real TEST account verification when possible; mark other Dashboard-only settings not readable.',
    inputSchema:{type:'object',properties:{
      setting:{type:'string',maxLength:100}},required:['setting'],additionalProperties:false}}
];
export const handlers={
  async admin_list_guided_settings(a,ctx){
    try{
      checkCtx(ctx);validateList(a);
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
      checkCtx(ctx);
      if(!a||typeof a!=='object'||Array.isArray(a)||
        Object.keys(a).some(k=>k!=='setting')||
        typeof a.setting!=='string'||a.setting.length>100)
        bad('Select one supported Dashboard setting');
      const lookup=whereIsSetting(a.setting);
      if(!lookup.found)bad('Unsupported Dashboard setting');
      const guided=asGuide(lookup.setting,'full');
      if(lookup.setting!=='account_verification')
        return reply({...guided,account:ctx.connection.stripeAccount,
          status:'not_readable',observed:false,
          note:'No independent account-specific API state was read. Use the guided steps and matching native reader when available.'});
      const result=await accountHandlers.account_get({detail:'full'},ctx);
      if(result?.isError)return reply({...guided,account:ctx.connection.stripeAccount,
        status:'not_readable',observed:false,
        note:'Account verification read was refused or unavailable.'});
      const value=JSON.parse(result.content[0].text);
      const state=value?.available===false?'not_readable':
        value?.verification==='ok'?'ok':
        value?.verification==='needs_attention'?'needs_attention':'not_readable';
      return reply({...guided,account:ctx.connection.stripeAccount,
        status:state,observed:state!=='not_readable',
        ...(state!=='not_readable'?{dueCount:value.dueCount,
          pastDueCount:value.pastDueCount,deadlineDenver:value.deadlineDenver}:{}),
        note:'Only provider-verified requirement counts were inspected; no business identity or documents were returned.'});
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
