import {verifiedTestAccountRecord} from './account-profile.js';
// G-5d1: native TEST payment-method domains (Apple Pay registration status).
import {client,reply,fail,allProfiles} from './billing-shared.js';
const bad=m=>{throw new TypeError(m);};
const acctOk=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(x);
const idOk=x=>typeof x==='string'&&/^pmd_[A-Za-z0-9]{2,100}$/.test(x);
const hostOk=x=>typeof x==='string'&&x.length<=253&&x.length>3&&
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(x);
const states=['active','inactive','pending'];
const unsupported=e=>[403,404].includes(e?.statusCode??e?.status)||
  ['permission_denied','resource_missing'].includes(e?.code);
export function safeDomain(v){
  if(v?.object!=='payment_method_domain'||!idOk(v.id)||!hostOk(v.domain_name)||
    typeof v.enabled!=='boolean'||v.livemode===true||
    !v.apple_pay||!states.includes(v.apple_pay.status))
    bad('Provider TEST domain registration status unreadable');
  return {id:v.id,domain:v.domain_name,enabled:v.enabled,
    applePayStatus:v.apple_pay.status,applePayReady:v.enabled&&v.apple_pay.status==='active'};
}
function check(a){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!['limit','starting_after'].includes(k))||
    (a.limit!==undefined&&(!Number.isInteger(a.limit)||a.limit<1||a.limit>20))||
    (a.starting_after!==undefined&&!idOk(a.starting_after)))
    bad('Select a valid TEST Apple Pay domain page and cursor');
}
export const tools=[{name:'account_list_apple_pay_domains',area:'account',
  writes:false,profiles:allProfiles,annotations:{readOnlyHint:true},
  description:'Read TEST payment-method domain registrations and observed Apple Pay status; unavailable is not active.',
  inputSchema:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:20},
    starting_after:{type:'string',pattern:'^pmd_[A-Za-z0-9]{2,100}$'}},
    additionalProperties:false}}];
export const handlers={
  async account_list_apple_pay_domains(a,ctx){
    const account=ctx?.connection?.stripeAccount;
    if(ctx?.connection?.mode!=='test'||!acctOk(account))
      return fail('Select a connected TEST account');
    try{
      check(a);
      const s=await client(ctx),own=await s.accounts.retrieve();
      if(!verifiedTestAccountRecord(own,account))
        bad('Selected own TEST account identity unavailable');
      let p;
      try{p=await s.paymentMethodDomains.list({limit:a.limit??10,
        ...(a.starting_after?{starting_after:a.starting_after}:{})});}
      catch(e){
        if(unsupported(e))return reply({account,available:false,domains:null,
          hasMore:null,nextCursor:null,verification:'not_readable',
          note:'Stripe refused the native TEST payment-method domain list. Check Dashboard > Settings > Payment methods > Payment method domains; no Apple Pay readiness is inferred.'});
        throw e;
      }
      if(p?.object!=='list'||!Array.isArray(p.data)||p.data.length>20||
        typeof p.has_more!=='boolean'||(p.has_more&&p.data.length===0))
        bad('Provider domain page incomplete');
      const domains=p.data.map(safeDomain);
      return reply({account,available:true,domains,hasMore:p.has_more,
        nextCursor:p.has_more?domains.at(-1).id:null,
        note:'Only an enabled domain with active provider Apple Pay status is reported ready; actual Checkout eligibility may require further conditions.'});
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
