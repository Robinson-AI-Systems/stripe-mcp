// V-3: reconcile a Stripe-generated TEST Event that already exists but was
// not persisted before the old trigger returned. No provider write is issued.
import {defineWrite,gone} from './write.js';
import {client,writeProfiles} from './billing-shared.js';
import {resolveTriggerPlan,triggerTypes,inspectIncompleteOriginalEvent,
  verifyRecordedTriggerRun} from '../dev/triggers.js';

const planOf=async(a,ctx)=>{
  const account=ctx?.connection?.stripeAccount;
  if(ctx?.connection?.mode!=='test'||!/^acct_[A-Za-z0-9]+$/.test(account??''))
    throw new TypeError('Owning original TEST account required');
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!['runId','requestKey','confirm','dryRun'].includes(k))||
    !/^run_[a-f0-9]{24}$/.test(a.runId??'')||
    a.requestKey!=='reconcile_'+a.runId||
    typeof ctx.db?.getDevRunById!=='function'||
    typeof ctx.db?.getDevRunObjects!=='function'||
    typeof ctx.db?.reconcileVerifiedTriggerEvent!=='function')
    throw new TypeError('Exact original run and canonical reconciliation key required');
  const run=await ctx.db.getDevRunById({account,id:a.runId});
  if(!run||run.stripe_account!==account||run.id!==a.runId||
    run.status!=='running'||run.size!==1||
    typeof run.request_key!=='string'||run.request_key.length<1||
    run.request_key.length>128)
    throw new TypeError('No eligible selected-account running TEST Event');
  const type=triggerTypes.find(x=>
    'event-'+x.replaceAll('_','-').replaceAll('.','-')===run.scenario);
  if(!type)throw new TypeError('Original scenario is unsupported');
  const plan=resolveTriggerPlan({type,requestKey:run.request_key},account,run);
  if(plan.runId!==run.id||plan.scenario!==run.scenario||
    plan.planDigest!==run.plan_digest||plan.expectedSteps<2||
    plan.steps.at(-1)?.type!=='event')
    throw new TypeError('Original immutable plan mismatch');
  const rows=await ctx.db.getDevRunObjects({account,id:run.id});
  if(!Array.isArray(rows)||rows.length!==plan.expectedSteps-1||
    new Set(rows.map(row=>row.step_name)).size!==rows.length||
    !plan.steps.slice(0,-1).every(step=>rows.some(row=>
      row.step_name===step.name&&row.object_type===step.type&&
      typeof row.cleaned==='boolean')))
    throw new TypeError('Incomplete or inconsistent source ledger');
  const original=await inspectIncompleteOriginalEvent({
    plan,rows,account,stripe:await client(ctx)});
  if(original.verification!=='provider_verified'||original.type!==type||
    !/^evt_[A-Za-z0-9]{2,100}$/.test(original.eventId??''))
    throw new TypeError('No independently retrieved original provider Event');
  return {id:run.id,metadata:{},account,scenario:run.scenario,
    planDigest:run.plan_digest,expectedSteps:plan.expectedSteps,
    eventId:original.eventId,type};
};

const op=defineWrite({
  name:'dev_reconcile_original_event',
  resultId:(_before,after)=>after?.runId,
  read:planOf,
  summarize:b=>'TEST MODE. Link original verified Stripe Event '+b.eventId+
    ' to existing run '+b.id+'. Only the selected TEST evidence ledger '+
    'changes. No Stripe objects, payments, customer email, money or cleanup '+
    'are created, retried or changed. No signed webhook proof is implied.',
  apply:async(_a,ctx,{before})=>{
    if(!await ctx.db.reconcileVerifiedTriggerEvent({
      account:before.account,id:before.id,scenario:before.scenario,
      planDigest:before.planDigest,expectedSteps:before.expectedSteps,
      eventId:before.eventId}))
      throw new TypeError('Atomic reconciliation rejected or already recorded');
  },
  readAfter:async(a,ctx)=>verifyRecordedTriggerRun({
    runId:a.runId},ctx,await client(ctx)),
  verify:(b,a)=>a?.providerVerified===true&&
    a.runId===b.id&&a.eventId===b.eventId&&
    a.type===b.type&&a.immutableEventRetained===true&&
    a.webhookDeliveryVerified===false
});

export const tools=[{...op.tool,area:'developer',profiles:writeProfiles,
  description:'Reconcile an existing independently verified original TEST Event into its immutable run ledger.',
  inputSchema:{type:'object',properties:{
    runId:{type:'string',pattern:'^run_[a-f0-9]{24}$'},
    requestKey:{type:'string',minLength:1,maxLength:128},
    confirm:{type:'boolean'},dryRun:{type:'boolean'}
  },required:['runId','requestKey'],additionalProperties:false}}];
export const handlers={
  dev_reconcile_original_event:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Original Event reconciliation requires TEST mode'):
    op.handler(a,ctx)
};
