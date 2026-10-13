// Opt-in, TEST-only readback through this repository's own MCP dispatch.
import {registry} from '../tools/index.js';
import {dispatchReadOnlyTool} from '../core/mcp-server.js';
import {makeStripeClient} from '../stripe/client.js';
import {readVerifiedTestAccount} from '../stripe/test-account.js';
import {OwnerSmokeFailure} from './owner-smoke-failure.js';

const ACCOUNT=/^acct_[A-Za-z0-9]{2,100}$/;
const TEST_KEY=/^(?:sk|rk)_test_[A-Za-z0-9]{12,}$/;
const cases=Object.freeze([
  ['G-5','account_get',{detail:'full'}],
  ['G-5','account_list_capabilities',{limit:10}],
  ['G-5','account_list_payment_method_settings',{limit:5}],
  ['G-5','account_list_apple_pay_domains',{limit:5}],
  ['G-4','event_list',{limit:3}],
  ['G-4','webhook_list',{limit:3}],
  ['G-6','admin_list_requirements',{}],
  ['G-6','admin_check_setting',{setting:'payment_methods'}]
]);
// Separate explicit owner administration pass; no unrestricted tool discovery
// and no provider mutation even if a registered tool changes classification.
const adminCases=Object.freeze([
  ['G-6','stripe_admin_overview',{detail:'summary'}],
  ['G-6','admin_review_security',{}],
  ['G-6','admin_list_guided_settings',{limit:5}]
]);
// Bounded focused probes reduce provider read volume, isolate permission
// denials and keep the original comprehensive modes backwards-compatible.
const smokeGroups=Object.freeze({
  core:cases,
  account:Object.freeze(cases.slice(0,4)),
  webhooks:Object.freeze(cases.slice(4,6)),
  readiness:Object.freeze(cases.slice(6,8)),
  administration:adminCases
});
export const ownerSmokeFocusTools=Object.freeze(Object.fromEntries(
  Object.entries(smokeGroups).map(([group,items])=>
    [group,Object.freeze(items.map(([,name])=>name))])));
export const ownerSmokeCases=cases.map(([batch,tool])=>({batch,tool}));
export const ownerAdminSmokeCases=adminCases.map(([batch,tool])=>({batch,tool}));

// Require the expected safe projection, never infer success from arbitrary JSON.
function validProjection(tool,data,account){
  const own=data.account===account;
  switch(tool){
    case 'account_get':
      return data.id===account&&(
        (data.available===false&&data.verification==='not_readable')||
        (typeof data.chargesEnabled==='boolean'&&
         typeof data.payoutsEnabled==='boolean'&&
         typeof data.detailsSubmitted==='boolean'&&
         ['ok','needs_attention','not_readable'].includes(data.verification)));
    case 'account_list_capabilities':
      return own&&(data.available===false&&data.verification==='not_readable'||
        data.available===true&&Array.isArray(data.capabilities)&&
        data.capabilities.length<=10&&typeof data.hasMore==='boolean');
    case 'account_list_payment_method_settings':
      return own&&(data.available===false&&data.verification==='not_readable'||
        data.available===true&&Array.isArray(data.configurations)&&
        data.configurations.length<=5&&typeof data.hasMore==='boolean');
    case 'account_list_apple_pay_domains':
      return own&&(data.available===false&&data.verification==='not_readable'||
        data.available===true&&Array.isArray(data.domains)&&
        data.domains.length<=5&&typeof data.hasMore==='boolean');
    case 'event_list':
    case 'webhook_list':
      return Array.isArray(data.data)&&data.data.length<=3&&
        typeof data.has_more==='boolean';
    case 'admin_list_requirements':
      return own&&data.mode==='test'&&
        ['ok','needs_attention','not_readable'].includes(data.status)&&
        typeof data.observed==='boolean';
    case 'admin_check_setting':
      return own&&data.setting==='payment_methods'&&
        ['observed','not_readable'].includes(data.status)&&
        typeof data.observed==='boolean';
    case 'stripe_admin_overview':
      return own&&data.mode==='test'&&data.summaryOnly===true&&
        data.verificationReadiness?.status==='awaiting_owner'&&
        data.verificationReadiness.dashboardWalkthroughVerified===false&&
        Array.isArray(data.ownerWalkthrough)&&data.ownerWalkthrough.length===14&&
        data.ownerWalkthrough.every(v=>v.ownerConfirmed===false)&&
        data.sections&&typeof data.sections==='object';
    case 'admin_review_security':
      return own&&data.mode==='test'&&data.readOnly===true&&
        data.sections?.twoStepLogin?.status==='not_readable'&&
        data.sections?.apiKeyRotation?.status==='not_readable';
    case 'admin_list_guided_settings':
      return own&&data.mode==='test'&&Array.isArray(data.settings)&&
        data.settings.length<=5&&typeof data.hasMore==='boolean'&&
        data.settings.every(v=>v.changeMade===false&&v.verification==='not_readable');
    default:return false;
  }
}
function classify(tool,response,account){
  if(response?.isError||!Array.isArray(response?.content)||
    response.content.length!==1||typeof response.content[0]?.text!=='string')
    return 'error';
  let data;
  try{data=JSON.parse(response.content[0].text);}catch{return 'error';}
  if(!data||typeof data!=='object'||Array.isArray(data)||
    typeof data.handle==='string'||!validProjection(tool,data,account))return 'error';
  // A guide or a native-only admin read is not a signed-in Dashboard inspection.
  if(tool==='admin_list_guided_settings')return 'not_readable';
  if(tool==='stripe_admin_overview'||tool==='admin_review_security')return 'partial';
  if(data.available===false||data.verification==='not_readable'||
    data.status==='not_readable')return 'not_readable';
  if(data.complete===false||data.hasMore===true||data.has_more===true)
    return 'partial';
  return 'observed';
}

