// P-1/P-2: each active app owns only its configured Stripe accounts.
// Legacy global safety remains until a specifically confirmed scope switch.
import {createHash} from 'node:crypto';
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
const canonicalValue=value=>{
  if(Array.isArray(value))return value.map(canonicalValue);
  if(value&&typeof value==='object'){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=canonicalValue(value[key]);
    return out;
  }
  return value===undefined?null:value;
};
// Confirmation artifacts are not part of the previewed change: the card's
// five exclusions, plus the core write lifecycle's own previewFingerprint
// (PR #304, which postdates the V3 card's baseline) — a confirm that
// presents both fingerprints must not change the change it confirms.
const OVERRIDE_CHANGE_EXCLUDED=new Set(['dryRun','confirm','requestKey',
  'outsideApp','outsideAppFingerprint','previewFingerprint']);
/** Fingerprint of the exact app-ownership state the owner was shown for a
 * catalog outside-app override (owner-obedience V3). Mirrors
 * liveEnableFingerprint's construction: canonical JSON state, SHA-256,
 * 20 uppercase hex chars grouped by 5. The digest covers only identifiers
 * the refusal text already discloses (owning app, record ID, marker
 * key/value, agreement ID) plus the previewed change's mutable arguments;
 * it contains no secret. Any change to the account, mode, tool, target,
 * marker state or previewed change changes the fingerprint and voids a
 * confirmation given against the old state. */
export function appOverrideFingerprint({account,mode,tool,targetId,
  ownership,change}={}){
  const args={};
  if(change&&typeof change==='object'&&!Array.isArray(change)){
    for(const [k,v] of Object.entries(change))
      if(!OVERRIDE_CHANGE_EXCLUDED.has(k)&&v!==undefined)args[k]=v;
  }
  const state={
    action:'catalog_outside_app_override',
    account:typeof account==='string'?account:'',
    mode:typeof mode==='string'?mode:'',
    tool:typeof tool==='string'?tool:'',
    targetId:typeof targetId==='string'?targetId:null,
    marker:ownership?{
      appId:typeof ownership.appId==='string'?ownership.appId:null,
      key:typeof ownership.key==='string'?ownership.key:null,
      value:typeof ownership.value==='string'?ownership.value:null,
      agreementId:typeof ownership.agreementId==='string'?
        ownership.agreementId:null,
      via:typeof ownership.via==='string'?ownership.via:null,
      recordId:typeof ownership.recordId==='string'?ownership.recordId:null
    }:null,
    change:canonicalValue(args)
  };
  const hex=createHash('sha256').update(JSON.stringify(state)).digest('hex')
    .slice(0,20).toUpperCase();
  return 'APP-'+hex.match(/.{5}/g).join('-');
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
