// V-5b guarded setup phase. V-5c extends verified three-month advancement.
import {defineWrite,gone} from './write.js';
import {client,writeProfiles,reply} from './billing-shared.js';
import {planSubscriptionSimulation,executeSubscriptionSetup}
  from '../dev/subscription-sim.js';
import {makeAdvanceWrite,inspectSimulation}
  from './dev-simulation-advance.js';
const dbMethods=['getDevRun','ensureDevRun','recordDevRunObject',
  'getDevRunObjects','completeDevRun'];
export function makeSimulationSetupWrite(){
  const op=defineWrite({
    name:'dev_simulate_subscription',
    read:async(a,ctx)=>{
      if(ctx?.connection?.mode!=='test')throw new TypeError('TEST mode only');
      const p=planSubscriptionSimulation(a,ctx.connection.stripeAccount);
      if(dbMethods.some(method=>typeof ctx.db?.[method]!=='function'))
        throw new TypeError('Durable run and per-object cleanup ledger required');
      const prior=await ctx.db.getDevRun({account:p.account,requestKey:a.requestKey});
      if(prior&&(prior.id!==p.runId||prior.plan_digest!==p.planDigest||
        prior.scenario!==p.scenario||prior.size!==p.months||
        prior.status==='uncertain'))
        throw new TypeError('Retry key is immutable or prior TEST outcome uncertain');
      return {...p,prior,metadata:{}};
    },
    summarize:p=>'TEST MODE. Prepare isolated synthetic '+p.months+
      '-month subscription simulation for $'+(p.amountCents/100).toFixed(2)+
      '/month, method '+p.card+', frozen at '+p.frozenTime+
      '. Will create a tracked TEST clock, product, recurring price, '+
      'customer and one-day free-trial subscription. No invoice charge in this '+
      'setup phase. No app-owned objects touched. Every created ID is independently '+
      'verified and tracked for cleanup; monthly time travel is V-5c.',
    apply:async(_a,ctx,{before,idempotencyKey})=>{
      await executeSubscriptionSetup({p:before,ctx,stripe:await client(ctx),
        rootKey:idempotencyKey});
    },
    readAfter:async(a,ctx)=>{
      const p=planSubscriptionSimulation(a,ctx.connection.stripeAccount);
      const run=await ctx.db.getDevRun({account:p.account,requestKey:p.requestKey});
      if(!run)return null;
      const objects=await ctx.db.getDevRunObjects({account:p.account,id:p.runId});
      return {...run,objects};
    },
    verify:(p,after)=>after?.id===p.runId&&
      after.plan_digest===p.planDigest&&after.status==='completed'&&
      Array.isArray(after.objects)&&after.objects.length===p.steps.length&&
      p.steps.every(x=>after.objects.some(y=>
        y.step_name===x.stepName&&y.object_type===x.objectType&&!y.cleaned))
  });
  return {...op,async handler(a,ctx){
    if(ctx?.connection?.mode!=='test')
      return gone('Subscription simulation is TEST-only');
    const raw=await op.handler(a,ctx);
    if(raw?.isError||a?.confirm!==true||a?.dryRun===true)return raw;
    const value=JSON.parse(raw.content[0].text);
    if(value.done!==true)return raw;
    const p=planSubscriptionSimulation(a,ctx.connection.stripeAccount);
    const objects=await ctx.db.getDevRunObjects({account:p.account,id:p.runId});
    return reply({...value,runId:p.runId,phase:'setup',
      months:p.months,objectIds:Object.fromEntries(objects.map(x=>[
        x.object_type,x.object_id])),
      note:'Setup verified. No monthly clock advance or payment success claimed.'});
  }};
}
export const tools=[{
  ...makeSimulationSetupWrite().tool,area:'developer',profiles:writeProfiles,
  description:'Guarded TEST subscription setup, one-cycle clock advance and progress inspection. Billing verification is V-5c3.',
  inputSchema:{type:'object',properties:{
    months:{type:'integer',minimum:1,maximum:3},
    amountCents:{type:'integer',minimum:100,maximum:50000},
    card:{type:'string',enum:['pm_card_visa','pm_card_chargeCustomerFail']},
    frozenTime:{type:'integer',minimum:946684800,maximum:4093804800},
    action:{type:'string',enum:['setup','advance','inspect']},
    runId:{type:'string',pattern:'^run_[a-f0-9]{24}
    confirm:{type:'boolean'},dryRun:{type:'boolean'}
  },oneOf:[
    {properties:{action:{enum:['setup']}},required:['months','amountCents','card','frozenTime','requestKey']},
    {properties:{action:{const:'advance'}},required:['action','runId','cycle','requestKey']},
    {properties:{action:{const:'inspect'}},required:['action','runId']}
  ],additionalProperties:false}
}];
export const handlers={
  dev_simulate_subscription:(a,ctx)=>{
    if(a?.action==='advance')return makeAdvanceWrite().handler(a,ctx);
    if(a?.action==='inspect')return inspectSimulation(a,ctx);
    if(a?.action!==undefined&&a.action!=='setup')return gone('Unsupported simulation action');
    const {action:_ignored,...setup}=a??{};
    return makeSimulationSetupWrite().handler(setup,ctx);
  }
};
},
    cycle:{type:'integer',minimum:1,maximum:3},
    requestKey:{type:'string',minLength:1,maxLength:128},
    confirm:{type:'boolean'},dryRun:{type:'boolean'}
  },required:['months','amountCents','card','frozenTime','requestKey'],
  additionalProperties:false}
}];
export const handlers={
  dev_simulate_subscription:(a,ctx)=>makeSimulationSetupWrite().handler(a,ctx)
};
