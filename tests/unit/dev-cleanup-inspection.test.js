import {describe,it,expect} from 'vitest';
import {planTrigger} from '../../src/dev/triggers.js';
import {tools,handlers} from '../../src/tools/dev-cleanup-inspection.js';
import {registry} from '../../src/tools/index.js';
const account='acct_CLEANVERIFY123';
const parse=r=>JSON.parse(r.content[0].text);
function fixture(){
  const plan=planTrigger({type:'customer.created',requestKey:'inspection'},account);
  const run={id:plan.runId,stripe_account:account,request_key:'inspection',size:1,
    status:'completed',scenario:plan.scenario,plan_digest:plan.planDigest};
  const rows=[{step_name:'customer_1',object_type:'customer',object_id:'cus_VERIFY123',cleaned:true},
    {step_name:'event_1',object_type:'event',object_id:'evt_VERIFY123',cleaned:false}];
  const event={id:'evt_VERIFY123',object:'event',type:'customer.created',
    account,livemode:false,data:{object:{id:'cus_VERIFY123',
      object:'customer',metadata:{rtc_run:run.id}}}};
  const customer={id:'cus_VERIFY123',object:'customer',deleted:true};
  let observedEvent=event,observedCustomer=customer;
  const calls=[];
  const stripe={events:{retrieve:async id=>{calls.push(['event',id]);
    return observedEvent;}},
  customers:{retrieve:async id=>{calls.push(['customer',id]);
    return observedCustomer;}}};
  const db={getDevRunById:async({account:a,id})=>
    a===account&&id===run.id?run:null,
    getDevRunObjects:async({account:a,id})=>
      a===account&&id===run.id?rows.map(x=>({...x})):null};
  const ctx={connection:{stripeAccount:account,mode:'test',profile:'read_only'},
    db,services:{stripeForConnection:async()=>stripe}};
  return {plan,run,rows,event,ctx,calls,
    setEvent:v=>{observedEvent=v;},setCustomer:v=>{observedCustomer=v;}};

}

