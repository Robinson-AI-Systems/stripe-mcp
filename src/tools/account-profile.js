// G-5a: verified selected TEST Stripe account status, never private owner/PII data.
import {guarded,fail,allProfiles} from './billing-shared.js';
import {denverLocalTime} from './util.js';
const bad=message=>{throw new TypeError(message);};
const accountId=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(x);
const fields=['id','country','defaultCurrency','chargesEnabled','payoutsEnabled',
  'detailsSubmitted','verification','dueCount','pastDueCount','pendingCount',
  'deadlineDenver','businessType'];
const selectedSchema={type:'array',maxItems:fields.length,uniqueItems:true,
  items:{type:'string',enum:fields}};
const safeId=x=>accountId(x);
function safeListCount(x){
  if(x===undefined||x===null)return null;
  if(!Array.isArray(x)||x.length>1000)return bad('Account verification requirements unreadable');
  return x.length; // Never reveal the actual requirement strings: they may identify people.
}
function deadline(x){
  if(x===null||x===undefined)return null;
  if(!Number.isSafeInteger(x)||x<946684800||x>4102444800)
    bad('Account deadline unavailable');
  return denverLocalTime(x);
}
export function accountSafe(v,expected,{detail='summary',select}={}){
  if(!safeId(expected)||v?.id!==expected||v.object!=='account'||v.livemode===true||
    typeof v.charges_enabled!=='boolean'||typeof v.payouts_enabled!=='boolean'||
    typeof v.details_submitted!=='boolean')
    bad('Selected TEST Stripe account status unavailable');
  if(v.country!==undefined&&(typeof v.country!=='string'||!/^[A-Z]{2}$/.test(v.country)))
    bad('Account country invalid');
  if(v.default_currency!==undefined&&
    (typeof v.default_currency!=='string'||!/^[a-z]{3}$/.test(v.default_currency)))
    bad('Account currency invalid');
  const r=v.requirements??null;
  const due=r?safeListCount(r.currently_due):null;
  const past=r?safeListCount(r.past_due):null;
  const pending=r?safeListCount(r.pending_verification):null;
  const verification=due===null||past===null?'not_readable':
    due>0||past>0?'needs_attention':'ok';
  const summary={id:v.id,country:v.country??null,
    defaultCurrency:v.default_currency??null,
    chargesEnabled:v.charges_enabled,payoutsEnabled:v.payouts_enabled,
    detailsSubmitted:v.details_submitted,verification};
  const full={...summary,dueCount:due,pastDueCount:past,pendingCount:pending,
    deadlineDenver:r?deadline(r.current_deadline):null,
    businessType:['individual','company','non_profit','government_entity'].includes(v.business_type)?
      v.business_type:null};
  const projected=detail==='full'?full:summary;
  return !select?projected:Object.fromEntries(Object.entries(projected).filter(
    ([k])=>k==='id'||select.includes(k)));
}
function validate(a){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!['fields','detail'].includes(k))||
    (a.detail!==undefined&&!['summary','full'].includes(a.detail))||
    (a.fields!==undefined&&(!Array.isArray(a.fields)||a.fields.length>fields.length||
      new Set(a.fields).size!==a.fields.length||
      a.fields.some(k=>!fields.includes(k)))))
    bad('Choose allowed account fields and summary/full detail only');
}
function restricted(e){
  return e?.statusCode===403||e?.status===403||
    e?.code==='permission_denied'||e?.raw?.code==='permission_denied';
}
export const tools=[{
  name:'account_get',area:'account',writes:false,profiles:allProfiles,
  annotations:{readOnlyHint:true},
  description:'Read verified TEST account payment status and requirement counts; never expose owner PII or bank details.',
  inputSchema:{type:'object',properties:{
    fields:selectedSchema,detail:{type:'string',enum:['summary','full']}
  },additionalProperties:false}
}];
export const handlers={
  account_get:async(a,ctx)=>{
    if(ctx?.connection?.mode!=='test'||!safeId(ctx.connection.stripeAccount))
      return fail('Select an authorized TEST Stripe account first');
    return guarded(ctx,async s=>{
      validate(a);
      let record;
      try{record=await s.accounts.retrieve();}
      catch(e){
        if(!restricted(e))throw e;
        return {id:ctx.connection.stripeAccount,available:false,verification:'not_readable',
          note:'Stripe did not permit this account read. Check TEST key permissions and account details in your Stripe Dashboard.'};
      }
      return accountSafe(record,ctx.connection.stripeAccount,{detail:a.detail,select:a.fields});
    });
  }
};
