// CAP-1 documentation-only credential eligibility. NEVER grants access or selects keys.
export const CREDENTIAL_TYPE_SOURCES=Object.freeze({
  account_secret:{source:'https://docs.stripe.com/keys',context:'own-account',requiredHeader:null,verifiedPermission:'unknown'},
  account_restricted:{source:'https://docs.stripe.com/keys',context:'own-account',requiredHeader:null,verifiedPermission:'unknown'},
  stripe_app_oauth:{source:'https://docs.stripe.com/stripe-apps/api-authentication',context:'installed-account',requiredHeader:null,verifiedPermission:'unknown'},
  connect_oauth:{source:'https://docs.stripe.com/connect/oauth-reference',context:'connected-account',requiredHeader:'Stripe-Account for verified platform-key delegation; OAuth access token deprecated',verifiedPermission:'unknown'},
  organization_secret:{source:'https://docs.stripe.com/keys/organization-api-keys',context:'organization-account',requiredHeader:'Stripe-Context + Stripe-Version',verifiedPermission:'unknown'}
});
export const CREDENTIAL_TYPES=Object.freeze(Object.keys(CREDENTIAL_TYPE_SOURCES));
const account=id=>typeof id==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(id);
const org=id=>typeof id==='string'&&/^org_[A-Za-z0-9]{2,100}$/.test(id);
const value=x=>typeof x==='string'&&x.length>0&&x.length<=128;
const opValid=o=>o&&/^(GET|POST|PUT|PATCH|DELETE)$/.test(o.method)&&
  typeof o.path==='string'&&/^\/v[12]\/[A-Za-z0-9_{}./-]+$/.test(o.path);
const refused=(kind,reason)=>({status:'denied-context',credential:kind??null,
  reason,providerPermission:'not-verified',canExecute:false});
export function documentedCredentialRequirements(operation){
  if(!opValid(operation))throw new TypeError('Exact published METHOD and /v1/ or /v2/ path required');
  return Object.fromEntries(CREDENTIAL_TYPES.map(kind=>[kind,{
    disposition:'unknown',providerSource:CREDENTIAL_TYPE_SOURCES[kind].source,
    binding:CREDENTIAL_TYPE_SOURCES[kind].context,
    requiredHeader:CREDENTIAL_TYPE_SOURCES[kind].requiredHeader,
    requiredPermission:'unknown',entitlement:'unknown',providerExecution:'not-observed',
    note:'Provider credential type evidence is NOT operation, user, role, product or account authorization.'
  }]));
}
/** Pure preflight. Even a context match cannot authorize Stripe API I/O. */
export function assessCredentialContext({operation,principal,selection,grant,now=Date.now()}={}){
  const kind=grant?.kind;
  if(!opValid(operation))return refused(kind,'unreviewed-operation');
  if(!CREDENTIAL_TYPES.includes(kind))return refused(kind,'unknown-credential-type');
  if(!principal||!selection||!grant||
     !value(principal.tenantId)||!value(principal.identityId)||
     !Number.isSafeInteger(principal.membershipRevision)||
     principal.membershipRevision<1||principal.membershipActive!==true||
     !account(selection.account)||!['test','live'].includes(selection.mode))
    return refused(kind,'unverified-human-tenant-or-selection');
  // Never accept a decrypted key/token or arbitrary unreviewed metadata as a grant.
  const permitted=new Set(['kind','tenantId','identityId','membershipRevision','host',
    'providerAccount','mode','identityVerified','accountVerified',
    'providerGrantVerified','revoked','expiresAt','fingerprint',
    'platformAccount','connectedAccount','verifiedContexts','orgId','approvedResources']);
  if(Object.keys(grant).some(k=>!permitted.has(k)))
    return refused(kind,'invalid-or-secret-bearing-grant-metadata');
  if(grant.tenantId!==principal.tenantId||
     grant.identityId!==principal.identityId||
     grant.membershipRevision!==principal.membershipRevision||
     grant.host!=='api.stripe.com'||grant.mode!==selection.mode||
     !value(grant.fingerprint)||grant.identityVerified!==true||
     grant.accountVerified!==true||grant.providerGrantVerified!==true||
     grant.revoked===true||
     (grant.expiresAt!=null&&(!Number.isFinite(Date.parse(grant.expiresAt))||
       Date.parse(grant.expiresAt)<=now)))
    return refused(kind,'stale-revoked-foreign-or-unverified-grant');
  if(['account_secret','account_restricted','stripe_app_oauth'].includes(kind)){
    if(grant.providerAccount!==selection.account||
       selection.organizationContext!=null||
       selection.connectedAccount!=null||selection.platformAccount!=null)
      return refused(kind,'cross-account-or-unreviewed-delegation');
  }
  if(kind==='connect_oauth'){
    if(!account(grant.platformAccount)||!account(grant.connectedAccount)||
       grant.platformAccount!==selection.platformAccount||
       grant.connectedAccount!==selection.account||
       grant.connectedAccount!==selection.connectedAccount||
       grant.providerAccount!==selection.account||
       !Array.isArray(grant.approvedResources)||
       !grant.approvedResources.includes(grant.platformAccount+'/'+grant.connectedAccount))
      return refused(kind,'connect-platform-account-not-verified');
  }
  if(kind==='organization_secret'){
    const target=selection.platformAccount==null?selection.account:
      selection.platformAccount+'/'+selection.account;
    if(!org(grant.orgId)||
       (selection.platformAccount!=null&&!account(selection.platformAccount))||
       selection.organizationContext!==target||
       grant.providerAccount!==selection.account||
       !Array.isArray(grant.verifiedContexts)||
       !grant.verifiedContexts.includes(target))
      return refused(kind,'organization-stripe-context-not-verified');
  }
  return {status:'context-candidate-only',credential:kind,
    providerSource:CREDENTIAL_TYPE_SOURCES[kind].source,
    providerPermission:'not-verified',entitlement:'unknown',canExecute:false,
    next:['review-operation-specific-permissions','confirm-provider-entitlement',
      'apply-actual-user-policy','prove-provider-readback']};
}
