import {describe,it,expect,vi} from 'vitest';
import {makeSimulationObserveWrite}
  from '../../src/tools/dev-simulation-observe.js';
const account='acct_SIMVERIFY',runId='run_'+'d'.repeat(24);
const ids={test_clock:'clock_FAKEX',product:'prod_FAKEX',
  price:'price_FAKEX',customer:'cus_FAKEX',subscription:'sub_FAKEX'};
const target=1762000000,amount=3600,invoiceId='in_FAKEX',
  piId='pi_FAKEX',eventId='evt_FAKEX';
const args={action:'observe',runId,cycle:1,requestKey:'cycle-one'};
function fixture({paid=true,missingEvent=false,clockStatus='ready',
  eventAccount=account}={}){
  const record={cycle:1,requestKey:'cycle-one',targetFrozenTime:target,
    state:'uncertain',invoiceId:null,eventId:null};
  const db={
    recordChange:async()=>{},
    getDevRunById:async({account:a})=>a===account?{
      id:runId,stripe_account:account,scenario:'subscription-simulation',
      status:'completed',size:3}:null,
    getDevRunObjects:async()=>Object.entries(ids).map(([type,object_id])=>({
      object_type:type,object_id,step_name:(type==='test_clock'?'clock':type)+'_1',
      cleaned:false})),
    getDevSimulationCycles:async()=>[{...record}],
    observeDevSimulationCycle:vi.fn(async verified=>{
      if(verified.eventId!==eventId)return false;
      Object.assign(record,{state:'observed',
        invoiceId:verified.invoiceId,invoiceStatus:verified.invoiceStatus,
        paymentIntentId:verified.paymentIntentId,paymentStatus:verified.paymentStatus,
        eventId:verified.eventId,eventType:verified.eventType});
      return true;
    })
  };
  const inv={id:invoiceId,object:'invoice',livemode:false,
    customer:ids.customer,currency:'usd',total:amount,
    status:paid?'paid':'open',created:target-100,
    parent:{subscription_details:{subscription:ids.subscription}},
    amount_paid:paid?amount:0,amount_remaining:paid?0:amount,
    attempt_count:1};
  const event={id:eventId,object:'event',livemode:false,
    type:paid?'invoice.payment_succeeded':'invoice.payment_failed',
    account:eventAccount,data:{object:{object:'invoice',
      id:invoiceId,customer:ids.customer}}};
  const payment={object:'invoice_payment',invoice:invoiceId,livemode:false,
    status:paid?'paid':'open',amount_paid:paid?amount:0,
    payment:{payment_intent:piId}};
  const sdk={
    testHelpers:{testClocks:{retrieve:async()=>({
      id:ids.test_clock,object:'test_helpers.test_clock',
      status:clockStatus,livemode:false,frozen_time:target,
      name:'RTC DEV RUN '+runId+' 1'})}},
    subscriptions:{retrieve:async()=>({
      id:ids.subscription,object:'subscription',livemode:false,
      customer:ids.customer,test_clock:ids.test_clock,
      metadata:{rtc_run:runId},
      items:{data:[{price:ids.price}],has_more:false}})},
    prices:{retrieve:async()=>({id:ids.price,object:'price',
      livemode:false,metadata:{rtc_run:runId},type:'recurring',currency:'usd',
      unit_amount:amount,recurring:{interval:'month'}})},
    invoices:{list:vi.fn(async()=>({data:[inv],has_more:false})),
      retrieve:vi.fn(async()=>inv)},
    invoicePayments:{list:vi.fn(async()=>({
      data:[payment],has_more:false}))},
    paymentIntents:{retrieve:vi.fn(async()=>({
      id:piId,object:'payment_intent',livemode:false,
      customer:ids.customer,currency:'usd',amount,
      amount_received:paid?amount:0,
      status:paid?'succeeded':'requires_payment_method'}))},
    events:{list:vi.fn(async()=>({data:missingEvent?[]:[event],
      has_more:false})),retrieve:vi.fn(async()=>event)}
  };
  const ctx={db,connection:{mode:'test',stripeAccount:account,profile:'full'},
    services:{stripeForConnection:async()=>sdk}};
  return {ctx,db,sdk,record};
}
const parse=x=>JSON.parse(x.content[0].text);
describe('V-5c3 monthly original TEST billing proof',()=>{
  it('previews with zero provider reads, then confirms exact paid PI and Event',async()=>{
    const f=fixture(),op=makeSimulationObserveWrite();
    expect(parse(await op.handler({...args,dryRun:true},f.ctx)).preview)
      .toContain('invoice');
    expect(f.sdk.invoices.list).not.toHaveBeenCalled();
    expect(parse(await op.handler(args,f.ctx)).needsConfirmation).toBe(true);
    const result=parse(await op.handler({...args,confirm:true},f.ctx));
    expect(result.done).toBe(true);
    expect(result.monthlyOutcome).toMatchObject({
      state:'observed',invoiceStatus:'paid',paymentStatus:'succeeded',
      invoiceId,eventId,eventType:'invoice.payment_succeeded'});
    expect(f.sdk.paymentIntents.retrieve).toHaveBeenCalledWith(piId);
    expect(f.sdk.events.retrieve).toHaveBeenCalledWith(eventId);
    expect(result.note).toMatch(/NOT proved/);
  });
  it('independently verifies a failed collection without calling it paid',async()=>{
    const f=fixture({paid:false});
    const result=parse(await makeSimulationObserveWrite().handler({
      ...args,confirm:true},f.ctx));
    expect(result.done).toBe(true);
    expect(result.monthlyOutcome).toMatchObject({
      invoiceStatus:'open',paymentStatus:'requires_payment_method',
      eventType:'invoice.payment_failed'});
  });
  it('missing original event remains uncertain; does not unlock month two',async()=>{
    const f=fixture({missingEvent:true});
    const result=parse(await makeSimulationObserveWrite().handler({
      ...args,confirm:true},f.ctx));
    expect(result.done).toBe(false);
    expect(f.record.state).toBe('uncertain');
    expect(f.db.observeDevSimulationCycle).not.toHaveBeenCalled();
  });
  it('rejects foreign Event, not-ready clock, LIVE and wrong-account run',async()=>{
    for(const config of [{eventAccount:'acct_OTHER'},
      {clockStatus:'advancing'}]){
      const f=fixture(config);
      const result=parse(await makeSimulationObserveWrite().handler({
        ...args,confirm:true},f.ctx));
      expect(result.done).toBe(false);
      expect(f.db.observeDevSimulationCycle).not.toHaveBeenCalled();
    }
    const f=fixture();
    const live=await makeSimulationObserveWrite().handler({...args,confirm:true},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
    expect(live.isError).toBe(true);
    const foreign=parse(await makeSimulationObserveWrite().handler({
      ...args,confirm:true},{
      ...f.ctx,connection:{...f.ctx.connection,stripeAccount:'acct_OTHER'}}));
    expect(foreign.done).toBe(false);
  });
  it('is idempotent after event-proven status is already saved',async()=>{
    const f=fixture(),op=makeSimulationObserveWrite();
    await op.handler({...args,confirm:true},f.ctx);
    const twice=parse(await op.handler({...args,confirm:true},f.ctx));
    expect(twice.done).toBe(true);
    expect(twice.alreadyObserved).toBe(true);
    expect(f.sdk.invoices.list).toHaveBeenCalledTimes(1);
  });
});
