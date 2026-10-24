// CAP-2: effective source policy explanation, never an authorization decision.
// The existing MCP dispatcher, profile guards, provider and money approval layers remain authoritative.
import {CONNECTION_PROFILES,isToolAllowed,isGuardedTestWrite,
  isGuardedLiveWrite} from './profiles.js';

const ACCOUNT=/^acct_[A-Za-z0-9]{2,100}$/;
const modes=new Set(['test','live']);
const SOURCE_STATE=Object.freeze({
  sourceEligible:'source-candidate-only',
  sourceDenied:'source-denied'
});
const actions=Object.freeze({
  reconnect:'Reconnect this app to choose an explicitly approved Full or read-only profile; current grants do not change.',
  ownerLive:'Ask the authorized account owner to activate LIVE and independently consent to LIVE writes on the verified production service.',
  provider:'Check actual Stripe account roles, key/app grant permissions and product/country entitlements with Stripe. Neither a matching tool name nor a key type proves authority.',
  implementation:'This tool has no verified runtime handler; implementation or a complete original guarded write contract is required.',
  money:'Every AI money-out still requires the authenticated owner’s separate exact transaction approval and shared $500/account/Denver-day protection.',
  correctAccount:'Reconnect using the intended, provider-verified Stripe account; do not switch accounts by changing tool arguments.'
});

const validConnection=c=>c&&typeof c==='object'&&
  ACCOUNT.test(c.stripeAccount||'')&&modes.has(c.mode)&&
  CONNECTION_PROFILES.includes(c.profile);
const trustedRow=(c,a)=>a&&a.id===c.stripeAccount;
const profileAllowed=(t,p)=>Array.isArray(t?.profiles)&&t.profiles.includes(p);
const registered=(r,t)=>typeof t?.name==='string'&&
  typeof r?.handlers?.[t.name]==='function';
const financial=t=>t?.money===true||t?.moneySpec==='provider-derived';
const boolean=x=>x===true;

/** This reports the real existing policy source layers without executing a handler. */
export function sourceAccessForProfile({
  registry,connection,account,toolName,profile
}={}){
  if(!validConnection(connection)||!trustedRow(connection,account)||
     !CONNECTION_PROFILES.includes(profile))
    return {state:'invalid-verification-context',
      sourceEligible:false,providerPermission:'not-verified',
      note:'A currently authenticated account, environment and user-selected profile are required.'};
  if(typeof toolName!=='string'||!/^[a-z][a-z0-9_]{1,80}$/.test(toolName))
    return {state:'tool-unrecognized',sourceEligible:false,
      providerPermission:'not-verified'};
  const t=registry?.tools?.find(x=>x?.name===toolName);
  if(!t||!registered(registry,t))
    return {state:'tool-unimplemented',sourceEligible:false,
      providerPermission:'not-verified',
      recommended:actions.implementation};
  const c={...connection,profile};
  const permittedProfile=profileAllowed(t,profile);
  const write=boolean(t.writes);
  const originalGuard=write&&(isGuardedTestWrite(t,c)||isGuardedLiveWrite(t,c));
  const permitted=isToolAllowed(t,profile,{allowWrites:originalGuard})&&
    (!write||originalGuard);
  const reasons=[];
  if(!permittedProfile)reasons.push('profile-policy-selected');
  if(write&&profile==='read_only')reasons.push('user-read-only');
  if(write&&!originalGuard&&connection.mode==='test'&&permittedProfile)
    reasons.push('source-write-contract-or-operation-not-verified');
  if(write&&!originalGuard&&connection.mode==='live'&&permittedProfile){
    if(account.live_enabled!==true||account.live_connected!==true)
      reasons.push('live-account-not-independently-enabled');
    if(connection.rtcLiveOwnerApproved!==true)
      reasons.push('independent-live-write-consent-missing');
    if(financial(t)&&!(Number.isSafeInteger(connection.moneyLimitCents)&&
      connection.moneyLimitCents>0))
      reasons.push('independent-financial-grant-limit-missing');
    // Never assert a missing reason fully describes a denied LIVE route:
    // original source write allowlists and provider policy remain separate.
    reasons.push('additional-live-source-or-policy-guard');
  }
  if(!reasons.length&&!permitted)reasons.push('source-permission-unavailable');
  return {
    state:permitted?SOURCE_STATE.sourceEligible:SOURCE_STATE.sourceDenied,
    tool:t.name,area:t.area??'unclassified',
    requestedProfile:profile,mode:connection.mode,
    sourceEligible:permitted,writes:write,
    sourceWriteContract:write?(t.writeContract??'not-marked'):'not-required',
    sourceReasons:reasons,providerPermission:'not-verified',
    stripeEntitlement:'not-verified',
    providerExecution:'not-performed',ownerApproval:'not-performed',
    note:permitted?
      'Source profile/guard permits this candidate; actual provider credential, user policy, Stripe entitlements and independent provider response remain unverified.':
      'Source policy refuses this operation for the selected connection and mode; another profile alone may not resolve provider or owner controls.'
  };
}

/** Same account and mode throughout; profile comparisons NEVER alter stored grants. */
export function explainEffectiveAccess({
  registry,connection,account,toolName,includeProfiles=false
}={}){
  if(!validConnection(connection)||!trustedRow(connection,account))
    return {status:'denied',reason:'verified-connection-and-selected-account-required'};
  const source=sourceAccessForProfile({
    registry,connection,account,toolName,profile:connection.profile
  });
  if(['tool-unrecognized','tool-unimplemented'].includes(source.state))
    return {status:'unavailable',source,providerPermission:'not-verified',
      note:'Unknown or unimplemented tool; no provider operation attempted.'};
  const profileDiffs=includeProfiles===true?CONNECTION_PROFILES.map(p=>{
    const s=sourceAccessForProfile({registry,connection,account,toolName,profile:p});
    return {profile:p,sourceCandidate:s.sourceEligible,
      reasons:s.sourceReasons??[]};
  }):undefined;
  const recommendations=[];
  if(source.sourceReasons?.some(x=>x==='profile-policy-selected'||x==='user-read-only'))
    recommendations.push({layer:'chosen-profile',text:actions.reconnect});
  if(connection.mode==='live'&&source.sourceReasons?.some(x=>
    x.startsWith('live-')||x.startsWith('independent-live')))
    recommendations.push({layer:'independent-live-account-consent',text:actions.ownerLive});
  if(source.sourceReasons?.some(x=>x.includes('source-write-contract')))
    recommendations.push({layer:'missing-source',text:actions.implementation});
  recommendations.push({layer:'provider-grant-not-proven',text:actions.provider});
  if(source.writes&&financial(registry.tools.find(x=>x?.name===toolName)))
    recommendations.push({layer:'independent-money-approval',text:actions.money});
  return {
    status:'explained',selectedStripeAccount:connection.stripeAccount,
    mode:connection.mode,selectedProfile:connection.profile,
    source,...(profileDiffs?{comparison:profileDiffs}:{}),
    recovery:recommendations,changedGrants:false,
    issuedProviderCredential:false,ranProviderCall:false,
    note:'This diagnostic never signs in, changes user permissions, issues a credential or moves money.'
  };
}
