// V-1a current-native TEST tracked developer catalog seeding.
import {defineWrite,gone} from './write.js';
import {client,writeProfiles} from './billing-shared.js';
import {planSeed,seedDescription,executeSeed,seedScenarios}
  from '../dev/scenarios.js';
const profiles=['read_only','everyday','full'];
const reply=x=>({content:[{type:'text',text:JSON.stringify(x)}]});
const scenario={type:'string',enum:seedScenarios};
const description={type:'string',minLength:3,maxLength:256};
const size={type:'integer',minimum:1,maximum:5};
const retry={type:'string',minLength:1,maxLength:128};
const op=defineWrite({
  name:'dev_seed',allowZeroPreview:true,
  read:async(a,ctx)=>{
    if(ctx?.connection?.mode!=='test'||!ctx?.connection?.stripeAccount)
      throw new TypeError('Developer seeding is only available in TEST mode');
    if(typeof ctx.db?.ensureDevRun!=='function'||
      typeof ctx.db?.getDevRunObjects!=='function')
      throw new TypeError('Durable TEST run store is unavailable');
    if(!a||Object.keys(a).some(k=>![
      'scenario','description','size','requestKey','dryRun','confirm'
    ].includes(k)))throw new TypeError('Unsupported seed argument');
    const plan=planSeed(a,ctx.connection.stripeAccount);
    const prior=await ctx.db.getDevRun({
      account:ctx.connection.stripeAccount,requestKey:a.requestKey});
    if(prior&&(prior.id!==plan.runId||prior.plan_digest!==plan.planDigest||
      prior.scenario!==plan.scenario||prior.size!==plan.size))
      throw new TypeError('Existing seed run differs from requested immutable plan');
    return {id:plan.runId,metadata:{},...plan,_prior:prior};
  },
  summarize:b=>seedDescription(b),
  money:async(_a,_ctx,b)=>b.amountCents>0?{
    amountCents:b.amountCents,currency:'usd',direction:'in',targetId:b.runId,
    description:'Synthetic incoming TEST store card payments (tracked run)'
  }:null,
  targetGuard:(_a,_ctx,b)=>b._prior?.status==='uncertain'?
    'Run has an uncertain outcome; manual review required':true,
  apply:async(a,ctx,{before,idempotencyKey})=>{
    const account=ctx.connection.stripeAccount;
    const run=await ctx.db.ensureDevRun({id:before.runId,account,
      connection:ctx.connectionId??null,requestKey:a.requestKey,
      scenario:before.scenario,size:before.size,planDigest:before.planDigest});
    const stripe=await client(ctx);
    await executeSeed({plan:before,run,stripe,db:ctx.db,account,
      rootKey:idempotencyKey});
  },
  readAfter:async(a,ctx)=>{
    const account=ctx.connection.stripeAccount;
    const run=await ctx.db.getDevRun({account,requestKey:a.requestKey});
    if(!run)return null;
    return {...run,objects:await ctx.db.getDevRunObjects({account,id:run.id})};
  },
  verify:(b,after)=>after?.id===b.runId&&
    after.plan_digest===b.planDigest&&after.status==='completed'&&
    Array.isArray(after.objects)&&after.objects.length>=b.expectedSteps&&
    b.steps.every(x=>after.objects.some(o=>
      o.step_name===x.name&&o.object_type===x.type&&o.cleaned===false))
});
export const tools=[
  {...op.tool,area:'developer',profiles:writeProfiles,
    description:'Seed tracked TEST catalog, store payments, trial/canceled and paid active subscriptions.',
    inputSchema:{type:'object',properties:{scenario,description,size,requestKey:retry,
      confirm:{type:'boolean'},dryRun:{type:'boolean'}},
      required:['size','requestKey'],additionalProperties:false}},
  {name:'dev_list_runs',area:'developer',writes:false,profiles,
    description:'List account-scoped TEST developer seed runs and recorded object counts.',
    annotations:{readOnlyHint:true},
    inputSchema:{type:'object',properties:{
      limit:{type:'integer',minimum:1,maximum:50},
      offset:{type:'integer',minimum:0,maximum:100000}
    },additionalProperties:false}}
];
export const handlers={
  dev_seed:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Developer seeding is TEST only'):op.handler(a,ctx),
  dev_list_runs:async(a,ctx)=>{
    if(ctx?.connection?.mode!=='test'||!ctx?.connection?.stripeAccount)
      return gone('Developer run listing is TEST only');
    if(typeof ctx.db?.listDevRuns!=='function')
      return gone('Tracked seed database unavailable');
    if(!a||typeof a!=='object'||Array.isArray(a)||
      Object.keys(a).some(k=>!['limit','offset'].includes(k))||
      (a.limit!==undefined&&(!Number.isInteger(a.limit)||a.limit<1||a.limit>50))||
      (a.offset!==undefined&&(!Number.isInteger(a.offset)||a.offset<0||
        a.offset>100000)))
      return gone('Invalid bounded TEST run query');
    const runs=await ctx.db.listDevRuns({account:ctx.connection.stripeAccount,
      limit:a.limit??20,offset:a.offset??0});
    return reply({runs:runs.map(r=>({id:r.id,scenario:r.scenario,
      size:r.size,status:r.status,objectCount:r.object_count,
      createdAt:r.created_at,completedAt:r.completed_at})),
      hasMore:runs.length===(a.limit??20)});
  }
};
export const makeDevSeedWrite=()=>op;
