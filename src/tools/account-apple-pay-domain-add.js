import {verifiedTestAccountRecord} from './account-profile.js';
// G-5d2: register a TEST-only payment-method domain with independent read-back.
import {defineWrite,gone} from './write.js';
import {client,fullProfiles} from './billing-shared.js';
import {safeDomain} from './account-apple-pay-domains.js';
const bad=message=>{throw new TypeError(message);};
const accountOk=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(x);
const domainOk=x=>typeof x==='string'&&x.length<=253&&x.length>=4&&
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(x)&&
  !x.split('.').some(x=>x.length>63||x.startsWith('xn--')||x.startsWith('-')) &&
  !['localhost','local','internal','test','invalid'].includes(x.split('.').at(-1));
const props={domain:{type:'string',maxLength:253},
  outsideApp:{type:'boolean'}};
function validate(a){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!['domain','outsideApp','dryRun','confirm','requestKey'].includes(k))||
    !domainOk(a.domain)||a.domain!==a.domain.toLowerCase()||
    (a.outsideApp!==undefined&&typeof a.outsideApp!=='boolean')||
    (a.requestKey!==undefined&&(typeof a.requestKey!=='string'||a.requestKey.length<1||a.requestKey.length>128)))
    bad('Use an exact lowercase public domain hostname; no URL, path or credentials');
}
async function own(ctx){
  const s=await client(ctx),account=ctx?.connection?.stripeAccount;
  if(!accountOk(account))bad('Select a connected TEST account');
  const v=await s.accounts.retrieve();
  if(!verifiedTestAccountRecord(v,account))
    bad('Selected TEST account identity could not be verified');
  return s;
}
async function findExact(s,domain){
  const p=await s.paymentMethodDomains.list({domain_name:domain,limit:10});
  if(p?.object!=='list'||!Array.isArray(p.data)||typeof p.has_more!=='boolean'||
    p.has_more||p.data.length>1)
    bad('Cannot fully verify existing TEST domain registrations');
  for(const d of p.data)if(safeDomain(d).domain!==domain)
    bad('Provider domain list mismatched exact requested domain');
  return p.data[0]??null;
}
export function makeDomainAddWrite(){
  const op=defineWrite({
    name:'account_add_apple_pay_domain',
    read:async(a,ctx)=>{
      validate(a);
      const s=await own(ctx);
      const existing=await findExact(s,a.domain);
      if(existing)bad('This TEST domain is already registered; inspect its existing status instead of creating a duplicate');
      return {id:ctx.connection.stripeAccount,domain:a.domain,verifiedAbsent:true};
    },
    summarize:(before,a)=>'TEST MODE. Register '+a.domain+
      ' as an enabled payment-method domain for '+before.id+
      '. Apple Pay activation or Checkout eligibility is NOT guaranteed.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const s=await own(ctx);
      if(await findExact(s,a.domain))bad('Existing domain appeared before provider write');
      await s.paymentMethodDomains.create({domain_name:a.domain,enabled:true},{idempotencyKey});
    },
    readAfter:async(a,ctx)=>{
      const s=await own(ctx);
      const result=await findExact(s,a.domain);
      if(!result)return null;
      return s.paymentMethodDomains.retrieve(result.id);
    },
    verify:(before,after,a)=>{
      if(!after)return false;
      const v=safeDomain(after);
      return before.verifiedAbsent===true&&v.domain===a.domain&&v.enabled===true;
    }
  });
  return {...op,async handler(a,ctx){
    const result=await op.handler(a,ctx);
    let obj;
    try{obj=JSON.parse(result.content[0].text);}catch{return result;}
    return {...result,content:[{type:'text',text:JSON.stringify({...obj,
      verifyWith:'account_list_apple_pay_domains',
      ...(obj.done===true?{
        note:'Domain registration verified; Apple Pay must separately report active, and actual Checkout eligibility is not guaranteed.'
      }:{
        verified:false,manualSettingsUrl:'https://dashboard.stripe.com/test/settings/payment_methods',
        manualSteps:['In TEST Dashboard open Payment methods > Payment method domains.',
          'Check the requested domain and complete Stripe verification steps.',
          'Call account_list_apple_pay_domains to confirm provider status.'],
        note:'Unconfirmed or refused registration must not be treated as successful.'}
      )})}]};
  }};
}
const op=makeDomainAddWrite();
export const tools=[{...op.tool,area:'account',profiles:fullProfiles,
  description:'Guarded TEST payment-method domain registration with duplicate checks and provider readback, not Apple Pay activation.',
  inputSchema:{type:'object',properties:{...props,
    dryRun:{type:'boolean'},confirm:{type:'boolean'},
    requestKey:{type:'string',minLength:1,maxLength:128}},
    required:['domain'],additionalProperties:false}}];
export const handlers={account_add_apple_pay_domain:(a,ctx)=>
  ctx?.connection?.mode!=='test'?gone('Payment domain registration requires TEST mode'):
    makeDomainAddWrite().handler(a,ctx)};
