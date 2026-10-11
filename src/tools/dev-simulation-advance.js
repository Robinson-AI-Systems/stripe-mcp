// TEST-only, at-most-once monthly clock advances for recorded simulations.
import {defineWrite,gone} from './write.js';
import {client,ref,reply} from './billing-shared.js';
const exact=(x,p)=>typeof x==='string'&&new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(x);
const error=x=>{throw new TypeError(x);};
const dbMethods=['getDevRunById','getDevRunObjects','getDevSimulationCycles',
  'reserveDevSimulationCycle','beginDevSimulationCycle'];
export async function loadSimulation(a,ctx){
  const account=ctx?.connection?.stripeAccount;
  if(ctx?.connection?.mode!=='test'||!exact(account,'acct')||
    !/^run_[a-f0-9]{24}$/.test(a?.runId??'')||
    dbMethods.some(name=>typeof ctx.db?.[name]!=='function'))
    error('Selected TEST run and durable simulation ledger required');
  const run=await ctx.db.getDevRunById({account,id:a.runId});
  if(run?.id!==a.runId||run.stripe_account!==account||
    run.scenario!=='subscription-simulation'||run.status!=='completed'||
    !Number.isInteger(run.size)||run.size<1||run.size>3)
    error('Completed selected-account TEST simulation required');
  const records=await ctx.db.getDevRunObjects({account,id:run.id});
  const expected={clock_1:['test_clock','clock'],product_1:['product','prod'],
    price_1:['price','price'],customer_1:['customer','cus'],
    subscription_1:['subscription','sub']};
  const ids={};
  for(const [step,[type,prefix]] of Object.entries(expected)){
    const row=records.find(x=>x.step_name===step);
    if(row?.object_type!==type||row.cleaned!==false||
      !exact(row.object_id,prefix))
      error('TEST simulation object missing verified durable provenance');
    ids[type]=row.object_id;
  }
  const cycles=await ctx.db.getDevSimulationCycles({accountId:account,runId:run.id});
  if(!Array.isArray(cycles)||cycles.length>run.size||
    cycles.some((x,i)=>x.cycle!==i+1))
    error('Invalid durable monthly cycle sequence');
  return {account,run,ids,cycles};
}
async function nextTarget(p,ctx,cycle){
  const s=await client(ctx);
  const [clock,sub]=await Promise.all([
    s.testHelpers.testClocks.retrieve(p.ids.test_clock),
    s.subscriptions.retrieve(p.ids.subscription)]);
  if(clock?.id!==p.ids.test_clock||clock.object!=='test_helpers.test_clock'||
    clock.livemode!==false||clock.status!=='ready'||
    clock.name!=='RTC DEV RUN '+p.run.id+' 1'||
    sub?.id!==p.ids.subscription||sub.object!=='subscription'||
    sub.livemode!==false||sub.metadata?.rtc_run!==p.run.id||
    ref(sub.customer)!==p.ids.customer||
    ref(sub.test_clock)!==p.ids.test_clock||
    !Array.isArray(sub.items?.data)||sub.items.has_more===true||
    !sub.items.data.some(item=>ref(item.price)===p.ids.price))
    error('TEST clock and subscription readback do not match this run');
  const due=cycle===1?sub.trial_end:
    sub.items.data.find(item=>ref(item.price)===p.ids.price)?.current_period_end;
  const target=due+60;
  if(!Number.isSafeInteger(due)||!Number.isSafeInteger(target)||
    !Number.isSafeInteger(clock.frozen_time)||target<=clock.frozen_time||
    target>clock.frozen_time+65*86400||target>4102444800)
    error('Unsupported or unsafe Stripe billing boundary');
  return target;
}
export function makeAdvanceWrite(){
  let acknowledged=null;
  const op=defineWrite({
    name:'dev_simulate_subscription',
    read:async(a,ctx)=>{
      if(!a||typeof a!=='object'||Array.isArray(a)||
        Object.keys(a).some(k=>!['action','runId','cycle','requestKey',
          'confirm','dryRun'].includes(k))||a.action!=='advance'||
        !Number.isInteger(a.cycle)||a.cycle<1||a.cycle>3||
        typeof a.requestKey!=='string'||a.requestKey.length<1||
        a.requestKey.length>128)
        error('Exact month and retry key required');
      const p=await loadSimulation(a,ctx);
      if(a.cycle>p.run.size)
        error('Cycle exceeds approved TEST simulation duration');
      const old=p.cycles.find(x=>x.cycle===a.cycle);
      if(old){
        if(old.requestKey!==a.requestKey)
          error('Month was reserved using a different immutable retry key');
        return {...p,cycle:a.cycle,target:old.targetFrozenTime,metadata:{}};
      }
      if(p.cycles.length!==a.cycle-1||
        (a.cycle>1&&p.cycles.at(-1)?.state!=='observed'))
        error('Previous monthly cycle must be independently observed first');
      return {...p,cycle:a.cycle,target:await nextTarget(p,ctx,a.cycle),
        metadata:{}};
    },
    summarize:p=>'TEST MODE. Move isolated clock '+p.ids.test_clock+
      ', cycle '+p.cycle+'/'+p.run.size+' to '+p.target+
      '. Reserve and mark uncertain BEFORE contacting Stripe. Never POST again '+
      'for the same retry key; Stripe advancement can be asynchronous. Clock '+
      'READY is not proof that a subscription invoice was paid.',
    apply:async(a,ctx,{before,idempotencyKey})=>{
      const b=before;
      const claim=await ctx.db.reserveDevSimulationCycle({
        accountId:b.account,runId:b.run.id,cycle:b.cycle,
        requestKey:a.requestKey,targetFrozenTime:b.target});
      if(!claim.newlyReserved)return;
      const started=await ctx.db.beginDevSimulationCycle({
        accountId:b.account,runId:b.run.id,cycle:b.cycle,
        requestKey:a.requestKey,targetFrozenTime:b.target});
      if(!started)error('Month already attempted or no longer authorized');
      const out=await (await client(ctx)).testHelpers.testClocks.advance(
        b.ids.test_clock,{frozen_time:b.target},{idempotencyKey});
      if(out?.id!==b.ids.test_clock||out.livemode!==false||
        !['advancing','ready'].includes(out.status))
        error('Stripe did not acknowledge the exact TEST clock advance');
      acknowledged=out.status;
    },
    readAfter:(a,ctx)=>ctx.db.getDevSimulationCycles({
      accountId:ctx.connection.stripeAccount,runId:a.runId}),
    verify:(b,after)=>Array.isArray(after)&&after.some(x=>
      x.cycle===b.cycle&&x.targetFrozenTime===b.target&&x.state==='observed')
  });
  return {...op,async handler(a,ctx){
    acknowledged=null;
    if(ctx?.connection?.mode!=='test')return gone('TEST simulation only');
    const result=await op.handler(a,ctx);
    if(result?.isError||a?.dryRun===true||a?.confirm!==true)return result;
    const value=JSON.parse(result.content[0].text);
    const rows=await ctx.db.getDevSimulationCycles({
      accountId:ctx.connection.stripeAccount,runId:a.runId});
    return reply({...value,runId:a.runId,cycle:a.cycle,
      monthlyReceipt:rows.find(x=>x.cycle===a.cycle)??null,
      providerAcknowledged:acknowledged,
      note:'This is an HTTP/clock attempt, NOT verified invoice payment. Do not repeat a POST after a timeout or unknown outcome.'});
  }};
}
export async function inspectSimulation(a,ctx){
  if(ctx?.connection?.mode!=='test')return gone('TEST simulation only');
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!['action','runId'].includes(k))||
    a.action!=='inspect')return gone('Exact simulation inspect action required');
  const p=await loadSimulation(a,ctx);
  const clock=await (await client(ctx)).testHelpers.testClocks.retrieve(
    p.ids.test_clock);
  if(clock?.id!==p.ids.test_clock||clock.object!=='test_helpers.test_clock'||
    clock.livemode!==false||
    clock.name!=='RTC DEV RUN '+p.run.id+' 1')
    return gone('TEST clock provenance not verified');
  return reply({mode:'test',runId:p.run.id,plannedMonths:p.run.size,
    clock:{id:clock.id,status:clock.status,frozenTime:clock.frozen_time},
    cycles:p.cycles,
    note:'Clock readiness alone does not prove invoice/payment. V-5c3 will verify billing before another month can advance.'});
}
