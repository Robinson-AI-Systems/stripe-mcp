// CAP-1: deterministic GA v1/v2 capability and acceptance backlog.
// A gap is never an entitlement, provider PASS, enabled tool or permission grant.
import { buildUnifiedReconciliation,validateUnifiedReconciliation }
  from './unified-capability.js';
import { evidenceForOperations,verifyOperationEvidence }
  from './operation-evidence.js';

const cmp=(a,b)=>a.localeCompare(b,'en');
const key=o=>o.method+' '+o.path;
const SOURCE_GAPS=new Set(['schema-only','schema-only-v2-no-generic-dispatch']);
const EFFECTS=new Set(['read','financial-or-irreversible-review-required',
  'mutation-with-unknown-provider-effect']);
const VALID_EVIDENCE=1;

export function buildOperationEvidenceReport({
  reconciled=buildUnifiedReconciliation()
}={}){
  if(!reconciled||!Array.isArray(reconciled.operations)||
     !Array.isArray(reconciled.families)||!reconciled.operations.length)
    throw new TypeError('A complete pinned GA reconciliation is required');
  const evidence=evidenceForOperations(reconciled.operations);
  const officialByKey=new Map(reconciled.operations.map(op=>[key(op),op]));
  if(officialByKey.size!==reconciled.operations.length)
    throw new Error('Duplicate official method/path keys');
  const families=new Map();
  const priorities=[];
  for(const e of evidence){
    const op=officialByKey.get(e.operation);
    verifyOperationEvidence(e,op);
    const family=op.family;
    let bucket=families.get(family);
    if(!bucket){
      bucket={family,apiVersion:op.apiVersion,operations:0,
        nativeCandidates:0,universalReadCandidates:0,
        sourceEngineeringGaps:0,providerScopeUnknown:0,
        testEvidenceUnlinked:0,deployedProviderUnverified:0,
        financialOrIrreversibleReviewNeeded:0};
      families.set(family,bucket);
    }
    bucket.operations++;
    if(e.source.disposition==='registered-native-handler-candidate')
      bucket.nativeCandidates++;
    if(e.source.disposition==='guarded-universal-v1-read-candidate')
      bucket.universalReadCandidates++;
    const sourceGap=SOURCE_GAPS.has(op.sourceStatus);
    if(sourceGap)bucket.sourceEngineeringGaps++;
    if(e.auth.requiredProviderScope==='unknown')bucket.providerScopeUnknown++;
    if(e.testEvidence.provider.disposition==='not-linked')bucket.testEvidenceUnlinked++;
    if(e.independentDeployedAcceptance.disposition==='not-joined-to-deployed-ledger')
      bucket.deployedProviderUnverified++;
    if(e.effect.class==='financial-or-irreversible-review-required')
      bucket.financialOrIrreversibleReviewNeeded++;
    priorities.push({
      operation:e.operation,apiVersion:op.apiVersion,
      family,sourceGap,
      sourceCandidate:op.sourceStatus,
      effect:e.effect.class,
      requiredCredentialPermissions:'unknown',
      realProviderAcceptance:'pending-independent-evidence',
      owner:'CAP-4-or-original-existing-unit-to-be-reconciled',
      nextAction:sourceGap
        ?'review-supported-endpoint-and-implement-complete-guarded-route'
        :'verify-provider-scope-and-source-specific-request-response-tests'
    });
  }
  const familyRows=[...families.values()].sort((a,b)=>cmp(a.family,b.family));
  // Show high-risk source gaps before read gaps; this is a research queue, not
  // a retry/permission/grant policy or permission to make financial writes.
  priorities.sort((a,b)=>Number(b.sourceGap)-Number(a.sourceGap)||
    Number(b.effect==='financial-or-irreversible-review-required')-
      Number(a.effect==='financial-or-irreversible-review-required')||
    cmp(a.operation,b.operation));
  const totals=familyRows.reduce((n,x)=>{
    for(const k of ['operations','nativeCandidates','universalReadCandidates',
      'sourceEngineeringGaps','providerScopeUnknown','testEvidenceUnlinked',
      'deployedProviderUnverified','financialOrIrreversibleReviewNeeded'])
      n[k]=(n[k]||0)+x[k];
    return n;
  },{});
  return {
    schemaVersion:VALID_EVIDENCE,
    officialSource:reconciled.officialSource,
    derivedBlobSha:reconciled.derivedBlobSha,
    counts:{
      v1:reconciled.counts.v1,v2:reconciled.counts.v2,
      gaOperations:reconciled.counts.operationCount,
      legacyPinnedSDK:reconciled.counts.legacyPinnedV1,
      sourceFamilies:familyRows.length,...totals
    },
    evidence,families:familyRows,priorities,
    outsidePublishedScope:[
      {type:'api-preview',disposition:'not-fully-enumerated-by-ga-spec'},
      {type:'organization-credential-context',disposition:'type-contract-documented-not-operation-scoped'},
      {type:'stripe-app-installation',disposition:'requires-independent-human-identity-and-provider-grant'}
    ],
    interpretation:'Immutable GA-pinned source and unknown authority inventory. No source candidate or test metadata certifies live execution, paid entitlement or permission.',
    neverClaimed:{percentage:null,providerPassesLinkedInsideThisSourceReport:0}
  };
}

export function validateOperationEvidenceReport(report,{
  reconciled=buildUnifiedReconciliation()
}={}){
  validateUnifiedReconciliation(reconciled);
  const expected=buildOperationEvidenceReport({reconciled});
  if(report?.schemaVersion!==VALID_EVIDENCE ||
     report?.evidence?.length!==reconciled.operations.length ||
     report?.priorities?.length!==reconciled.operations.length ||
     JSON.stringify(report)!==JSON.stringify(expected))
    throw new TypeError('CAP-1 evidence/gap/schema/authority drift detected');
  const sum=report.families.reduce((n,x)=>n+x.operations,0);
  if(sum!==reconciled.operations.length)
    throw new TypeError('Missing family or GA method/path');
  return {gaOperations:sum,families:report.families.length,
    v1:report.counts.v1,v2:report.counts.v2,
    note:'source and provider coverage must stay distinct'};
}