describe('provider-verified TEST cleanup inspection',()=>{
  it('verifies cleanup from an independent Stripe customer tombstone and original Event',async()=>{
    const f=fixture();
    const result=parse(await handlers.dev_verify_cleanup_run({runId:f.run.id},f.ctx));
    expect(result).toMatchObject({eventProviderVerified:true,
      allEligibleCleanedAndVerified:true,eventId:'evt_VERIFY123'});
    expect(result.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({type:'customer',verification:'verified_cleaned'}),
      expect.objectContaining({type:'event',verification:'intentionally_retained'})
    ]));
    expect(f.calls).toEqual([['event','evt_VERIFY123'],['customer','cus_VERIFY123']]);
  });
  it('detects ledger mismatch when the original provider customer is still present',async()=>{
    const f=fixture();
    f.setCustomer({id:'cus_VERIFY123',object:'customer',
      livemode:false,deleted:false,metadata:{rtc_run:f.run.id}});
    const result=parse(await handlers.dev_verify_cleanup_run({runId:f.run.id},f.ctx));
    expect(result.allEligibleCleanedAndVerified).toBe(false);
    expect(result.rows[0].verification).toBe('ledger_mismatch');
  });
  it('does not call provider cleanup or pretend that provider deletion corrected the ledger',async()=>{
    const f=fixture();
    f.rows[0].cleaned=false;
    const result=parse(await handlers.dev_verify_cleanup_run({runId:f.run.id},f.ctx));
    expect(result.allEligibleCleanedAndVerified).toBe(false);
    expect(result.rows[0].verification).toBe('ledger_pending');
    expect(f.calls.map(x=>x[0])).toEqual(['event','customer']);
  });
  it('rejects forged original Event, foreign account, LIVE and malformed requests',async()=>{
    const f=fixture();
    f.setEvent({...f.event,account:'acct_FOREIGN'});
    expect((await handlers.dev_verify_cleanup_run({runId:f.run.id},f.ctx)).isError)
      .toBe(true);
    expect(f.calls).toEqual([['event','evt_VERIFY123']]);
    const original=fixture();
    for(const args of [{},{runId:'run_BAD'},{runId:original.run.id,confirm:true}]){
      expect((await handlers.dev_verify_cleanup_run(args,original.ctx)).isError)
        .toBe(true);
    }
    expect((await handlers.dev_verify_cleanup_run({runId:original.run.id},{
      ...original.ctx,connection:{...original.ctx.connection,mode:'live'}})).isError)
      .toBe(true);
    expect((await handlers.dev_verify_cleanup_run({runId:original.run.id},{
      ...original.ctx,connection:{...original.ctx.connection,
        stripeAccount:'acct_OTHER123'}})).isError).toBe(true);
    expect(original.calls).toHaveLength(0);
  });
  it('independently detects archived and unexpectedly active run-owned products',async()=>{
    const f=fixture(),key='inspected-product';
    const plan=planTrigger({type:'product.created',requestKey:key},account);
    Object.assign(f.run,{id:plan.runId,request_key:key,
      scenario:plan.scenario,plan_digest:plan.planDigest});
    f.rows.splice(0,2,{step_name:'product_1',object_type:'product',
      object_id:'prod_VERIFY123',cleaned:true},f.rows[1]);
    f.setEvent({...f.event,type:'product.created',data:{object:{
      id:'prod_VERIFY123',object:'product',metadata:{rtc_run:f.run.id}}}});
    const sdk=await f.ctx.services.stripeForConnection();
    let active=false;
    sdk.products={retrieve:async()=>({id:'prod_VERIFY123',object:'product',
      active,livemode:false,metadata:{rtc_run:f.run.id}})};
    let value=parse(await handlers.dev_verify_cleanup_run({runId:f.run.id},f.ctx));
    expect(value.allEligibleCleanedAndVerified).toBe(true);
    active=true;
    value=parse(await handlers.dev_verify_cleanup_run({runId:f.run.id},f.ctx));
    expect(value.allEligibleCleanedAndVerified).toBe(false);
    expect(value.rows[0].verification).toBe('ledger_mismatch');
  });
  it('distinguishes absent original TEST draft invoice from its still-pending ledger',async()=>{
    const f=fixture(),key='inspected-invoice';
    const plan=planTrigger({type:'invoice.created',requestKey:key},account);
    Object.assign(f.run,{id:plan.runId,request_key:key,
      scenario:plan.scenario,plan_digest:plan.planDigest});
    f.rows.splice(1,0,{step_name:'invoice_1',object_type:'invoice',
      object_id:'in_VERIFY123',cleaned:false});
    f.setEvent({...f.event,type:'invoice.created',data:{object:{
      id:'in_VERIFY123',object:'invoice',customer:'cus_VERIFY123',
      currency:'usd',amount_due:0,amount_paid:0,status:'draft',
      metadata:{rtc_run:f.run.id}}}});
    const sdk=await f.ctx.services.stripeForConnection();
    sdk.invoices={retrieve:async()=>{throw Object.assign(Error('absent'),{
      statusCode:404,code:'resource_missing'});}};
    let value=parse(await handlers.dev_verify_cleanup_run({runId:f.run.id},f.ctx));
    expect(value.allEligibleCleanedAndVerified).toBe(false);
    expect(value.rows.find(x=>x.type==='invoice').verification).toBe('ledger_pending');
    f.rows[1].cleaned=true;
    value=parse(await handlers.dev_verify_cleanup_run({runId:f.run.id},f.ctx));
    expect(value.allEligibleCleanedAndVerified).toBe(true);
  });
  it('independently classifies run-owned attached, foreign and detached declined cards',async()=>{
    const f=fixture(),key='invoice-fail-owned-card';
    const plan=planTrigger({type:'invoice.payment_failed',requestKey:key},account);
    Object.assign(f.run,{id:plan.runId,request_key:key,
      scenario:plan.scenario,plan_digest:plan.planDigest});
    f.rows.splice(0,f.rows.length,
      {step_name:'customer_1',object_type:'customer',
        object_id:'cus_VERIFY123',cleaned:true},
      {step_name:'invoice_1',object_type:'invoice',
        object_id:'in_VERIFY123',cleaned:false},
      {step_name:'invoice_item_1',object_type:'invoice_item',
        object_id:'ii_VERIFY123',cleaned:false},
      {step_name:'payment_method_1',object_type:'payment_method',
        object_id:'pm_VERIFY123',cleaned:false},
      {step_name:'event_1',object_type:'event',
        object_id:'evt_VERIFY123',cleaned:false});
    const invoice={id:'in_VERIFY123',object:'invoice',livemode:false,
      status:'open',currency:'usd',customer:'cus_VERIFY123',amount_paid:0,
      amount_due:3600,amount_remaining:3600,attempted:true,attempt_count:1,
      metadata:{rtc_run:f.run.id}};
    f.setEvent({...f.event,type:'invoice.payment_failed',
      data:{object:invoice}});
    const sdk=await f.ctx.services.stripeForConnection();
    sdk.invoices={retrieve:async()=>invoice};
    sdk.invoiceItems={retrieve:async()=>({id:'ii_VERIFY123',
      object:'invoiceitem',livemode:false,metadata:{rtc_run:f.run.id}})};
    let current={id:'pm_VERIFY123',object:'payment_method',type:'card',
      livemode:false,customer:'cus_VERIFY123',metadata:{rtc_run:f.run.id}};
    sdk.paymentMethods={retrieve:async()=>current};
    const check=()=>handlers.dev_verify_cleanup_run({runId:f.run.id},f.ctx);
    let report=parse(await check());
    expect(report.eventProviderVerified).toBe(true);
    expect(report.rows.find(x=>x.type==='payment_method').verification)
      .toBe('pending_cleanup');
    current={...current,customer:'cus_FOREIGN123'};
    report=parse(await check());
    expect(report.rows.find(x=>x.type==='payment_method').verification)
      .toBe('provider_unverified');
    f.rows.find(x=>x.type==='payment_method'||x.object_type==='payment_method').cleaned=true;
    current={...current,customer:null};
    report=parse(await check());
    expect(report.rows.find(x=>x.type==='payment_method').verification)
      .toBe('verified_cleaned');
    expect(report.rows.find(x=>x.type==='invoice').verification)
      .toBe('intentionally_retained');
  });
  it.each([
    ['setup_intent.created','requires_payment_method',false,'pending_cleanup'],
    ['setup_intent.canceled','canceled',true,'verified_cleaned'],
    ['setup_intent.succeeded','succeeded',false,'intentionally_retained']
  ])('independently verifies new %s TEST setup cleanup state',
    async(type,status,cleaned,expected)=>{
    const f=fixture(),plan=planTrigger({type,requestKey:'inspection'},account);
    Object.assign(f.run,{id:plan.runId,scenario:plan.scenario,
      plan_digest:plan.planDigest});
    f.rows.splice(0,2,
      {step_name:'setup_intent_1',object_type:'setup_intent',
        object_id:'seti_VERIFY123',cleaned},
      {step_name:'event_1',object_type:'event',
        object_id:'evt_VERIFY123',cleaned:false});
    const intent={id:'seti_VERIFY123',object:'setup_intent',livemode:false,
      customer:null,usage:'off_session',payment_method_types:['card'],
      metadata:{rtc_run:plan.runId},status};
    f.setEvent({...f.event,type,data:{object:intent}});
    const sdk=await f.ctx.services.stripeForConnection();
    let provider={...intent};
    sdk.setupIntents={retrieve:async()=>provider};
    const check=()=>handlers.dev_verify_cleanup_run({runId:plan.runId},f.ctx);
    let result=parse(await check());
    expect(result.eventProviderVerified).toBe(true);
    expect(result.rows[0].verification).toBe(expected);
    provider={...provider,customer:'cus_FOREIGN'};
    result=parse(await check());
    expect(result.rows[0].verification).toBe('provider_unverified');
    provider={...intent,livemode:true};
    result=parse(await check());
    expect(result.rows[0].verification).toBe('provider_unverified');
  });
  it('independently retains a positive TEST uncollectible invoice as evidence',async()=>{
    const f=fixture(),type='invoice.marked_uncollectible';
    const plan=planTrigger({type,requestKey:'inspection'},account);
    Object.assign(f.run,{id:plan.runId,scenario:plan.scenario,
      plan_digest:plan.planDigest});
    const customer={id:'cus_VERIFY123',object:'customer',livemode:false,
      deleted:true,metadata:{rtc_run:plan.runId}};
    const invoice={id:'in_VERIFY123',object:'invoice',livemode:false,
      customer:'cus_VERIFY123',metadata:{rtc_run:plan.runId},
      amount_due:3600,amount_paid:0,amount_remaining:3600,
      collection_method:'send_invoice',currency:'usd',
      status:'uncollectible'};
    const item={id:'ii_VERIFY123',object:'invoiceitem',livemode:false,
      customer:'cus_VERIFY123',invoice:'in_VERIFY123',amount:3600,
      currency:'usd',metadata:{rtc_run:plan.runId}};
    f.rows.splice(0,2,
      {step_name:'customer_1',object_type:'customer',
        object_id:'cus_VERIFY123',cleaned:true},
      {step_name:'invoice_1',object_type:'invoice',
        object_id:'in_VERIFY123',cleaned:false},
      {step_name:'invoice_item_1',object_type:'invoice_item',
        object_id:'ii_VERIFY123',cleaned:false},
      {step_name:'event_1',object_type:'event',
        object_id:'evt_VERIFY123',cleaned:false});
    f.setEvent({...f.event,type,data:{object:invoice}});
    const sdk=await f.ctx.services.stripeForConnection();
    sdk.invoices={retrieve:async()=>invoice};
    sdk.invoiceItems={retrieve:async()=>item};
    f.setCustomer(customer);
    const result=parse(await handlers.dev_verify_cleanup_run({runId:plan.runId},f.ctx));
    expect(result.eventProviderVerified).toBe(true);
    expect(result.rows.find(r=>r.type==='invoice').verification)
      .toBe('intentionally_retained');
  });
  it('checks original Charge link before retaining financial evidence',async()=>{
    const f=fixture(),type='charge.succeeded';
    const plan=planTrigger({type,requestKey:'inspection'},account);
    Object.assign(f.run,{id:plan.runId,scenario:plan.scenario,
      plan_digest:plan.planDigest});
    f.rows.splice(0,2,
      {step_name:'customer_1',object_type:'customer',
        object_id:'cus_VERIFY123',cleaned:true},
      {step_name:'payment_intent_1',object_type:'payment_intent',
        object_id:'pi_VERIFY123',cleaned:false},
      {step_name:'charge_1',object_type:'charge',
        object_id:'ch_VERIFY123',cleaned:false},
      {step_name:'event_1',object_type:'event',
        object_id:'evt_VERIFY123',cleaned:false});
    const charge={id:'ch_VERIFY123',object:'charge',livemode:false,
      payment_intent:'pi_VERIFY123',customer:'cus_VERIFY123',amount:3600,
      currency:'usd',paid:true,status:'succeeded'};
    const pi={id:'pi_VERIFY123',object:'payment_intent',livemode:false,
      latest_charge:'ch_VERIFY123',customer:'cus_VERIFY123',
      status:'succeeded',amount:3600,amount_received:3600,currency:'usd',
      metadata:{rtc_run:plan.runId}};
    f.setEvent({...f.event,type,data:{object:charge}});
    const sdk=await f.ctx.services.stripeForConnection();
    sdk.paymentIntents={retrieve:async()=>pi};
    sdk.charges={retrieve:async()=>charge};
    f.setCustomer({id:'cus_VERIFY123',object:'customer',deleted:true});
    const check=()=>handlers.dev_verify_cleanup_run({runId:plan.runId},f.ctx);
    let result=parse(await check());
    expect(result.eventProviderVerified).toBe(true);
    expect(result.rows.find(r=>r.type==='charge').verification)
      .toBe('intentionally_retained');
    sdk.charges.retrieve=async()=>({...charge,customer:'cus_FOREIGN'});
    result=parse(await check());
    expect(result.rows.find(r=>r.type==='charge').verification)
      .toBe('provider_unverified');
  });
  it('registers a read-only selected-account verifier',()=>{
    expect(tools[0]).toMatchObject({writes:false,
      profiles:['read_only','everyday','full']});
    expect(registry.tools.filter(x=>x.name==='dev_verify_cleanup_run'))
      .toHaveLength(1);
  });
});
