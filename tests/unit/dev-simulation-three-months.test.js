// V-5 final: three real-step TEST timelines against one stateful fake Stripe.
import {describe,it,expect,vi} from 'vitest';
import {makeAdvanceWrite,inspectSimulation} from '../../src/tools/dev-simulation-advance.js';
import {makeSimulationObserveWrite}
  from '../../src/tools/dev-simulation-observe.js';

const acct='acct_MONTHSFAKE',runId='run_'+'e'.repeat(24);
const ids={test_clock:'clock_MTH001',product:'prod_MTH001',
  price:'price_MTH001',customer:'cus_MTH001',subscription:'sub_MTH001'};
const original=1760000000,trialEnd=original+86400,amount=3600;
const parse=r=>JSON.parse(r.content[0].text);
function threeMonthProvider({failMonth=null,withholdEventMonth=null}={}){
  const state={frozen:original,periodEnd:trialEnd,
    ledger:[],invoices:[],events:[],advances:[],reads:0};
  const ctx={connection:{stripeAccount:acct,mode:'test',profile:'full'},
    connectionId:'three-month-test',db:{},services:{}};
  ctx.db={
    recordChange:async()=>{},
    getDevRunById:async({account,id})=>account===acct&&id===runId?{
      id:runId,stripe_account:acct,scenario:'subscription-simulation',
      status:'completed',size:3}:null,
    getDevRunObjects:async()=>Object.entries(ids).map(([type,object_id])=>({
      object_type:type,object_id,cleaned:false,
      step_name:(type==='test_clock'?'clock':type)+'_1'})),
    getDevSimulationCycles:async()=>state.ledger.map(x=>({...x})),
    reserveDevSimulationCycle:async({cycle,requestKey,targetFrozenTime})=>{
      if(state.ledger.some(x=>x.cycle===cycle))return {cycle,newlyReserved:false};
      if(cycle!==state.ledger.length+1||
        (cycle>1&&state.ledger.at(-1).state!=='observed'))
        throw new Error('Out-of-order monthly reservation');
      state.ledger.push({cycle,requestKey,targetFrozenTime,
        state:'reserved',invoiceId:null,eventId:null});
      return {cycle,newlyReserved:true};
    },
    beginDevSimulationCycle:async({cycle})=>{
      const row=state.ledger.find(x=>x.cycle===cycle);
      if(!row||row.state!=='reserved')return false;
      row.state='uncertain';return true;
    },
    observeDevSimulationCycle:async({cycle,requestKey,targetFrozenTime,
      observedClockTime,invoiceId,invoiceStatus,paymentIntentId,
      paymentStatus,eventId,eventType})=>{
      const row=state.ledger.find(x=>x.cycle===cycle);
      if(row?.requestKey!==requestKey||row.state!=='uncertain'||
        row.targetFrozenTime!==targetFrozenTime||
        observedClockTime!==targetFrozenTime)return false;
      Object.assign(row,{state:'observed',invoiceId,invoiceStatus,
        paymentIntentId,paymentStatus,eventId,eventType});
      return true;
    }
  };
  function invoiceFor(index){
    const number=index+1,failed=number===failMonth;
    return {id:'in_FAKE'+number,object:'invoice',livemode:false,
      customer:ids.customer,currency:'usd',total:amount,
      amount_paid:failed?0:amount,amount_remaining:failed?amount:0,
      status:failed?'open':'paid',attempt_count:1,
      created:state.advances[index]-10,
      parent:{subscription_details:{subscription:ids.subscription}}};
  }
  function originalEvent(index){
    const invoice=state.invoices[index],number=index+1;
    return {id:'evt_FAKE'+number,object:'event',livemode:false,
      account:acct,type:number===failMonth?
        'invoice.payment_failed':'invoice.payment_succeeded',
      data:{object:{object:'invoice',id:invoice.id,customer:ids.customer}}};
  }
  const provider={
    testHelpers:{testClocks:{
      retrieve:vi.fn(async()=>({id:ids.test_clock,
        object:'test_helpers.test_clock',livemode:false,status:'ready',
        name:'RTC DEV RUN '+runId+' 1',frozen_time:state.frozen})),
      advance:vi.fn(async(_id,{frozen_time},opts)=>{
        expect(opts.idempotencyKey).toMatch(/^rmcp_/);
        expect(frozen_time).toBeGreaterThan(state.frozen);
        state.frozen=frozen_time;
        state.advances.push(frozen_time);
        const index=state.advances.length-1;
        const inv=invoiceFor(index);
        state.invoices.unshift(inv);
        state.events.unshift(originalEvent(index));
        state.periodEnd=frozen_time+30*86400;
        return {id:ids.test_clock,livemode:false,status:'advancing'};
      })
    }},
    subscriptions:{retrieve:vi.fn(async()=>({
      id:ids.subscription,object:'subscription',livemode:false,
      metadata:{rtc_run:runId},customer:ids.customer,test_clock:ids.test_clock,
      trial_end:trialEnd,start_date:original,
      items:{data:[{price:ids.price,current_period_end:state.periodEnd}],
        has_more:false}
    }))},
    prices:{retrieve:vi.fn(async()=>({
      id:ids.price,object:'price',livemode:false,
      metadata:{rtc_run:runId},type:'recurring',currency:'usd',
      unit_amount:amount,recurring:{interval:'month'}}))},
    invoices:{list:vi.fn(async()=>({
      data:[...state.invoices],has_more:false})),
      retrieve:vi.fn(async id=>state.invoices.find(x=>x.id===id))},
    invoicePayments:{list:vi.fn(async({invoice})=>{
      const number=Number(invoice.slice(-1)),failed=number===failMonth;
      return {has_more:false,data:[{
        id:'inpay_'+number,object:'invoice_payment',livemode:false,
        invoice,status:failed?'open':'paid',amount_paid:failed?0:amount,
        payment:{payment_intent:'pi_FAKE'+number}
      }]};
    })},
    paymentIntents:{retrieve:vi.fn(async id=>{
      const number=Number(id.slice(-1)),failed=number===failMonth;
      return {id,object:'payment_intent',livemode:false,
        customer:ids.customer,currency:'usd',amount,
        status:failed?'requires_payment_method':'succeeded',
        amount_received:failed?0:amount};
    })},
    events:{list:vi.fn(async()=>({
      data:state.events.filter(x=>
        Number(x.id.slice(-1))!==withholdEventMonth),has_more:false})),
      retrieve:vi.fn(async id=>state.events.find(x=>x.id===id))}
  };
  ctx.services.stripeForConnection=async()=>{state.reads++;return provider;};
  return {ctx,state,provider};
}
describe('V-5 full three-month TEST time travel acceptance',()=>{
  it('advances three independent cycles, observes three original paid invoices/events',async()=>{
    const f=threeMonthProvider();
    for(let cycle=1;cycle<=3;cycle++){
      const requestKey='month-'+cycle,params={
        action:'advance',runId,cycle,requestKey,confirm:true};
      const moved=parse(await makeAdvanceWrite().handler(params,f.ctx));
      expect(moved.done).toBe(false);
      expect(moved.monthlyReceipt.state).toBe('uncertain');
      expect(f.state.advances).toHaveLength(cycle);
      // The same immutable key is always a read, never an additional POST.
      await makeAdvanceWrite().handler(params,f.ctx);
      expect(f.state.advances).toHaveLength(cycle);
      const observed=parse(await makeSimulationObserveWrite().handler({
        ...params,action:'observe'},f.ctx));
      expect(observed.done).toBe(true);
      expect(observed.monthlyOutcome).toMatchObject({
        state:'observed',invoiceStatus:'paid',paymentStatus:'succeeded',
        invoiceId:'in_FAKE'+cycle,eventId:'evt_FAKE'+cycle,
        eventType:'invoice.payment_succeeded'});
    }
    const snapshot=parse(await inspectSimulation({action:'inspect',runId},f.ctx));
    expect(snapshot.cycles).toHaveLength(3);
    expect(snapshot.cycles.map(x=>x.invoiceId))
      .toEqual(['in_FAKE1','in_FAKE2','in_FAKE3']);
    expect(new Set(snapshot.cycles.map(x=>x.paymentIntentId)).size).toBe(3);
    expect(snapshot.cycles.every(x=>x.state==='observed')).toBe(true);
    expect(f.state.advances).toHaveLength(3);
  });
  it('does not unlock month two without independently retrieved original Event',async()=>{
    const f=threeMonthProvider({withholdEventMonth:1});
    await makeAdvanceWrite().handler({action:'advance',runId,cycle:1,
      requestKey:'month-1',confirm:true},f.ctx);
    const missing=parse(await makeSimulationObserveWrite().handler({
      action:'observe',runId,cycle:1,requestKey:'month-1',confirm:true},f.ctx));
    expect(missing.done).toBe(false);
    expect(f.state.ledger[0].state).toBe('uncertain');
    await expect(makeAdvanceWrite().handler({action:'advance',runId,cycle:2,
      requestKey:'month-2',confirm:true},f.ctx)).rejects.toThrow(/Previous/);
    expect(f.state.advances).toHaveLength(1);
  });
  it('keeps an independently verified declined TEST renewal unpaid',async()=>{
    const f=threeMonthProvider({failMonth:1});
    await makeAdvanceWrite().handler({action:'advance',runId,cycle:1,
      requestKey:'month-1',confirm:true},f.ctx);
    const verified=parse(await makeSimulationObserveWrite().handler({
      action:'observe',runId,cycle:1,requestKey:'month-1',confirm:true},f.ctx));
    expect(verified.done).toBe(true);
    expect(verified.monthlyOutcome).toMatchObject({
      invoiceStatus:'open',paymentStatus:'requires_payment_method',
      eventType:'invoice.payment_failed'});
    expect(verified.monthlyOutcome.paymentStatus).not.toBe('succeeded');
  });
});
