// V-3: verify a finite set of existing original TEST Stripe Event runs without
// triggering provider writes, trusting historical ledger flags or hiding failures.
import {verifyRecordedTriggerRun} from '../dev/triggers.js';
import {client,reply,allProfiles} from './billing-shared.js';
import {gone} from './write.js';
import {handlers as cleanupHandlers} from './dev-cleanup-inspection.js';
import {handlers as recoveryHandlers} from './dev-incomplete-inspection.js';

const id=x=>typeof x==='string'&&/^run_[a-f0-9]{24}$/.test(x);
const safeStep=x=>typeof x==='string'&&/^[a-z_]+_[1-9][0-9]?$/.test(x);
const cleanupStates=new Set([
  'verified_cleaned','intentionally_retained','pending_cleanup',
  'provider_unverified','ledger_mismatch','ledger_pending'
]);
const safeInt=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;

// The original tool responses may contain provider/source IDs and error
// details. Return only validated finite classifications from follow-up reads.
function nativeRead(response,runId){
  if(response?.isError===true)throw new TypeError('Original TEST follow-up unavailable');
  const result=JSON.parse(response?.content?.[0]?.text??'null');
  if(result?.runId!==runId||result.mode!=='test')
    throw new TypeError('Original TEST follow-up identity differs');
  return result;
}
function cleanupSummary(response,runId){
  const evidence=nativeRead(response,runId);
  if(evidence.eventProviderVerified!==true||
    typeof evidence.allEligibleCleanedAndVerified!=='boolean'||
    !Array.isArray(evidence.rows)||evidence.rows.length<2||
    evidence.rows.length>12)
    throw new TypeError('TEST cleanup evidence cannot be verified');
  const byStep=new Set();
  const rows=evidence.rows.map(row=>{
    if(!safeStep(row.step)||typeof row.type!=='string'||
      !/^[a-z_]{2,32}$/.test(row.type)||
      !cleanupStates.has(row.verification)||
      byStep.has(row.step))
      throw new TypeError('Unsafe or inconsistent TEST cleanup row');
    byStep.add(row.step);
    return {step:row.step,type:row.type,verification:row.verification};
  });
  const cleanedCount=rows.filter(x=>x.verification==='verified_cleaned').length;
  const retainedCount=rows.filter(x=>x.verification==='intentionally_retained').length;
  const unresolved=rows.filter(x=>
    !['verified_cleaned','intentionally_retained'].includes(x.verification));
  if(evidence.allEligibleCleanedAndVerified!==(unresolved.length===0))
    throw new TypeError('TEST cleanup aggregate contradicts original rows');
  return {verification:unresolved.length===0?'provider_verified':'needs_attention',
    allEligibleCleanedAndVerified:unresolved.length===0,
    cleanedCount,retainedCount,needsAttentionCount:unresolved.length,rows};
}
function recoverySummary(response,runId){
  const snapshot=nativeRead(response,runId);
  if(!['running','uncertain'].includes(snapshot.runStatus)||
    !safeInt(snapshot.expectedSteps,2,12)||
    !safeInt(snapshot.recordedSteps,0,snapshot.expectedSteps)||
    !safeInt(snapshot.verifiedCount,0,snapshot.recordedSteps)||
    !safeInt(snapshot.unverifiedCount,0,snapshot.recordedSteps)||
    snapshot.verifiedCount+snapshot.unverifiedCount!==snapshot.recordedSteps||
    !Array.isArray(snapshot.missingSteps)||
    snapshot.missingSteps.length>snapshot.expectedSteps||
    snapshot.missingSteps.some(x=>!safeStep(x)))
    throw new TypeError('Invalid original incomplete TEST snapshot');
  const original=snapshot.originalEvent?.verification;
  if(original!==undefined&&
    !['provider_verified','provider_unverified'].includes(original))
    throw new TypeError('Invalid original Event verification state');
  return {verification:'inspected',runStatus:snapshot.runStatus,
    expectedSteps:snapshot.expectedSteps,recordedSteps:snapshot.recordedSteps,
    verifiedSourceCount:snapshot.verifiedCount,
    unverifiedSourceCount:snapshot.unverifiedCount,
    missingSteps:snapshot.missingSteps,
    originalEventVerification:original??'not_checked',
    note:'An inspected unfinished run is not completed, retried, or cleaned.'};
}
const unavailableCleanup=()=>({verification:'unverified',
  allEligibleCleanedAndVerified:false});
const unavailableRecovery=()=>({verification:'unavailable',
  originalEventVerification:'provider_unverified'});
