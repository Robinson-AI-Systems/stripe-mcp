import {describe,it,expect} from 'vitest';
import {handlers,observeSeedOutcomes} from '../../src/tools/dev-verify.js';
const account='acct_FAKE1234',runId='run_'+'a'.repeat(24);
const parse=x=>JSON.parse(x.content[0].text);
function fixture(scenario='dispute-trigger',overrides={}){
  const ach=scenario==='ach-awaiting-confirmation';
  const run={id:runId,stripe_account:account,scenario,status:'completed',size:1};
  const rows=[
    {step_name:'customer_1',object_type:'customer',object_id:'cus_FAKE123',cleaned:false},
    {step_name:'payment_1',object_type:'payment_intent',object_id:'pi_FAKE123',cleaned:false}
  ];
  const payment={id:'pi_FAKE123',object:'payment_intent',metadata:{rtc_run:runId},
    customer:'cus_FAKE123',amount:3600,amount_received:ach?0:3600,
    currency:'usd',status:ach?'requires_confirmation':'succeeded',
    payment_method_types:ach?['us_bank_account']:['card'],
    latest_charge:ach?null:'ch_FAKE123',livemode:false};
  const charge={id:'ch_FAKE123',object:'charge',status:'succeeded',paid:true,
    currency:'usd',amount:3600,customer:'cus_FAKE123',payment_intent:'pi_FAKE123',
    disputed:true,livemode:false};
  const event={id:'evt_FAKE123',type:'charge.dispute.created',livemode:false,
    data:{object:{object:'dispute',charge:'ch_FAKE123',payment_intent:'pi_FAKE123',
      amount:3600,currency:'usd'}}};
  const calls=[];
  const sdk={
    paymentIntents:{retrieve:async()=>{calls.push('payment');return {...payment,...overrides.payment};}},
    charges:{retrieve:async()=>{calls.push('charge');return {...charge,...overrides.charge};}},
    events:{list:async()=>{calls.push('events');return {data:overrides.events??[event],
      has_more:false};}}
  };
  const db={getDevRunById:async()=>overrides.run??run,
    getDevRunObjects:async()=>overrides.rows??rows};
  const ctx={connection:{mode:'test',stripeAccount:account},
    services:{stripeForConnection:async()=>sdk},db};
  return {sdk,ctx,calls};
}
describe('V-1b4a TEST provider outcome verification',()=>{
  it('verifies an exact charge.dispute.created event on a disputed run-owned charge',async()=>{
    const f=fixture();
    const v=parse(await handlers.dev_verify_outcomes({runId},f.ctx));
    expect(f.calls).toEqual(['payment','charge','events']);
    expect(v.outcomes[0]).toMatchObject({providerDisputed:true,
      disputeCreatedEventObserved:true,disputeEventId:'evt_FAKE123',
      webhookDeliveredVerified:false});
  });
  it('never infers a dispute event from the trigger-card selection',async()=>{
    const f=fixture('dispute-trigger',{charge:{disputed:false}});
    const v=parse(await handlers.dev_verify_outcomes({runId},f.ctx));
    expect(v.outcomes[0].disputeCreatedEventObserved).toBe(false);
    expect(f.calls).toEqual(['payment','charge']);
  });
  it('rejects unrelated or LIVE disputes as evidence',async()=>{
    const f=fixture('dispute-trigger',{events:[{id:'evt_FAKE123',
      type:'charge.dispute.created',livemode:true,
      data:{object:{object:'dispute',charge:'ch_FAKE123',amount:3600,currency:'usd'}}}]});
    const v=parse(await handlers.dev_verify_outcomes({runId},f.ctx));
    expect(v.outcomes[0].disputeCreatedEventObserved).toBe(false);
  });
  it('reports an unconfirmed ACH intent without implying bank settlement',async()=>{
    const f=fixture('ach-awaiting-confirmation');
    const v=parse(await handlers.dev_verify_outcomes({runId},f.ctx));
    expect(v.outcomes[0]).toMatchObject({providerStatus:'requires_confirmation',
      verifiedPaymentSucceeded:false,bankSettlementVerified:false});
    expect(f.calls).toEqual(['payment']);
  });
  it('only calls an ACH payment succeeded after verifying the full charge',async()=>{
    const f=fixture('ach-awaiting-confirmation',{payment:{
      status:'succeeded',amount_received:3600,latest_charge:'ch_FAKE123'
    }});
    const v=parse(await handlers.dev_verify_outcomes({runId},f.ctx));
    expect(v.outcomes[0]).toMatchObject({verifiedPaymentSucceeded:true,
      bankSettlementVerified:false});
    expect(f.calls).toEqual(['payment','charge','events']);
  });
  it('only reports an ACH succeeded event if its provider PI and run actually match',async()=>{
    const f=fixture('ach-awaiting-confirmation',{payment:{
      status:'succeeded',amount_received:3600,latest_charge:'ch_FAKE123'
    },events:[{id:'evt_GOOD123',type:'payment_intent.succeeded',livemode:false,
      data:{object:{object:'payment_intent',id:'pi_FAKE123',
        status:'succeeded',metadata:{rtc_run:runId},customer:'cus_FAKE123',
        currency:'usd',amount:3600,amount_received:3600}}}]});
    const v=parse(await handlers.dev_verify_outcomes({runId},f.ctx));
    expect(v.outcomes[0]).toMatchObject({paymentSucceededEventObserved:true,
      paymentSucceededEventId:'evt_GOOD123',bankSettlementVerified:false});
  });
  it('fails closed for foreign run ownership, payment mismatch and partial ACH payment',async()=>{
    for(const changed of [
      {run:{id:runId,stripe_account:'acct_other',scenario:'dispute-trigger',
        status:'completed',size:1}},
      {payment:{amount:3700}},
      {payment:{metadata:{rtc_run:'run_WRONG'}}},
      {payment:{customer:'cus_WRONG'}},
      {payment:{status:'succeeded',amount_received:1}},
      {rows:[]}
    ]){
      const f=fixture('ach-awaiting-confirmation',changed);
      expect((await handlers.dev_verify_outcomes({runId},f.ctx)).isError).toBe(true);
    }
  });
  it('rejects malformed arguments, unverified charges and LIVE before reads',async()=>{
    const f=fixture();
    expect((await handlers.dev_verify_outcomes({runId,confirm:true},f.ctx)).isError).toBe(true);
    expect(f.calls).toHaveLength(0);
    const g=fixture('dispute-trigger',{charge:{payment_intent:'pi_OTHER123'}});
    expect((await handlers.dev_verify_outcomes({runId},g.ctx)).isError).toBe(true);
    f.ctx.connection.mode='live';
    expect((await handlers.dev_verify_outcomes({runId},f.ctx)).isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
  it('offers a pure observation function with the same verified facts',async()=>{
    const f=fixture();
    expect((await observeSeedOutcomes({runId},f.ctx,f.sdk)).outcomes[0]
      .disputeCreatedEventObserved).toBe(true);
  });
});
