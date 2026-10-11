// G-3a: safe TEST Radar reads, never return IP, card, email or raw list-item values.
import {allProfiles,guarded,fail,pageResult,paging,ref,local} from './billing-shared.js';
const invalid=m=>{throw new TypeError(m);};
const exact=(v,p)=>typeof v==='string'&&new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(v);
const checked=(v,p,object)=>{
  if(!v||v.object!==object||!exact(v.id,p)||v.livemode!==false)
    invalid('Cannot verify exact TEST Radar record');
  if(!Number.isSafeInteger(v.created)||v.created<946684800)
    invalid('Radar creation timestamp invalid');
  return v;
};
const optionalRef=(v,p)=>{
  const x=ref(v);if(x===null)return null;
  if(!exact(x,p))invalid('Radar linked payment identity invalid');
  return x;
};
export function warningSafe(v){
  const x=checked(v,'issfr','radar.early_fraud_warning');
  return {id:x.id,createdAt:local(x.created),
    charge:optionalRef(x.charge,'ch'),
    paymentIntent:optionalRef(x.payment_intent,'pi'),
    actionable:x.actionable===true,reason:
      ['card_never_received','fraudulent_card_application','made_with_counterfeit_card',
        'made_with_lost_card','made_with_stolen_card','misc','other'].includes(x.fraud_type)?
        x.fraud_type:null};
}
export function reviewSafe(v){
  const x=checked(v,'prv','review');
  if(typeof x.open!=='boolean')invalid('Radar review state invalid');
  return {id:x.id,createdAt:local(x.created),open:x.open,
    charge:optionalRef(x.charge,'ch'),
    paymentIntent:optionalRef(x.payment_intent,'pi'),
    reason:typeof x.reason==='string'&&/^[a-z_]{1,40}$/.test(x.reason)?
      x.reason:null,
    closedReason:typeof x.closed_reason==='string'&&
      /^[a-z_]{1,40}$/.test(x.closed_reason)?x.closed_reason:null};
}
const types=['card_bin','card_fingerprint','case_sensitive_string','country',
  'customer_id','email','ip_address','sepa_debit_fingerprint','string',
  'us_bank_account_fingerprint'];
export function valueListSafe(v){
  const x=checked(v,'rsl','radar.value_list');
  if(!types.includes(x.item_type)||typeof x.alias!=='string'||
    !/^[a-z0-9_]{1,100}$/.test(x.alias)||typeof x.name!=='string'||
    x.name.length>200)invalid('Radar list metadata invalid');
  return {id:x.id,createdAt:local(x.created),name:x.name,
    alias:x.alias,itemType:x.item_type,
    itemCount:Number.isSafeInteger(x.list_items?.total_count)?
      x.list_items.total_count:null};
}
export function valueItemSafe(v){
  const x=checked(v,'rsli','radar.value_list_item');
  const list=ref(x.value_list);
  if(!exact(list,'rsl'))invalid('Radar list item does not match a verified list');
  // Raw values can be emails, account IDs and card fingerprints; never echo.
  return {id:x.id,createdAt:local(x.created),valueListId:list,
    hasValue:typeof x.value==='string'&&x.value.length>0};
}
const item={type:'string',pattern:'^rsl_[A-Za-z0-9]{2,100}$'};
const def=(name,description,props,required=[])=>({
  name,description,area:'risk',writes:false,profiles:allProfiles,
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties:props,required,additionalProperties:false}});
const paged=(p='')=>({limit:{type:'integer',minimum:1,maximum:100},
  starting_after:{type:'string',pattern:'^'+p+'_[A-Za-z0-9]{2,100}$'}});
export const tools=[
  def('radar_list_fraud_warnings','List TEST early fraud warning IDs, linked charges and actionable flags.',
    paged('issfr')),
  def('radar_get_fraud_warning','Get one TEST fraud warning without private customer details.',
    {warningId:{type:'string',pattern:'^issfr_[A-Za-z0-9]{2,100}$'}},['warningId']),
  def('radar_list_reviews','List open TEST Radar review IDs and linked payment IDs.',paged('prv')),
  def('radar_get_review','Get TEST Radar review status without address or IP.',
    {reviewId:{type:'string',pattern:'^prv_[A-Za-z0-9]{2,100}$'}},['reviewId']),
  def('radar_list_value_lists','List TEST Radar value-list definitions without item values.',paged('rsl')),
  def('radar_list_list_items','List TEST value-list item IDs without sensitive raw values.',
    {valueListId:item,...paged('rsli')},['valueListId'])
];
function check(a,allowed,required=[],prefix){
  if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!allowed.includes(k))||
    required.some(k=>a[k]===undefined))
    invalid('Exact Radar read arguments required');
  if(prefix&&a.starting_after!==undefined&&!exact(a.starting_after,prefix))
    invalid('Invalid Radar cursor');
}
async function list(a,ctx,path,prefix,shape,more={}){
  return ctx?.connection?.mode!=='test'?fail('Radar reads require TEST mode'):
    guarded(ctx,async s=>{
      check(a,['limit','starting_after',...Object.keys(more)],Object.keys(more),prefix);
      const result=await path(s).list({...paging(a),...more});
      return pageResult(result,shape);
    });
}
async function get(a,ctx,key,prefix,path,shape){
  return ctx?.connection?.mode!=='test'?fail('Radar reads require TEST mode'):
    guarded(ctx,async s=>{
      check(a,[key],[key]);
      if(!exact(a[key],prefix))invalid('Exact Radar ID required');
      const value=await path(s).retrieve(a[key]);
      if(value?.id!==a[key])invalid('Radar identity mismatch');
      return shape(value);
    });
}
export const handlers={
  radar_list_fraud_warnings:(a,c)=>list(a,c,s=>s.radar.earlyFraudWarnings,'issfr',warningSafe),
  radar_get_fraud_warning:(a,c)=>get(a,c,'warningId','issfr',s=>s.radar.earlyFraudWarnings,warningSafe),
  radar_list_reviews:(a,c)=>list(a,c,s=>s.reviews,'prv',reviewSafe),
  radar_get_review:(a,c)=>get(a,c,'reviewId','prv',s=>s.reviews,reviewSafe),
  radar_list_value_lists:(a,c)=>list(a,c,s=>s.radar.valueLists,'rsl',valueListSafe),
  radar_list_list_items:(a,c)=>{
    if(!exact(a?.valueListId,'rsl'))return fail('Exact Radar value list ID required');
    return list(a,c,s=>s.radar.valueListItems,'rsli',v=>{
      const item=valueItemSafe(v);
      if(item.valueListId!==a.valueListId)invalid('Foreign Radar value-list item');
      return item;
    },{value_list:a.valueListId});
  }
};
