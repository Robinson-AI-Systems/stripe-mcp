// P-3: own-account TEST Billing Portal policy controls, never silently change app terms.
import {defineWrite,gone} from './write.js';
import {client,allProfiles,fullProfiles,reply,fail} from './billing-shared.js';
import {readVerifiedTestAccount} from '../stripe/test-account.js';

const idOk=x=>typeof x==='string'&&/^bpc_[A-Za-z0-9_]{3,190}$/.test(x);
const keys=['payment_method_update','invoice_history','subscription_cancel','subscription_update'];
function checked(a,{write=false}={}){
  if(!a||typeof a!=='object'||Array.isArray(a)||!idOk(a.configuration)||
    Object.keys(a).some(k=>!['configuration',...(write?[
      'features','dryRun','confirm','requestKey','outsideApp']:[])].includes(k)))
    throw new TypeError('Exact TEST portal configuration and allowed fields required');
  if(write){
    if(!a.features||typeof a.features!=='object'||Array.isArray(a.features)||
      Object.keys(a.features).length<1||
      Object.keys(a.features).some(k=>!keys.includes(k)||
        typeof a.features[k]!=='boolean'))
      throw new TypeError('Select one or more supported explicit portal feature booleans');
  }
}
export function safePortal(value){
  if(value?.object!=='billing_portal.configuration'||!idOk(value.id)||
    value.livemode===true||typeof value.active!=='boolean')
    throw new TypeError('Verified TEST portal configuration unavailable');
  const features={};
  for(const k of keys){
    const enabled=value.features?.[k]?.enabled;
    if(typeof enabled!=='boolean')throw new TypeError('Portal features not fully readable');
    features[k]=enabled;
  }
  return {id:value.id,active:value.active,features,
    isDefault:value.is_default===true,
    managedByConnect:Boolean(value.application),
    verified:true};
}
async function provider(ctx){
  if(ctx?.connection?.mode!=='test'||!/^acct_[A-Za-z0-9]{2,100}$/.test(
    ctx.connection.stripeAccount??''))
    throw new TypeError('Selected own TEST account required');
  const sdk=await client(ctx);
  await readVerifiedTestAccount(sdk,ctx.connection.stripeAccount);
  return sdk;
}
export const tools=[
  {name:'portal_get_configuration',area:'billing',writes:false,profiles:allProfiles,
    annotations:{readOnlyHint:true},
    description:'Read four exact TEST Portal features; never return private URLs or login tokens.',
    inputSchema:{type:'object',properties:{
      configuration:{type:'string',pattern:'^bpc_[A-Za-z0-9_]{3,190}$'}},
      required:['configuration'],additionalProperties:false}},
  {...makePortalFeaturesWrite().tool,area:'billing',profiles:fullProfiles,
    description:'Guarded TEST portal policy update with exact provider readback and app-ownership denial.',
    inputSchema:{type:'object',properties:{
      configuration:{type:'string',pattern:'^bpc_[A-Za-z0-9_]{3,190}$'},
      features:{type:'object',additionalProperties:false,properties:
        Object.fromEntries(keys.map(k=>[k,{type:'boolean'}]))},
      outsideApp:{type:'boolean'},dryRun:{type:'boolean'},confirm:{type:'boolean'},
      requestKey:{type:'string',minLength:1,maxLength:128}},
      required:['configuration','features'],additionalProperties:false}}
];
async function original(a,ctx){
  checked(a,{write:true});
  const sdk=await provider(ctx);
  const before=await sdk.billingPortal.configurations.retrieve(a.configuration);
  const projected=safePortal(before);
  if(projected.id!==a.configuration||!projected.active||projected.managedByConnect)
    throw new TypeError('Only active own TEST portal configurations may change');
  return before;
}
export function makePortalFeaturesWrite(){
  let baseline=null;
  return defineWrite({
    name:'portal_update_configuration',
    read:async(a,ctx)=>{
      const before=await original(a,ctx);
      baseline=safePortal(before);
      if(keys.every(k=>a.features[k]===undefined||a.features[k]===baseline.features[k]))
        throw new TypeError('All requested Portal features already match; no write necessary');
      return {...before,metadata:before.metadata??{}};
    },
    summarize:(_before,a)=>{
      const changes=Object.keys(a.features).map(k=>k+'='+a.features[k]);
      return 'TEST MODE: update exact Portal '+a.configuration+' controls ['+
        changes.join(', ')+']. App agreements remain app-owned; no LIVE mutation.';
    },
    apply:async(a,ctx,{idempotencyKey})=>{
      const sdk=await provider(ctx);
      const current=safePortal(await sdk.billingPortal.configurations.retrieve(a.configuration));
      if(!current.active||current.managedByConnect||
        JSON.stringify(current.features)!==JSON.stringify(baseline.features))
        throw new TypeError('Portal configuration changed after preview; refresh');
      await sdk.billingPortal.configurations.update(a.configuration,{
        features:Object.fromEntries(Object.entries(a.features).map(([k,enabled])=>
          [k,{enabled}]))},{idempotencyKey});
    },
    readAfter:async(a,ctx)=>{
      const sdk=await provider(ctx);
      return sdk.billingPortal.configurations.retrieve(a.configuration);
    },
    verify:(_before,after,a)=>{
      try{
        const safe=safePortal(after);
        return safe.id===a.configuration&&safe.active&&!safe.managedByConnect&&
          keys.every(k=>safe.features[k]===(a.features[k]??baseline.features[k]));
      }catch{return false;}
    }
  });
}
export const handlers={
  async portal_get_configuration(a,ctx){
    try{
      checked(a);
      const sdk=await provider(ctx),found=await sdk.billingPortal.configurations.retrieve(a.configuration);
      return reply({account:ctx.connection.stripeAccount,configuration:safePortal(found)});
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  },
  portal_update_configuration:(a,ctx)=>ctx?.connection?.mode==='test'?
    makePortalFeaturesWrite().handler(a,ctx):gone('Only TEST portal configuration may change')
};
