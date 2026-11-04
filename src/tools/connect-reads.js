// CAP-4 Connect slice 1: native projected reads for CONNECTED
// accounts (third-party subjects) on the owner's enrolled platform
// connection. The connected account is an explicit exact argument on
// every account-scoped tool; the platform account (the connection's
// own account) is verified as the actor before any connected-account
// provider call, in the connection's own mode (TEST or LIVE).
// Projections are safe-fields only: no email, tax ID, bank routing or
// account numbers, card fingerprints, person data or documents ever
// enter a result. Persons follow the Identity family's safe-fields
// posture: verification state and minimal identity only. Lifecycle
// writes and destructive operations are later slices under the same
// card and stay refused/unreachable here.
import {allProfiles,guarded,paging,pageResult,ref,local} from './billing-shared.js';
import {assertAccountResourceMode} from './account-mode.js';
import {readVerifiedTestAccount,readVerifiedLiveAccount} from '../stripe/test-account.js';

const invalid=m=>{throw new TypeError(m);};
const acctId=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(x);
const personId=x=>typeof x==='string'&&/^person_[A-Za-z0-9]{2,100}$/.test(x);
const externalId=x=>typeof x==='string'&&/^(ba|card)_[A-Za-z0-9]{2,100}$/.test(x);
const capabilityId=x=>typeof x==='string'&&/^[a-z][a-z0-9_]{1,80}$/.test(x);
const capabilityStates=['active','inactive','pending','unrequested'];
const verificationStates=['unverified','pending','verified'];
const str=v=>typeof v==='string'&&v.length>0?v:null;
const flag=v=>typeof v==='boolean'?v:null;
const last4=v=>typeof v==='string'&&/^[0-9]{4}$/.test(v)?v:null;
const currency=v=>typeof v==='string'&&/^[a-z]{3}$/.test(v)?v:null;
function validate(a,allowed,required=[]){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!allowed.includes(k))||
    required.some(k=>a[k]===undefined))
    invalid('Exact Connect read arguments required');
}
function exactAccount(a){
  if(!acctId(a.accountId))invalid('Exact connected account ID required');
  return a.accountId;
}
// The actor check: the provider's own view of the connection's
// credential must be the enrolled platform account, with independent
// mode evidence, before any connected-account call is made (the
// money bank reads' authenticatedAccount precedent).
async function platformAccount(s,ctx){
  const accountId=ctx?.connection?.stripeAccount;
  if(!acctId(accountId))invalid('Selected Stripe account unavailable');
  if(ctx?.connection?.mode==='live')
    return readVerifiedLiveAccount(s,accountId);
  if(ctx?.connection?.mode==='test')
    return readVerifiedTestAccount(s,accountId);
  invalid('Selected Stripe account unavailable');
}
// Requirement lists project Stripe's field NAMES only (for example
// 'company.tax_id'), never values: they tell the platform what the
// connected account still has to provide. Takes the object's
// requirements sub-object.
function requirementNames(req,key){
  const rows=req?.[key];
  if(rows===undefined||rows===null)return null;
  if(!Array.isArray(rows)||rows.length>1000||
    rows.some(x=>typeof x!=='string'||x.length<1||x.length>120))
    invalid('Provider requirement list unreadable');
  return [...rows];
}
function requirements(req){
  if(!req||typeof req!=='object')return null;
  return {currentlyDue:requirementNames(req,'currently_due'),
    eventuallyDue:requirementNames(req,'eventually_due'),
    pastDue:requirementNames(req,'past_due'),
    pendingVerification:requirementNames(req,'pending_verification'),
    disabledReason:str(req.disabled_reason)};
}
export function connectAccountSafe(v,mode){
  // An Account object does not reliably publish livemode (the
  // verified-account readers' documented stance): a present livemode
  // must equal the connection mode; absence is tolerated exactly as
  // in the money bank summary precedent.
  if(v?.object!=='account'||!acctId(v.id))
    invalid('Connected account unavailable');
  assertAccountResourceMode(v,mode);
  return {id:v.id,type:str(v.type),country:
      typeof v.country==='string'&&/^[A-Z]{2}$/.test(v.country)?v.country:null,
    defaultCurrency:currency(v.default_currency),
    businessType:str(v.business_type),
    businessName:str(v.business_profile?.name),
    chargesEnabled:v.charges_enabled===true,
    payoutsEnabled:v.payouts_enabled===true,
    detailsSubmitted:v.details_submitted===true,
    createdAt:Number.isSafeInteger(v.created)?local(v.created):null,
    requirements:requirements(v.requirements)};
}
export function connectCapabilitySafe(v,accountId,mode){
  if(v?.object!=='capability'||!capabilityId(v.id)||
    ref(v.account)!==accountId||!capabilityStates.includes(v.status)||
    (v.requested!==undefined&&typeof v.requested!=='boolean'))
    invalid('Exact connected-account capability unavailable');
  // Capability objects publish livemode: it must equal the
  // connection mode, in both directions.
  assertAccountResourceMode(v,mode,{required:true});
  return {id:v.id,account:accountId,status:v.status,
    requested:v.requested??null,
    requestedAt:Number.isSafeInteger(v.requested_at)?local(v.requested_at):null,
    requirements:requirements(v.requirements)};
}
export function connectPersonSafe(v,accountId,mode){
  if(v?.object!=='person'||!personId(v.id)||ref(v.account)!==accountId)
    invalid('Exact connected-account person unavailable');
  assertAccountResourceMode(v,mode,{required:true});
  const rel=v.relationship&&typeof v.relationship==='object'?
    v.relationship:{};
  const verification=v.verification&&typeof v.verification==='object'?
    v.verification:{};
  // Safe fields only (Identity posture): the person's ID, role flags
  // and verification state. Names, dates of birth, addresses, contact
  // details, document data and ID numbers are never projected.
  return {id:v.id,account:accountId,
    createdAt:Number.isSafeInteger(v.created)?local(v.created):null,
    verificationStatus:verificationStates.includes(verification.status)?
      verification.status:null,
    relationship:{owner:flag(rel.owner),director:flag(rel.director),
      representative:flag(rel.representative),executive:flag(rel.executive)},
    requirements:requirements(v.requirements)};
}
export function connectExternalAccountSafe(v,accountId,mode){
  if(!['bank_account','card'].includes(v?.object)||!externalId(v.id)||
    ref(v.account)!==accountId||!last4(v.last4))
    invalid('Exact connected-account external account unavailable');
  assertAccountResourceMode(v,mode,{required:true});
  const base={id:v.id,object:v.object,account:accountId,last4:v.last4,
    country:typeof v.country==='string'&&/^[A-Z]{2}$/.test(v.country)?
      v.country:null,currency:currency(v.currency),
    defaultForCurrency:v.default_for_currency===true};
  if(v.object==='bank_account')
    return {...base,bankName:str(v.bank_name),status:str(v.status)};
  return {...base,brand:str(v.brand),funding:str(v.funding),
    expMonth:Number.isInteger(v.exp_month)&&v.exp_month>=1&&v.exp_month<=12?
      v.exp_month:null,
    expYear:Number.isInteger(v.exp_year)&&v.exp_year>=2000&&v.exp_year<=9999?
      v.exp_year:null};
}
const accountArg={type:'string',pattern:'^acct_[A-Za-z0-9]{2,100}$'};
const limitArg={type:'integer',minimum:1,maximum:100};
export const tools=[
  {name:'connect_list_accounts',area:'connect',writes:false,profiles:allProfiles,
    description:'List connected accounts on the platform account (TEST or LIVE); safe fields only.',
    annotations:{readOnlyHint:true},detailFieldsSupported:false,
    inputSchema:{type:'object',properties:{
      limit:limitArg,
      starting_after:{type:'string',maxLength:110}
    },additionalProperties:false}},
  {name:'connect_get_account',area:'connect',writes:false,profiles:allProfiles,
    description:'Read one exact connected account (TEST or LIVE); safe status fields only.',
    annotations:{readOnlyHint:true},detailFieldsSupported:false,
    inputSchema:{type:'object',properties:{
      accountId:accountArg
    },required:['accountId'],additionalProperties:false}},
  {name:'connect_list_capabilities',area:'connect',writes:false,profiles:allProfiles,
    description:'List capability statuses of an exact connected account (TEST or LIVE); names only.',
    annotations:{readOnlyHint:true},detailFieldsSupported:false,
    inputSchema:{type:'object',properties:{
      accountId:accountArg,limit:limitArg,
      starting_after:{type:'string',maxLength:110}
    },required:['accountId'],additionalProperties:false}},
  {name:'connect_get_capability',area:'connect',writes:false,profiles:allProfiles,
    description:'Read one capability status of an exact connected account (TEST or LIVE); names only.',
    annotations:{readOnlyHint:true},detailFieldsSupported:false,
    inputSchema:{type:'object',properties:{
      accountId:accountArg,
      capability:{type:'string',pattern:'^[a-z][a-z0-9_]{1,80}$'}
    },required:['accountId','capability'],additionalProperties:false}},
  {name:'connect_get_external_account',area:'connect',writes:false,profiles:allProfiles,
    description:'Read a payout destination of an exact connected account (TEST or LIVE); last4 only.',
    annotations:{readOnlyHint:true},detailFieldsSupported:false,
    inputSchema:{type:'object',properties:{
      accountId:accountArg,
      externalAccountId:{type:'string',pattern:'^(ba|card)_[A-Za-z0-9]{2,100}$'}
    },required:['accountId','externalAccountId'],additionalProperties:false}},
  {name:'connect_list_persons',area:'connect',writes:false,profiles:allProfiles,
    description:'List people of an exact connected account (TEST or LIVE); verification state only.',
    annotations:{readOnlyHint:true},detailFieldsSupported:false,
    inputSchema:{type:'object',properties:{
      accountId:accountArg,limit:limitArg,
      starting_after:{type:'string',maxLength:110}
    },required:['accountId'],additionalProperties:false}},
  {name:'connect_get_person',area:'connect',writes:false,profiles:allProfiles,
    description:'Read one person of an exact connected account (TEST or LIVE); state and roles only.',
    annotations:{readOnlyHint:true},detailFieldsSupported:false,
    inputSchema:{type:'object',properties:{
      accountId:accountArg,
      personId:{type:'string',pattern:'^person_[A-Za-z0-9]{2,100}$'}
    },required:['accountId','personId'],additionalProperties:false}}
];
export const handlers={
  connect_list_accounts:(a,ctx)=>guarded(ctx,async s=>{
    validate(a,['limit','starting_after']);
    if(a.starting_after!==undefined&&!acctId(a.starting_after))
      invalid('Exact connected account cursor required');
    await platformAccount(s,ctx);
    const page=await s.accounts.list(paging(a));
    return pageResult(page,v=>connectAccountSafe(v,ctx?.connection?.mode));
  }),
  connect_get_account:(a,ctx)=>guarded(ctx,async s=>{
    validate(a,['accountId'],['accountId']);
    const accountId=exactAccount(a);
    await platformAccount(s,ctx);
    const v=await s.accounts.retrieve(accountId);
    if(v?.id!==accountId)invalid('Connected account ID mismatch');
    return connectAccountSafe(v,ctx?.connection?.mode);
  }),
  connect_list_capabilities:(a,ctx)=>guarded(ctx,async s=>{
    validate(a,['accountId','limit','starting_after'],['accountId']);
    const accountId=exactAccount(a);
    if(a.starting_after!==undefined&&!capabilityId(a.starting_after))
      invalid('Exact capability cursor required');
    await platformAccount(s,ctx);
    const page=await s.accounts.listCapabilities(accountId,paging(a));
    return pageResult(page,v=>
      connectCapabilitySafe(v,accountId,ctx?.connection?.mode));
  }),
  connect_get_capability:(a,ctx)=>guarded(ctx,async s=>{
    validate(a,['accountId','capability'],['accountId','capability']);
    const accountId=exactAccount(a);
    if(!capabilityId(a.capability))invalid('Exact capability name required');
    await platformAccount(s,ctx);
    const v=await s.accounts.retrieveCapability(accountId,a.capability);
    if(v?.id!==a.capability)invalid('Connected capability ID mismatch');
    return connectCapabilitySafe(v,accountId,ctx?.connection?.mode);
  }),
  connect_get_external_account:(a,ctx)=>guarded(ctx,async s=>{
    validate(a,['accountId','externalAccountId'],
      ['accountId','externalAccountId']);
    const accountId=exactAccount(a);
    if(!externalId(a.externalAccountId))
      invalid('Exact external account ID required');
    await platformAccount(s,ctx);
    const v=await s.accounts.retrieveExternalAccount(accountId,
      a.externalAccountId);
    if(v?.id!==a.externalAccountId)
      invalid('Connected external account ID mismatch');
    return connectExternalAccountSafe(v,accountId,ctx?.connection?.mode);
  }),
  connect_list_persons:(a,ctx)=>guarded(ctx,async s=>{
    validate(a,['accountId','limit','starting_after'],['accountId']);
    const accountId=exactAccount(a);
    if(a.starting_after!==undefined&&!personId(a.starting_after))
      invalid('Exact person cursor required');
    await platformAccount(s,ctx);
    const page=await s.accounts.listPersons(accountId,paging(a));
    return pageResult(page,v=>
      connectPersonSafe(v,accountId,ctx?.connection?.mode));
  }),
  connect_get_person:(a,ctx)=>guarded(ctx,async s=>{
    validate(a,['accountId','personId'],['accountId','personId']);
    const accountId=exactAccount(a);
    if(!personId(a.personId))invalid('Exact person ID required');
    await platformAccount(s,ctx);
    const v=await s.accounts.retrievePerson(accountId,a.personId);
    if(v?.id!==a.personId)invalid('Connected person ID mismatch');
    return connectPersonSafe(v,accountId,ctx?.connection?.mode);
  })
};
