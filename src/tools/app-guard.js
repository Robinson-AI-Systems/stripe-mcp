// P-1/P-2: each active app owns only its configured Stripe accounts.
// Legacy global safety remains until a specifically confirmed scope switch.
import {APP_SEED,resolveAppRecordLink} from '../apps/profiles.js';
export const APP_METADATA_KEYS=Object.freeze([...APP_SEED.metadata_keys]);
export const APP_NAME=APP_SEED.name;
const customerRef=object=>object?.customer??object?.customer_id??object?.customerId;
const completeCustomer=c=>c&&typeof c==='object'&&!Array.isArray(c)&&
  c.deleted!==true&&c.metadata&&typeof c.metadata==='object'&&!Array.isArray(c.metadata);
function markerOf(object,profiles){
  const m=object?.metadata;
  if(!m||typeof m!=='object'||Array.isArray(m))return null;
  const found=[];
  for(const app of profiles){
    const keys=app.profile?.metadata_keys??[];
    const key=keys.find(k=>Object.hasOwn(m,k));
    if(!key)continue;
    const marker={app:app.name,key,value:String(m[key]??''),
      agreementId:typeof m.agreementId==='string'?m.agreementId:null,
      appId:app.id};
    const link=resolveAppRecordLink(app.profile,marker);
    if(link)marker.recordLink=link;
    found.push(marker);
  }
  if(found.length>1)return {unknown:true,reason:
    'Multiple application profiles identify this Stripe record; ownership must be reconciled'};
  return found[0]??null;
}
async function candidateProfiles(ctx){
  const account=ctx?.connection?.stripeAccount;
  if(account&&ctx?.db?.listKnownAppsForAccount){
    try{
      const apps=await ctx.db.listKnownAppsForAccount(account);
      if(!Array.isArray(apps))throw new TypeError('Unknown app registry result');
      const scope=ctx.db.getAppGuardScope?
        await ctx.db.getAppGuardScope(account):'legacy';
      if(!['legacy','scoped'].includes(scope))throw new TypeError('Unknown account scope');
      // The explicit owner activation ends the temporary pre-P legacy behavior.
      if(scope==='scoped')return apps.length?
        {apps}:{unknown:true,reason:'Scoped app guard has no active account bindings'};
      const global={id:APP_SEED.id,name:APP_SEED.name,profile:APP_SEED};
      return {apps:[...apps,...(apps.some(a=>a.id===global.id)?[]:[global])]};
    }catch{return {unknown:true,reason:
      'Application ownership registry unavailable; Stripe change refused'};}
  }
  // Before owner migration, never silently drop existing B-3 protections.
  return {apps:[{id:APP_SEED.id,name:APP_SEED.name,profile:APP_SEED}]};
}
function ownershipOf(object,apps,via,originalId){
  const marker=markerOf(object,apps);
  if(!marker)return null;
  if(marker.unknown)return marker;
  return {...marker,recordId:originalId??object?.id??null,via};
}
/**
 * False ownership must never grant permission to write. Uncertain customer
 * lookup, ambiguous marker or registry error returns an explicit denial.
 */
export async function findAppOwnership(before,ctx={}){
  if(!before||typeof before!=='object'||Array.isArray(before))
    return {unknown:true,reason:'Stripe target could not be read'};
  const selected=await candidateProfiles(ctx);
  if(selected.unknown)return selected;
  const apps=selected.apps;
  const own=ownershipOf(before,apps,'object',before.id??null);
  if(own)return own;
  const customer=customerRef(before);
  if(customer==null)return null;
  if(typeof customer==='object'){
    if(!completeCustomer(customer))
      return {unknown:true,reason:'Expanded customer metadata is missing or deleted'};
    return ownershipOf(customer,apps,'customer',before.id??customer.id??null);
  }
  if(typeof customer!=='string'||!customer.startsWith('cus_'))
    return {unknown:true,reason:'Cannot verify Stripe customer ownership'};
  if(typeof ctx.getCustomer!=='function')
    return {unknown:true,reason:'Customer ownership lookup is unavailable'};
  try{
    const record=await ctx.getCustomer(customer);
    if(!completeCustomer(record))throw Error('Incomplete or deleted customer');
    return ownershipOf(record,apps,'customer',before.id??customer);
  }catch{return {unknown:true,reason:'Customer ownership verification failed'};}
}
export function ownerScreen(marker){
  return marker?.recordLink?.route??
    (['agreementId','rentalLineId','firstDeliveredOn'].includes(marker?.key)
      ? '/desk/agreements':'/desk/billing');
}
export function appOwnedDenial(marker){
  if(marker?.unknown)return marker.reason+'; action refused until ownership is known';
  const label=marker.agreementId?' agreement '+marker.agreementId:'';
  return marker.app+' owns Stripe record '+(marker.recordId??'(unknown ID)')+
    label+'. Changing it outside the application could desynchronize billing. Use '+
    ownerScreen(marker)+' instead, or explicitly set outsideApp: true if appropriate.';
}
export async function protectAppOwnedTarget(args,ctx,before,
  {refundException=false,returnOwnership=false}={}){
  const ownership=await findAppOwnership(before,ctx);
  if(!ownership)return true;
  if(ownership.unknown)return appOwnedDenial(ownership);
  if(refundException)return returnOwnership?
    {allowed:true,ownership}:true; // B-1 owner approval remains mandatory.
  if(args?.outsideApp===true)return true;
  return appOwnedDenial(ownership);
}
export async function annotateAppRead(object,ctx){
  const marker=await findAppOwnership(object,ctx);
  if(!marker||marker.unknown)return object;
  return {...object,appRecord:{
    app:marker.app,appId:marker.appId,
    ...(marker.agreementId?{agreementId:marker.agreementId}:{}),
    recordId:marker.recordId,metadataKey:marker.key,
    ...(marker.recordLink?{recordLink:marker.recordLink}:{})
  }};
}