export const tools=[{
  name:'dev_verify_trigger_runs',area:'developer',writes:false,profiles:allProfiles,
  annotations:{readOnlyHint:true},
  description:'Verify 1–10 original TEST Events; optionally inspect cleanup and unfinished runs in bounded four-run read-only batches.' ,
  inputSchema:{type:'object',properties:{
    runIds:{type:'array',minItems:1,maxItems:10,uniqueItems:true,
      items:{type:'string',pattern:'^run_[a-f0-9]{24}$'}},
    includeCleanup:{type:'boolean',
      description:'Independently read provider cleanup after original Event verification; maximum four runs.'},
    includeIncomplete:{type:'boolean',
      description:'On unverified original Event, safely inspect unfinished run sources and original Event; maximum four runs.'}
  },required:['runIds'],additionalProperties:false}
}];
export const handlers={
  async dev_verify_trigger_runs(a,ctx){
    const account=ctx?.connection?.stripeAccount;
    if(ctx?.connection?.mode!=='test'||!/^acct_[A-Za-z0-9]{2,100}$/.test(account??''))
      return gone('Selected TEST Stripe account required');
    if(!a||typeof a!=='object'||Array.isArray(a)||
      Object.keys(a).some(k=>!['runIds','includeCleanup','includeIncomplete'].includes(k))||
      (a.includeCleanup!==undefined&&typeof a.includeCleanup!=='boolean')||
      (a.includeIncomplete!==undefined&&typeof a.includeIncomplete!=='boolean')||
      !Array.isArray(a.runIds)||
      a.runIds.length<1||a.runIds.length>10||
      ((a.includeCleanup===true||a.includeIncomplete===true)&&
        a.runIds.length>4)||
      a.runIds.some(x=>!id(x))||new Set(a.runIds).size!==a.runIds.length)
      return gone('Choose 1–10 exact run IDs, or at most four when including cleanup or incomplete inspection');
    if(typeof ctx.db?.getDevRunById!=='function'||
      typeof ctx.db?.getDevRunObjects!=='function')
      return gone('Account-scoped TEST run ledger unavailable');
    // One configured, selected-account TEST client. Every provider read inside
    // verifyRecordedTriggerRun checks its original immutable plan and Event.
    const stripe=await client(ctx),results=[];
    for(const runId of a.runIds){
      try{
        const verified=await verifyRecordedTriggerRun({runId},ctx,stripe);
        if(verified.providerVerified!==true||
          verified.runId!==runId||verified.mode!=='test'||
          verified.immutableEventRetained!==true)
          throw new TypeError('TEST provider verification not established');
        const row={runId,verification:'provider_verified',
          type:verified.type,eventId:verified.eventId,
          sourceType:verified.sourceType,sourceId:verified.sourceId,
          sourceCleanedInLedger:verified.sourceCleaned,
          immutableEventRetained:true,webhookDeliveryVerified:false};
        if(a.includeCleanup===true){
          try{
            const response=await cleanupHandlers.dev_verify_cleanup_run({runId},ctx);
            row.cleanup=cleanupSummary(response,runId);
          }catch{
            row.cleanup=unavailableCleanup();
          }
        }
        results.push(row);
      }catch{
        // Never expose SDK errors, foreign run existence, tokens or raw events.
        // An unverified event may have occurred; no negative inference.
        const row={runId,verification:'unverified',providerVerified:false,
          reason:'Independent TEST Event verification unavailable or inconclusive'};
        if(a.includeIncomplete===true){
          try{
            const response=await recoveryHandlers.dev_inspect_incomplete_run({
              runId,includeOriginalEvent:true},ctx);
            row.incomplete=recoverySummary(response,runId);
          }catch{
            row.incomplete=unavailableRecovery();
          }
        }
        results.push(row);
      }
    }
    const verifiedCount=results.filter(x=>x.verification==='provider_verified').length;
    const cleanupRows=results.map(x=>x.cleanup).filter(Boolean);
    const incompleteRows=results.map(x=>x.incomplete).filter(Boolean);
    const cleanupVerifiedCount=cleanupRows.filter(x=>
      x.verification==='provider_verified').length;
    const incompleteInspectedCount=incompleteRows.filter(x=>
      x.verification==='inspected').length;
    return reply({mode:'test',requested:results.length,verifiedCount,
      unverifiedCount:results.length-verifiedCount,
      allProviderVerified:verifiedCount===results.length,
      ...(a.includeCleanup===true?{cleanupVerifiedCount,
        cleanupNeedsAttentionCount:cleanupRows.filter(x=>
          x.verification==='needs_attention').length,
        cleanupUnverifiedCount:cleanupRows.length-cleanupVerifiedCount-
          cleanupRows.filter(x=>x.verification==='needs_attention').length}:{}),
      ...(a.includeIncomplete===true?{incompleteInspectedCount,
        incompleteUnavailableCount:incompleteRows.length-
          incompleteInspectedCount}:{}),
      results,
      note:'Original provider_verified requires separately fetched exact original TEST Event. Optional cleanup verifies current provider source states against ledger; incomplete inspection never completes a run or authorizes retry. No signed webhook, settlement, account money movement, automatic cleanup or live-mode acceptance is inferred.'});
  }
};
