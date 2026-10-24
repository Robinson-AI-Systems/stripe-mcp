// CAP-3 pre-provider grant selection: explicit owned descriptor, never execution.
// Future HTTP/OIDC integration may render these safe diagnostics; it must not
// treat a matching metadata descriptor as an authorized Stripe bearer.
import { documentedCredentialRequirements } from '../stripe/credential-context.js';

const roles=new Set(['owner','administrator','member','developer']);
const modes=new Set(['test','live']);
const kindNames=new Set(['account_secret','account_restricted',
  'stripe_app_oauth','connect_oauth','organization_secret']);
const own=id=>typeof id==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(id);
const grantId=x=>typeof x==='string'&&/^grant_[a-f0-9-]{36}$/.test(x);
const output=(status,reason,details={})=>Object.freeze({
  status,reason,canExecute:false,providerPermission:'unverified',...details
});
/**
 * This method does not select a credential: a caller MUST provide an exact
 * grant ID and authenticated principal/context. A current membership is
 * checked in the DB before reading any descriptor. All outputs are
 * non-executable even if the database row happens to be marked verified.
 */
export async function inspectOwnedGrant({
  tenancy,identity,tenantId,context,revision,clientId,grant,
  account,mode,operation,profile='read_only'
}={}){
  const selectionFields={tenantId,identity,context,revision};
  if(!tenancy||typeof tenancy.getMembership!=='function'||
     typeof tenancy.listGrants!=='function'||!identity||
     typeof tenantId!=='string'||!Number.isSafeInteger(revision)||
     !['read_only','everyday','full'].includes(profile)||!modes.has(mode)||
     !own(account)||!grantId(grant)||typeof clientId!=='string'||
     clientId.length<1||clientId.length>128)
    return output('denied','unverified-selection-or-missing-exact-grant');
  let scope;
  try {scope=documentedCredentialRequirements(operation);}
  catch {return output('denied','unsupported-or-unreviewed-stripe-operation');}
  const membership=await tenancy.getMembership({
    tenantId,identity,context
  });
  if(!membership||!roles.has(membership.role)||
     membership.revision!==revision)
    return output('denied','membership-inactive-or-stale');
  // Existing account, exact mode and current membership checked by the
  // database query. Deliberately do not auto-select a broader grant.
  const rows=await tenancy.listGrants({...selectionFields,account,mode});
  const matching=rows.filter(row=>row?.id===grant);
  if(matching.length!==1)
    return output('denied','exact-owned-grant-unavailable-or-revoked');
  const selected=matching[0];
  if(selected.tenant_id!==tenantId||
     selected.principal_id!==membership.principal_id||
     selected.context!==context||selected.stripe_account!==account||
     selected.mode!==mode||!kindNames.has(selected.kind)||
     selected.membership_revision!==revision)
    return output('denied','foreign-or-stale-provider-grant');
  if(profile==='read_only'&&operation.method!=='GET')
    return output('denied','read-only-policy-refuses-mutation');
  const requirements=scope[selected.kind];
  const recovery=selected.status==='pending_verification'?
    'Finish provider-owned Stripe authorization; verify account, issuer, permission and current human membership.':
    'Review actual Stripe operation scope, product entitlement, mode and user-approved policy before granting access.';
  return output('needs-provider-proof', 'no-executable-verified-credential',
    {kind:selected.kind,account,mode,context,requestedProfile:profile,
      operation:operation.method+' '+operation.path,
      documentedRequirement:requirements.disposition,
      providerEntitlement:'unknown',providerGrantState:selected.status,
      recovery});
}
