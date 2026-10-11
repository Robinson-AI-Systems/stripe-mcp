import {describe,it,expect,vi} from 'vitest';
import {planSubscriptionSimulation,executeSubscriptionSetup}
  from '../../src/dev/subscription-sim.js';
import {makeSimulationSetupWrite,tools}
  from '../../src/tools/dev-subscription-sim.js';
const account='acct_SIMTEST';
const args={months:3,amountCents:3600,card:'pm_card_visa',
  frozenTime:1760000000,requestKey:'stable-simulation-key'};
const plan=planSubscriptionSimulation(args,account);
const ids={test_clock:'clock_FAKE1234',product:'prod_FAKE1234',
  price:'price_FAKE1234',customer:'cus_FAKE1234',subscription:'sub_FAKE1234'};
const objects=new Map(),calls=[],records=new Map();
function fixture(){
  const state={run:null,steps:new Map()};
  const db={
    recordChange:async()=>{},
    getDevRun:async({account:a,requestKey:k})=>
      a===account&&k===args.requestKey?state.run:null,
    ensureDevRun:async p=>{
      if(!state.run)state.run={id:p.id,scenario:p.scenario,size:p.size,
        plan_digest:p.planDigest,status:'running',created_at:new Date()};
      return state.run;
    },
    getDevRunObjects:async()=>[...state.steps].map(([step_name,row])=>({
      step_name,object_id:row.object_id,object_type:row.object_type,cleaned:false
    })),
    recordDevRunObject:async p=>{
      if(state.steps.has(p.stepName))
        return state.steps.get(p.stepName).object_id===p.objectId;
      state.steps.set(p.stepName,{object_id:p.objectId,object_type:p.objectType});
      return true;
    },
    completeDevRun:async({expectedSteps})=>{
      if(state.steps.size!==expectedSteps)return false;
      state.run.status='completed';return true;
    }
  };
  const stripe={testHelpers:{testClocks:{}},products:{},prices:{},customers:{},subscriptions:{}};
  let createCount=0;
  const methodByType={
    test_clock:stripe.testHelpers.testClocks,product:stripe.products,
    price:stripe.prices,customer:stripe.customers,subscription:stripe.subscriptions};
  const snapshots={
    test_clock:()=>({id:ids.test_clock,object:'test_helpers.test_clock',
      livemode:false,status:'ready',name:'RTC DEV RUN '+plan.runId+' 1',
      frozen_time:args.frozenTime}),
    product:()=>({id:ids.product,object:'product',livemode:false,
      metadata:{rtc_run:plan.runId}}),
    price:()=>({id:ids.price,object:'price',livemode:false,
      product:ids.product,currency:'usd',unit_amount:3600,type:'recurring',
      recurring:{interval:'month',interval_count:1},metadata:{rtc_run:plan.runId}}),
    customer:()=>({id:ids.customer,object:'customer',livemode:false,
      test_clock:ids.test_clock,invoice_settings:{default_payment_method:args.card},
      metadata:{rtc_run:plan.runId}}),
    subscription:()=>({id:ids.subscription,object:'subscription',livemode:false,
      test_clock:ids.test_clock,customer:ids.customer,
      collection_method:'charge_automatically',status:'trialing',
      trial_end:args.frozenTime+86400,items:{data:[{price:ids.price}],has_more:false},
      metadata:{rtc_run:plan.runId}})
  };
  for(const [type,api] of Object.entries(methodByType)){
    api.create=vi.fn(async(p,opts)=>{
      expect(opts.idempotencyKey).toContain('_');
      createCount++;
      calls.push({type,params:p});
      objects.set(ids[type],snapshots[type]());
      return objects.get(ids[type]);
    });
    api.retrieve=vi.fn(async id=>objects.get(id));
  }
  const services={stripeForConnection:async()=>stripe};
  const ctx={connection:{mode:'test',profile:'full',stripeAccount:account},
    db,services};
  return {ctx,stripe,calls,state,metrics:()=>({createCount})};
}
const parse=r=>JSON.parse(r.content[0].text);
describe('V-5b guarded tracked TEST subscription setup',()=>{
  it('enforces exact bounded immutable input and deterministic run ID',()=>{
    expect(plan.runId).toMatch(/^run_[a-f0-9]{24}$/);
    expect(plan.scenario).toBe('subscription-simulation');
    expect(plan.steps.map(s=>s.objectType)).toEqual([
      'test_clock','product','price','customer','subscription']);
    expect(planSubscriptionSimulation(args,account)).toEqual(plan);
    for(const change of [{months:4},{months:0},{card:'pm_card_createDispute'},
      {amountCents:0},{frozenTime:0},{unexpected:true},{requestKey:''}])
      expect(()=>planSubscriptionSimulation({...args,...change},account)).toThrow();
  });
  it('previews before any Stripe calls and only executes with explicit confirm',async()=>{
    const f=fixture(),op=makeSimulationSetupWrite();
    const preview=parse(await op.handler({...args,dryRun:true},f.ctx));
    expect(preview.preview).toContain('$36.00/month');
    expect(f.metrics().createCount).toBe(0);
    expect(parse(await op.handler(args,f.ctx)).needsConfirmation).toBe(true);
    expect(f.metrics().createCount).toBe(0);
    const applied=parse(await op.handler({...args,confirm:true},f.ctx));
    expect(applied).toMatchObject({done:true,phase:'setup',
      runId:plan.runId,months:3});
    expect(applied.objectIds).toEqual({
      test_clock:ids.test_clock,product:ids.product,price:ids.price,
      customer:ids.customer,subscription:ids.subscription});
    expect(f.metrics().createCount).toBe(5);
    expect(f.state.run.status).toBe('completed');
    expect(JSON.stringify(applied)).not.toMatch(/sk_test_|rk_test_|secret/);
    expect(f.calls.find(x=>x.type==='customer').params)
      .toMatchObject({test_clock:ids.test_clock,payment_method:args.card});
    expect(f.calls.find(x=>x.type==='subscription').params)
      .toMatchObject({customer:ids.customer,trial_period_days:1,
        items:[{price:ids.price}]});
  });
  it('idempotent retry checks independent provider readback without new creations',async()=>{
    const f=fixture(),op=makeSimulationSetupWrite();
    await op.handler({...args,confirm:true},f.ctx);
    const again=parse(await op.handler({...args,confirm:true},f.ctx));
    expect(again.done).toBe(true);
    expect(f.metrics().createCount).toBe(5);
    expect(f.stripe.subscriptions.retrieve).toHaveBeenCalledTimes(2);
  });
  it('refuses LIVE, foreign account and read-only execution',async()=>{
    const f=fixture(),op=makeSimulationSetupWrite();
    const live=await op.handler({...args,confirm:true},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
    expect(live.isError).toBe(true);
    const foreign={...f.ctx,connection:{
      ...f.ctx.connection,stripeAccount:'acct_OTHER'}};
    await expect(op.handler({...args,confirm:true},foreign)).rejects.toThrow();
    const readOnly={...f.ctx,connection:{
      ...f.ctx.connection,profile:'read_only'}};
    const refused=await op.handler({...args,confirm:true},readOnly);
    expect(refused.isError).toBe(true);
    expect(f.metrics().createCount).toBe(0);
    expect(tools[0]).toMatchObject({writes:true,writeContract:'defineWrite-v1'});
  });
  it('independent mismatched readback never records a fake completed run',async()=>{
    const f=fixture(),op=makeSimulationSetupWrite();
    f.stripe.customers.retrieve=async()=>({id:ids.customer,
      object:'customer',livemode:true,metadata:{rtc_run:plan.runId}});
    const outcome=await op.handler({...args,confirm:true},f.ctx);
    expect(parse(outcome).done).toBe(false);
    expect(f.state.steps.size).toBe(3);
    expect(f.state.run.status).toBe('running');
  });
});
