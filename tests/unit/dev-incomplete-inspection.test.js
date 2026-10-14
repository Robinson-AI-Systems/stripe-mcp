import {describe,expect,it} from 'vitest';
import {planTrigger} from '../../src/dev/triggers.js';
import {handlers,tools} from '../../src/tools/dev-incomplete-inspection.js';
import {registry} from '../../src/tools/index.js';
const account='acct_RECOVERY123';
const parse=x=>JSON.parse(x.content[0].text);
function fixture(type='customer.created'){
  const plan=planTrigger({type,requestKey:'inspected-incomplete-run'},account);
  const run={id:plan.runId,stripe_account:account,request_key:'inspected-incomplete-run',
    scenario:plan.scenario,plan_digest:plan.planDigest,status:'running',size:1};
  const rows=[{step_name:'customer_1',object_type:'customer',
    object_id:'cus_RECOVERY123',cleaned:false}];
  const calls=[];
  const customer={id:rows[0].object_id,object:'customer',livemode:false,
    metadata:{rtc_run:run.id}};
  let response=customer;
  const sdk={customers:{retrieve:async id=>{calls.push(['customer',id]);
    if(response instanceof Error)throw response;
    return response;}}};
  const ctx={connection:{stripeAccount:account,mode:'test',profile:'read_only'},
    db:{getDevRunById:async({account:a,id})=>a===account&&id===run.id?run:null,
      getDevRunObjects:async({account:a,id})=>a===account&&id===run.id?rows:null},
    services:{stripeForConnection:async()=>sdk}};
  return {plan,run,rows,ctx,sdk,customer,calls,
    setResponse:x=>{response=x;}};
}
const inspect=f=>handlers.dev_inspect_incomplete_run({runId:f.run.id},f.ctx);
describe('unfinished native TEST trigger provider inspection',()=>{
  it('reads a genuine run-owned Stripe source without asserting an Event occurred',async()=>{
    const f=fixture();
    const value=parse(await inspect(f));
    expect(value).toMatchObject({mode:'test',runStatus:'running',
      expectedSteps:2,recordedSteps:1,verifiedCount:1,unverifiedCount:0,
      missingSteps:['event_1']});
    expect(value.observations).toEqual([{
      step:'customer_1',type:'customer',cleanedInLedger:false,
      verification:'provider_verified',observedState:'present'
    }]);
    expect(f.calls).toEqual([['customer','cus_RECOVERY123']]);
    expect(JSON.stringify(value)).not.toContain('providerEventVerified');
  });
  it('independently reports a canceled TEST trial without claiming completed Event',async()=>{
    const f=fixture('customer.subscription.deleted');
    f.rows.unshift(
      {step_name:'product_1',object_type:'product',
        object_id:'prod_RECOVERY123',cleaned:true},
      {step_name:'price_1',object_type:'price',
        object_id:'price_RECOVERY123',cleaned:true});
    f.rows.push({step_name:'subscription_1',object_type:'subscription',
      object_id:'sub_RECOVERY123',cleaned:false});
    f.sdk.products={retrieve:async()=>({id:'prod_RECOVERY123',
      object:'product',livemode:false,metadata:{rtc_run:f.run.id},active:false})};
    f.sdk.prices={retrieve:async()=>({id:'price_RECOVERY123',
      object:'price',livemode:false,metadata:{rtc_run:f.run.id},
      product:'prod_RECOVERY123',active:false})};
    f.sdk.subscriptions={retrieve:async()=>({id:'sub_RECOVERY123',
      object:'subscription',livemode:false,metadata:{rtc_run:f.run.id},
      customer:'cus_RECOVERY123',status:'canceled',
      items:{data:[{price:'price_RECOVERY123'}]}})};
    const value=parse(await inspect(f));
    expect(value).toMatchObject({expectedSteps:6,recordedSteps:4,
      verifiedCount:4,missingSteps:['invoice_1','event_1']});
    expect(value.observations.find(x=>x.type==='subscription'))
      .toMatchObject({observedState:'canceled',verification:'provider_verified',
        cleanedInLedger:false});
    expect(value.note).toMatch(/not prove a Stripe Event/);
  });
  it('does not trust another run or a LIVE provider source',async()=>{
    for(const mutation of [
      x=>({...x,metadata:{rtc_run:'run_'+ 'f'.repeat(24)}}),
      x=>({...x,livemode:true}),
      x=>({...x,id:'cus_FOREIGN123'})
    ]){
      const f=fixture();f.setResponse(mutation(f.customer));
      const value=parse(await inspect(f));
      expect(value.verifiedCount).toBe(0);
      expect(value.observations[0].verification).toBe('provider_unverified');
    }
  });
  it('never returns raw SDK error messages or interprets 404 as cleanup',async()=>{
    const f=fixture();
    f.setResponse(Object.assign(Error('api_key_SECRET_DO_NOT_PRINT'),
      {statusCode:404,code:'resource_missing'}));
    const value=parse(await inspect(f));
    expect(value).toMatchObject({verifiedCount:0,unverifiedCount:1});
    expect(JSON.stringify(value)).not.toContain('api_key_SECRET_DO_NOT_PRINT');
    expect(value.observations[0]).not.toHaveProperty('observedState');
  });
  it('refuses a completed run, a foreign account and LIVE mode before provider access',async()=>{
    const f=fixture();
    f.run.status='completed';
    expect((await inspect(f)).isError).toBe(true);
    f.run.status='running';
    f.ctx.connection.mode='live';
    expect((await inspect(f)).isError).toBe(true);
    f.ctx.connection.mode='test';
    f.ctx.connection.stripeAccount='acct_FOREIGN123';
    expect((await inspect(f)).isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
  it('denies tampered immutable plan and incompatible source rows',async()=>{
    for(const fault of ['digest','unexpected','duplicate','identifier']){
      const f=fixture();
      if(fault==='digest')f.run.plan_digest='tampered';
      if(fault==='unexpected')f.rows[0].step_name='invoice_1';
      if(fault==='duplicate')f.rows.push({...f.rows[0]});
      if(fault==='identifier')f.rows[0].object_id='cus_INVALID@';
      expect((await inspect(f)).isError,fault).toBe(true);
      expect(f.calls,fault).toHaveLength(0);
    }
  });
  it('treats a recorded Event as unverified until completed-run Event proof',async()=>{
    const f=fixture();
    f.rows.push({step_name:'event_1',object_type:'event',
      object_id:'evt_RECOVERY123',cleaned:false});
    const value=parse(await inspect(f));
    expect(value.recordedSteps).toBe(2);
    expect(value.verifiedCount).toBe(1);
    expect(value.observations.find(x=>x.type==='event'))
      .toMatchObject({verification:'provider_unverified'});
    expect(f.calls).toHaveLength(1);
  });
  it('shows only verified TEST card-decline indicators, never the provider error body',async()=>{
    const f=fixture('payment_intent.payment_failed');
    f.rows.push({step_name:'payment_intent_1',object_type:'payment_intent',
      object_id:'pi_RECOVERY123',cleaned:false});
    f.sdk.paymentIntents={retrieve:async()=>({
      id:'pi_RECOVERY123',object:'payment_intent',livemode:false,
      customer:'cus_RECOVERY123',metadata:{rtc_run:f.run.id},
      status:'requires_payment_method',amount_received:0,
      last_payment_error:{code:'card_declined',
        message:'SENSITIVE_DECLINE_PROVIDER_MESSAGE'}
    })};
    const result=parse(await inspect(f));
    expect(result.missingSteps).toEqual(['event_1']);
    expect(result.observations[1]).toMatchObject({
      verification:'provider_verified',observedState:'requires_payment_method',
      indicators:{zeroAmountReceived:'yes',declineObserved:'yes'}
    });
    expect(JSON.stringify(result)).not.toContain('SENSITIVE_DECLINE_PROVIDER_MESSAGE');
    expect(JSON.stringify(result)).not.toContain('last_payment_error');
  });
  it('reads failed TEST invoice attempt counters without exposing amounts or customer details',async()=>{
    const f=fixture('invoice.payment_failed');
    f.rows.push({step_name:'invoice_1',object_type:'invoice',
      object_id:'in_RECOVERY123',cleaned:false});
    f.sdk.invoices={retrieve:async()=>({
      id:'in_RECOVERY123',object:'invoice',livemode:false,
      customer:'cus_RECOVERY123',metadata:{rtc_run:f.run.id},
      status:'open',attempted:true,attempt_count:1,amount_paid:0,
      amount_remaining:3600,collection_method:'charge_automatically',
      customer_email:'PRIVATE_INVOICE_ADDRESS'
    })};
    const result=parse(await inspect(f));
    expect(result.observations[1]).toMatchObject({
      verification:'provider_verified',observedState:'open',
      indicators:{paymentAttempted:'yes',attemptCount:1,zeroAmountPaid:'yes',
        positiveAmountRemaining:'yes',automaticCollection:'yes'}
    });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_INVOICE_ADDRESS');
    expect(JSON.stringify(result)).not.toContain('3600');
  });
  it('exposes only a boolean dispute flag after validating exact linked TEST charge',async()=>{
    const f=fixture('charge.dispute.created');
    f.rows.push(
      {step_name:'payment_intent_1',object_type:'payment_intent',
        object_id:'pi_RECOVERY123',cleaned:false},
      {step_name:'charge_1',object_type:'charge',
        object_id:'ch_RECOVERY123',cleaned:false});
    f.sdk.paymentIntents={retrieve:async()=>({
      id:'pi_RECOVERY123',object:'payment_intent',livemode:false,
      metadata:{rtc_run:f.run.id},status:'succeeded',
      amount_received:3600,customer:'cus_RECOVERY123'
    })};
    f.sdk.charges={retrieve:async()=>({
      id:'ch_RECOVERY123',object:'charge',livemode:false,
      payment_intent:'pi_RECOVERY123',customer:'cus_RECOVERY123',
      amount:3600,currency:'usd',disputed:true,
      billing_details:{name:'PRIVATE_CHARGE_NAME'}
    })};
    const result=parse(await inspect(f));
    expect(result.observations[2]).toMatchObject({
      verification:'provider_verified',
      observedState:'financial_evidence_retained',
      indicators:{disputed:'yes'}
    });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_CHARGE_NAME');
    expect(result.missingSteps).toContain('event_1');
  });
  it('distinguishes an unrecorded trial invoice without revealing its Stripe ID',async()=>{
    const f=fixture('customer.subscription.deleted');
    f.rows.push({step_name:'subscription_1',object_type:'subscription',
      object_id:'sub_RECOVERY123',cleaned:false});
    f.sdk.subscriptions={retrieve:async()=>({
      id:'sub_RECOVERY123',object:'subscription',livemode:false,
      metadata:{rtc_run:f.run.id},customer:'cus_RECOVERY123',
      status:'canceled',items:{data:[{price:'price_RECOVERY123'}]},
      latest_invoice:'in_PRIVATE_INVOICE123'
    })};
    f.rows.push({step_name:'price_1',object_type:'price',
      object_id:'price_RECOVERY123',cleaned:false});
    f.sdk.prices={retrieve:async()=>({
      id:'price_RECOVERY123',object:'price',livemode:false,
      metadata:{rtc_run:f.run.id},product:'prod_RECOVERY123',active:false
    })};
    f.rows.push({step_name:'product_1',object_type:'product',
      object_id:'prod_RECOVERY123',cleaned:false});
    f.sdk.products={retrieve:async()=>({
      id:'prod_RECOVERY123',object:'product',livemode:false,
      metadata:{rtc_run:f.run.id},active:false
    })};
    const result=parse(await inspect(f));
    expect(result.observations.find(x=>x.type==='subscription'))
      .toMatchObject({verification:'provider_verified',
        indicators:{initialInvoice:'not_recorded'}});
    expect(JSON.stringify(result)).not.toContain('in_PRIVATE_INVOICE123');
    expect(result.missingSteps).toContain('invoice_1');
  });
  it('never supplies diagnostic indicators for an unverified foreign source',async()=>{
    const f=fixture('payment_intent.payment_failed');
    f.rows.push({step_name:'payment_intent_1',object_type:'payment_intent',
      object_id:'pi_RECOVERY123',cleaned:false});
    f.sdk.paymentIntents={retrieve:async()=>({
      id:'pi_RECOVERY123',object:'payment_intent',livemode:true,
      metadata:{rtc_run:f.run.id},status:'requires_payment_method',
      amount_received:0,last_payment_error:{code:'card_declined'}
    })};
    const result=parse(await inspect(f));
    expect(result.observations[1]).toMatchObject({verification:'provider_unverified'});
    expect(result.observations[1]).not.toHaveProperty('indicators');
  });
  it('independently retrieves the exact unfinished TEST original Event without completing SQL',async()=>{
    const f=fixture('customer.created'), calls=[];
    const event={id:'evt_VALID_SOURCE123',object:'event',type:'customer.created',
      livemode:false,data:{object:{...f.customer}}};
    f.sdk.events={list:async args=>{calls.push(['list',args.type]);
      return {data:[event],has_more:false};},
      retrieve:async id=>{calls.push(['retrieve',id]);return event;}};
    const result=parse(await handlers.dev_inspect_incomplete_run({
      runId:f.run.id,includeOriginalEvent:true},f.ctx));
    expect(result.originalEvent).toMatchObject({
      verification:'provider_verified',type:'customer.created',
      eventId:'evt_VALID_SOURCE123',ledgerCompletionChanged:false
    });
    expect(result.runStatus).toBe('running');
    expect(result.missingSteps).toEqual(['event_1']);
    expect(result).not.toHaveProperty('done');
    expect(calls).toEqual([['list','customer.created'],
      ['retrieve','evt_VALID_SOURCE123']]);
  });
  it('does not infer missing Stripe Events from bounded negative provider search',async()=>{
    const f=fixture(), calls=[];
    f.sdk.events={list:async()=>{calls.push('list');
      return {data:[],has_more:false};},retrieve:async()=>{throw Error('never');}};
    const result=parse(await handlers.dev_inspect_incomplete_run({
      runId:f.run.id,includeOriginalEvent:true},f.ctx));
    expect(result.originalEvent).toMatchObject({
      verification:'provider_unverified',reason:'original_event_not_verified',
      ledgerCompletionChanged:false});
    expect(result.missingSteps).toEqual(['event_1']);
    expect(calls).toEqual(['list']);
  });
  it('refuses Event search if any original source step is absent from the ledger',async()=>{
    const f=fixture('invoice.payment_failed');
    f.sdk.events={list:async()=>{throw Error('search must not run');}};
    const result=parse(await handlers.dev_inspect_incomplete_run({
      runId:f.run.id,includeOriginalEvent:true},f.ctx));
    expect(result.originalEvent).toMatchObject({
      verification:'provider_unverified',reason:'missing_recorded_source'});
    expect(result.missingSteps).toContain('invoice_1');
  });
  it('independently verifies a recorded Event by ID, refusing a changed original',async()=>{
    const f=fixture('customer.created');
    f.rows.push({step_name:'event_1',object_type:'event',
      object_id:'evt_ORIGINAL123',cleaned:false});
    let actual={id:'evt_ORIGINAL123',object:'event',type:'customer.created',
      livemode:false,data:{object:{...f.customer}}};
    let listed=false;
    f.sdk.events={list:async()=>{listed=true;throw Error('unexpected list');},
      retrieve:async()=>actual};
    const ok=parse(await handlers.dev_inspect_incomplete_run({
      runId:f.run.id,includeOriginalEvent:true},f.ctx));
    expect(ok.originalEvent).toMatchObject({
      verification:'provider_verified',eventId:'evt_ORIGINAL123',
      ledgerCompletionChanged:false});
    expect(listed).toBe(false);
    actual={...actual,data:{object:{...f.customer,
      metadata:{rtc_run:'run_'+ 'f'.repeat(24)}}}};
    const bad=parse(await handlers.dev_inspect_incomplete_run({
      runId:f.run.id,includeOriginalEvent:true},f.ctx));
    expect(bad.originalEvent).toMatchObject({
      verification:'provider_unverified',reason:'original_event_mismatch'});
    expect(listed).toBe(false);
  });
  it('rejects malicious read selectors without Stripe or SQL access beyond setup',async()=>{
    const f=fixture(),calls=[];
    f.sdk.events={list:async()=>{calls.push('list');return {data:[],has_more:false};}};
    for(const args of [
      {runId:f.run.id,includeOriginalEvent:'true'},
      {runId:f.run.id,includeOriginalEvent:true,forceRetry:true}
    ])expect((await handlers.dev_inspect_incomplete_run(args,f.ctx)).isError)
      .toBe(true);
    expect(calls).toEqual([]);
  });
  it('registers an accessible READ ONLY inspection without increasing guarded writes',()=>{
    expect(tools[0]).toMatchObject({writes:false,
      profiles:['read_only','everyday','full']});
    expect(registry.tools.filter(x=>x.name==='dev_inspect_incomplete_run'))
      .toHaveLength(1);
  });
});
