// V-3: verify a finite set of existing original TEST Stripe Event runs without
// triggering provider writes, trusting historical ledger flags or hiding failures.
import {verifyRecordedTriggerRun} from '../dev/triggers.js';
import {client,reply,allProfiles} from './billing-shared.js';
import {gone} from './write.js';

const id=x=>typeof x==='string'&&/^run_[a-f0-9]{24}$/.test(x);
export const tools=[{
  name:'dev_verify_trigger_runs',area:'developer',writes:false,profiles:allProfiles,
  annotations:{readOnlyHint:true},
  description:'Independently re-fetch original Stripe TEST Events for 1–10 exact run IDs; report each verified or unverified run separately, without recreating sources.',
  inputSchema:{type:'object',properties:{
    runIds:{type:'array',minItems:1,maxItems:10,uniqueItems:true,
      items:{type:'string',pattern:'^run_[a-f0-9]{24}$'}}
  },required:['runIds'],additionalProperties:false}
}];
export const handlers={
  async dev_verify_trigger_runs(a,ctx){
    const account=ctx?.connection?.stripeAccount;
    if(ctx?.connection?.mode!=='test'||!/^acct_[A-Za-z0-9]{2,100}$/.test(account??''))
      return gone('Selected TEST Stripe account required');
    if(!a||typeof a!=='object'||Array.isArray(a)||
      Object.keys(a).length!==1||!Array.isArray(a.runIds)||
      a.runIds.length<1||a.runIds.length>10||
      a.runIds.some(x=>!id(x))||new Set(a.runIds).size!==a.runIds.length)
      return gone('Choose 1–10 distinct exact TEST run IDs');
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
        results.push({runId,verification:'provider_verified',
          type:verified.type,eventId:verified.eventId,
          sourceType:verified.sourceType,sourceId:verified.sourceId,
          sourceCleanedInLedger:verified.sourceCleaned,
          immutableEventRetained:true,webhookDeliveryVerified:false});
      }catch{
        // Never expose SDK errors, foreign run existence, tokens or raw events.
        // An unverified event may have occurred; no negative inference.
        results.push({runId,verification:'unverified',providerVerified:false,
          reason:'Independent TEST Event verification unavailable or inconclusive'});
      }
    }
    const verifiedCount=results.filter(x=>x.verification==='provider_verified').length;
    return reply({mode:'test',requested:results.length,verifiedCount,
      unverifiedCount:results.length-verifiedCount,
      allProviderVerified:verifiedCount===results.length,results,
      note:'Only provider_verified rows independently re-fetched matching original Stripe Events. Source cleanup flags come from the TEST ledger; no webhook delivery, current mutable source state or payment settlement is inferred. No provider writes occurred.'});
  }
};
