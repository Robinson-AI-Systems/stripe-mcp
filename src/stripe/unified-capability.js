// Source reconciliation only. An OpenAPI descriptor is neither a credential
// grant nor proof of tool execution, including on a verified deployed revision.
import { loadUnifiedSource,validateUnifiedSource,UNIFIED_BLOB_SHA } from './unified-source.js';
import { buildCapabilityInventory } from './capability-inventory.js';
import { documentedCredentialRequirements } from './credential-context.js';

const sort=(a,b)=>a.family.localeCompare(b.family,'en');
export function buildUnifiedReconciliation({
  unified=loadUnifiedSource(), legacy=buildCapabilityInventory()
}={}){
  const check=validateUnifiedSource(unified);
  if(!Array.isArray(legacy?.operations)||!Array.isArray(legacy?.registeredTools))
    throw new TypeError('Pinned v1 source and real registry evidence required');
  const byPath=new Map(legacy.operations.map(o=>[o.method+' '+o.path,o]));
  if(byPath.size!==legacy.operations.length)
    throw new Error('Duplicate legacy method/path');
  const rows=unified.operations.map(op=>{
    const old=byPath.get(op.method+' '+op.path);
    const status = op.apiVersion==='v2' ? 'schema-only-v2-no-generic-dispatch' :
      old?.source?.disposition==='mapped-native-candidate' ?
      'mapped-native-source-candidate' :
      old?.source?.disposition==='guarded-universal-read-candidate' ?
      'guarded-v1-read-source-candidate' :
      'schema-only';
    return {
      method:op.method,path:op.path,
      apiVersion:op.apiVersion,officialOperationId:op.operationId,
      family:op.apiFamily,host:'api.stripe.com',summary:op.summary,
      sdkPinnedV1OperationId:old?.operationId??null,
      sourceStatus:status,
      nativeTool:status==='mapped-native-source-candidate'?old.source.nativeTool:null,
      credentials:documentedCredentialRequirements(op),permission:'unknown',entitlement:'unknown',
      verifiedProviderExecution:false,
      exactOperationTest:'not-linked',independentLiveAcceptance:'not-linked'
    };
  });
  const published=new Set(rows.map(o=>o.method+' '+o.path));
  const legacyOnly=legacy.operations.filter(o=>!published.has(o.method+' '+o.path))
    .map(o=>({method:o.method,path:o.path,operationId:o.operationId,
      note:'Only in pinned SDK v1 snapshot; may be SDK-only, older, or outside current published GA OpenAPI.'}));
  const byFamily=new Map();
  for(const row of rows){
    let entry=byFamily.get(row.family);
    if(!entry){entry={family:row.family,apiVersion:row.apiVersion,total:0,
      mappedNative:0,guardedReadCandidate:0,schemaOnly:0,
      providerPasses:0,credentialGrantCoverage:'unverified'};byFamily.set(row.family,entry);}
    entry.total++;
    if(row.sourceStatus==='mapped-native-source-candidate')entry.mappedNative++;
    else if(row.sourceStatus==='guarded-v1-read-source-candidate')entry.guardedReadCandidate++;
    else entry.schemaOnly++;
  }
  return {
    schemaVersion:1,officialSource:unified.upstream,
    derivedBlobSha:UNIFIED_BLOB_SHA,
    counts:{...check,legacyPinnedV1:legacy.operations.length,
      publishedWithoutLegacy:rows.filter(z=>z.sdkPinnedV1OperationId===null).length,
      legacyWithoutPublished:legacyOnly.length},
    operations:rows,families:[...byFamily.values()].sort(sort),
    legacyOnly,unmappedNativeTools:legacy.registeredTools.filter(t=>t.mappedPinnedOperations.length===0),
    note:'GA-public v1/v2 operation discovery only. Credential matrices, API preview, organization context, real tool behavior and deployed provider acceptance are NOT proven.'
  };
}
export function validateUnifiedReconciliation(result,{unified=loadUnifiedSource(),legacy=buildCapabilityInventory()}={}){
  const expected=buildUnifiedReconciliation({unified,legacy});
  if(JSON.stringify(result)!==JSON.stringify(expected))
    throw new Error('Reconciled provider inventory drift');
  return result.counts;
}