export async function runOwnerTestSmoke({account,key,focus='core',makeClient=makeStripeClient,
  dispatch=dispatchReadOnlyTool}={}){
  const selected=Object.hasOwn(smokeGroups,focus)?smokeGroups[focus]:null;
  if(!selected)throw new TypeError('Select a supported TEST smoke group');
  if(!ACCOUNT.test(account)||!TEST_KEY.test(key))
    throw new TypeError('A privately provisioned TEST key and exact account are required');
  // Never log or return key, SDK errors, provider records or sensitive URLs.
  let sdk;
  try{
    sdk=makeClient({key,mode:'test'});
    const identity=await readVerifiedTestAccount(sdk,account);
    if(
      typeof identity.charges_enabled!=='boolean'||
      typeof identity.payouts_enabled!=='boolean'||
      typeof identity.details_submitted!=='boolean')
      throw new OwnerSmokeFailure('identity_incomplete');
  }catch(error){
    if(error instanceof OwnerSmokeFailure)throw error;
    if(error?.statusCode===401||error?.statusCode===403)
      throw new OwnerSmokeFailure('provider_denied');
    throw new OwnerSmokeFailure('identity_unverified');
  }
  const connection={stripeAccount:account,mode:'test',profile:'read_only'};
  const services={stripeForConnection:async()=>sdk};
  const records=[];
  for(const [batch,tool,args] of selected){
    const contract=registry.tools.find(t=>t.name===tool);
    if(!contract||contract.writes!==false||contract.annotations?.readOnlyHint!==true)
      throw new OwnerSmokeFailure('tool_unavailable');
    let status='error';
    try{
      status=classify(tool,await dispatch({registry,name:tool,args,connection,services,db:{}}),account);
    }catch{/* Deliberately withhold raw provider errors and account details. */}
    records.push({batch,tool,status});
  }
  // This only proves this process exercised repository handlers through its
  // dispatch with a real selected TEST client. Dashboard acceptance is separate.
  return {account,mode:'test',focus,source:'custom_mcp_dispatch',verifiedIdentity:true,
    dashboardVerified:false,writeOperations:0,records,
    observed:records.filter(x=>x.status==='observed').length,
    partial:records.filter(x=>x.status==='partial').length,
    notReadable:records.filter(x=>x.status==='not_readable').length,
    errors:records.filter(x=>x.status==='error').length,
    note:'An executed provider-backed smoke report is not an owner Dashboard walkthrough or proof of payment/event delivery.'};
}
