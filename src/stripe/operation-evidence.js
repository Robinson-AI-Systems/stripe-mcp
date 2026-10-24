// CAP-1: an offline operation-specific evidence record. This module never executes Stripe.
import { financialDecision } from './money-operations.js';
import { documentedCredentialRequirements } from './credential-context.js';

const VALID_METHODS=new Set(['GET','POST','PUT','PATCH','DELETE']);
const ACTIVE_SOURCE=new Set(['mapped-native-source-candidate',
  'guarded-v1-read-source-candidate','schema-only',
  'schema-only-v2-no-generic-dispatch']);
const invalid=reason=>{throw new TypeError('CAP-1 operation evidence: '+reason);};
const key=o=>o.method+' '+o.path;
const copy=x=>JSON.parse(JSON.stringify(x));

export function operationEvidence(official){
  if(!official||!VALID_METHODS.has(official.method)||
     typeof official.path!=='string'||
     !/^\/v[12]\/[A-Za-z0-9_{}./-]+$/.test(official.path)||
     official.apiVersion!==official.path.split('/')[1]||
     typeof official.officialOperationId!=='string'||
     !official.officialOperationId||
     !ACTIVE_SOURCE.has(official.sourceStatus)||
     (official.sourceStatus==='mapped-native-source-candidate'&&
       (typeof official.nativeTool!=='string'||!official.nativeTool)))
    invalid('a pinned official method/path/source candidate is required');
  const actual=financialDecision({method:official.method,path:official.path,
    id:official.officialOperationId,summary:official.summary});
  const effect=official.method==='GET'?'read':
    actual.financial?'financial-or-irreversible-review-required':
      'mutation-with-unknown-provider-effect';
  const classed=official.sourceStatus==='mapped-native-source-candidate'
    ?'registered-native-handler-candidate':
    official.sourceStatus==='guarded-v1-read-source-candidate'
      ?'guarded-universal-v1-read-candidate':'not-implemented-by-this-evidence';
  return {
    operation:key(official),providerVersion:official.apiVersion,
    officialOperationId:official.officialOperationId,
    provenance:'immutable-stripe-ga-public-openapi',
    officialHost:'api.stripe.com',ownerUnit:'requires-original-roadmap-reconciliation',
    lifecycle:'published-ga-as-snapshotted',
    source:{
      disposition:classed,
      claimedNativeTool:classed==='registered-native-handler-candidate'
        ?official.nativeTool:null,
      handlerRegistered:classed==='registered-native-handler-candidate'||
        classed==='guarded-universal-v1-read-candidate',
      requestTranslation:'not-independently-reviewed',
      completeGuardAndReadback:'not-independently-proven',
      executableProviderCoverage:'unverified'
    },
    auth:{
      documentedCredentialKinds:documentedCredentialRequirements(official),
      verifiedPrincipal:'independent-human-and-tenant-required',
      selectedStripeAccount:'exact-provider-verified-account-required',
      environment:'explicit-test-or-live-from-verified-grant',
      connectedAccount:'separate-provider-verified-platform-relationship-if-used',
      organizationContext:'exact-Stripe-Context-and-version-if-org-key',
      requiredProviderScope:'unknown',
      roleOrOrganizationMembership:'unknown',
      productCountryEntitlement:'unknown',
      effectiveProviderPermission:'unverified'
    },
    effect:{
      class:effect,
      independentMoneyOwnerApproval:official.method==='GET'
        ?'not-applicable':
        actual.financial?'must-review-and-apply-existing-independent-approval':
          'must-review-operation-before-execution',
      actualMoneyMoved:'not-executed'
    },
    testEvidence:{
      unit:{disposition:'not-linked',references:[]},
      mock:{disposition:'not-linked',references:[]},
      database:{disposition:'not-linked',references:[]},
      provider:{disposition:'not-linked',references:[]}
    },
    independentDeployedAcceptance:{
      disposition:'not-joined-to-deployed-ledger',
      deployedRevision:null,verifiedPrincipal:null,readback:null,
      reason:'CI source checks are not a real authorized provider request'
    }
  };
}

/** Reject fabricated credential permissions or provider evidence in an offline report. */
export function verifyOperationEvidence(row,official){
  if(!row||!official||row.operation!==key(official)||
     row.providerVersion!==official.apiVersion||
     row.officialOperationId!==official.officialOperationId)
    invalid('operation or source mismatch');
  const expected=operationEvidence(official);
  if(JSON.stringify(row)!==JSON.stringify(expected))
    invalid('claim changed without reviewed provider/source/acceptance evidence');
  return {operation:row.operation,source:'pinned-ga',
    providerAcceptance:'unverified'};
}

/** Output is a value copy; no source catalog or registry can be mutated through the report. */
export function evidenceForOperations(officialRows){
  if(!Array.isArray(officialRows)||!officialRows.length)
    invalid('complete published GA rows required');
  const seen=new Set();
  return officialRows.map(op=>{
    const k=key(op);
    if(seen.has(k))invalid('duplicate operation key');
    seen.add(k);
    return copy(operationEvidence(op));
  });
}
