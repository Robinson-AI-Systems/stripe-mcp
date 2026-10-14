import {describe,it,expect} from 'vitest';
import {makeDevCleanupWrite,handlers} from '../../src/tools/dev-cleanup.js';
import {verifyCleanupIdentity} from '../../src/dev/cleanup.js';
import {planTrigger} from '../../src/dev/triggers.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const account='acct_FAKE123',runId='run_'+'a'.repeat(24);
const p=()=>({runId,requestKey:'cleanup-same',confirm:true});
const parse=x=>JSON.parse(x.content[0].text);
function fixture({mismatch=false,markFailure=false}={}){
  const calls=[],objects=new Map(),rows=[],db=createFakeDb({
    accounts:[{id:account,label:'TEST'}]});
  function put(type,prefix,name,info={}){
    const id=prefix+'_FAKE123';
    const ob={id,object:type,livemode:false,metadata:{rtc_run:runId},
      ...info};
    objects.set(id,ob);
    rows.push({step_name:name,object_type:type==='account'?'connected_account':
      type==='test_helpers.test_clock'?'test_clock':type,object_id:id,cleaned:false});
    return ob;
  }
  put('product','prod','product_1',{active:true});
  put('price','price','price_1',{active:true});
  put('customer','cus','customer_1',{deleted:false});
  put('subscription','sub','subscription_1',{status:'active'});
  put('invoice','in','invoice_1',{status:'open'});
  put('payment_intent','pi','payment_1',{status:'requires_confirmation'});
  put('refund','re','refund_1',{status:'succeeded'});
  put('account','acct','connected_account_1',{type:'express',country:'US',
    capabilities:{transfers:'pending'}});
  put('test_helpers.test_clock','clock','clock_1',{
    name:'RTC DEV RUN '+runId+' 1',status:'ready'});
  const providerType={products:'product',prices:'price',customers:'customer',
    subscriptions:'subscription',invoices:'invoice',paymentIntents:'payment_intent'};
  const get=id=>{
    const ob=objects.get(id);
    if(!ob)throw Error('Unknown provider object');
    return mismatch&&id==='price_FAKE123'?{
      ...ob,metadata:{rtc_run:'run_foreign'}}:{...ob};
  };
  function write(kind,id,patch){
    calls.push([kind,id]);
    objects.set(id,{...get(id),...patch});return get(id);
  }
  const sdk=Object.fromEntries(Object.entries(providerType).map(([name])=>[
    name,{retrieve:async id=>get(id)}]));
  sdk.products.update=async(id,fields,opts)=>{
    expect(opts.idempotencyKey).toMatch(/^rmcp_/);
    return write('product_archive',id,fields);
  };
  sdk.prices.update=async(id,fields,opts)=>{
    expect(opts.idempotencyKey).toMatch(/^rmcp_/);
    return write('price_archive',id,fields);
  };
  sdk.customers.del=async(id,_params,opts)=>{
    expect(opts.idempotencyKey).toMatch(/^rmcp_/);
    return write('customer_delete',id,{deleted:true});
  };
  sdk.subscriptions.cancel=async(id,args,opts)=>{
    expect(args).toMatchObject({invoice_now:false,prorate:false});
    expect(opts.idempotencyKey).toMatch(/^rmcp_/);
    return write('subscription_cancel',id,{status:'canceled'});
  };
  sdk.invoices.voidInvoice=async(id,args,opts)=>{
    expect(opts.idempotencyKey).toMatch(/^rmcp_/);
    return write('invoice_void',id,{status:'void'});
  };
  sdk.invoices.del=async(id,_params,opts)=>{
    expect(opts.idempotencyKey).toMatch(/^rmcp_/);
    return write('invoice_delete',id,{deleted:true});
  };
  sdk.paymentIntents.cancel=async(id,args,opts)=>{
    expect(opts.idempotencyKey).toMatch(/^rmcp_/);
    return write('payment_cancel',id,{status:'canceled'});
  };
  sdk.refunds={retrieve:async id=>get(id)};
  sdk.accounts={retrieve:async id=>get(id)};
  sdk.testHelpers={testClocks:{retrieve:async id=>get(id)}};
  const run={id:runId,stripe_account:account,status:'completed',
    scenario:'basic-store',size:1};
  db.getDevRunById=async({account:a,id})=>a===account&&id===runId?run:null;
  db.getDevRunObjects=async({account:a,id})=>a===account&&id===runId?
    rows.map(x=>({...x})):[];
  db.listDevRuns=async()=>[run];
  db.markDevRunObjectCleaned=async({account:a,id,stepName,objectType,objectId})=>{
    if(markFailure||a!==account||id!==runId)return false;
    const row=rows.find(x=>x.step_name===stepName);
    if(!row||row.object_type!==objectType||row.object_id!==objectId)return false;
    row.cleaned=true;return true;
  };
  const ctx={db,connectionId:'cleanup-connection',
    connection:{stripeAccount:account,mode:'test',profile:'full'},
    services:{stripeForConnection:async()=>sdk}};
  return {ctx,db,sdk,calls,objects,rows,run,get};
}
describe('V-2a guarded cleanup, exact provider read-back, and retained money',()=>{
  it('previews exact recorded IDs without calling the provider or changing the ledger',async()=>{
    const f=fixture();
    const v=parse(await makeDevCleanupWrite().handler({runId,dryRun:true},f.ctx));
    expect(v.preview).toContain('prod_FAKE123');
    expect(v.preview).toContain('in_FAKE123');
    expect(v.preview).toContain('Never auto-refund');
    expect(f.calls).toHaveLength(0);
    expect(f.rows.every(x=>!x.cleaned)).toBe(true);
  });
  it('never performs provider changes without confirmed preview',async()=>{
    const f=fixture();
    const v=parse(await makeDevCleanupWrite().handler({runId},f.ctx));
    expect(v.needsConfirmation).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
  it('archives, cancels, voids and deletes only run-owned IDs; retains money and dependent resources',async()=>{
    const f=fixture();
    const v=parse(await makeDevCleanupWrite().handler(p(),f.ctx));
    expect(v.done).toBe(false);
    expect(v.cleanup.allCleaned).toBe(false);
    expect(f.calls.map(x=>x[0])).toEqual([
      'subscription_cancel','invoice_void','payment_cancel','customer_delete',
      'price_archive','product_archive']);
    expect(f.rows.filter(x=>x.cleaned).length).toBe(6);
    expect(v.cleanup.outcomes.filter(x=>x.status==='retained').map(x=>x.step))
      .toEqual(['refund_1','connected_account_1','clock_1']);
    expect(f.rows.filter(x=>!x.cleaned).map(x=>x.object_type))
      .toEqual(['refund','connected_account','test_clock']);
  });
  it('confirms a draft invoice deletion from exact receipt plus independent 404',async()=>{
    const f=fixture();
    f.objects.set('in_FAKE123',{...f.get('in_FAKE123'),status:'draft'});
    let removed=false;
    f.sdk.invoices.del=async(id,_params,opts)=>{
      expect(opts.idempotencyKey).toMatch(/^rmcp_/);
      removed=true;
      return {id,object:'invoice',deleted:true};
    };
    f.sdk.invoices.retrieve=async id=>{
      if(removed)throw Object.assign(new Error('No such invoice'),{
        statusCode:404,code:'resource_missing'});
      return f.get(id);
    };
    const result=parse(await makeDevCleanupWrite().handler(p(),f.ctx));
    expect(result.cleanup.outcomes.find(x=>x.step==='invoice_1'))
      .toMatchObject({id:'in_FAKE123',status:'cleaned'});
    expect(f.rows.find(x=>x.step_name==='invoice_1').cleaned).toBe(true);
  });
  it('refuses mismatched draft deletion receipts and unrelated provider errors',async()=>{
    for(const variant of ['bad_receipt','wrong_404','server_error']){
      const f=fixture();
      f.objects.set('in_FAKE123',{...f.get('in_FAKE123'),status:'draft'});
      let removed=false;
      f.sdk.invoices.del=async id=>{
        removed=true;
        return {id:variant==='bad_receipt'?'in_OTHER':id,
          object:'invoice',deleted:true};
      };
      f.sdk.invoices.retrieve=async id=>{
        if(removed)throw Object.assign(new Error('provider denied'),
          variant==='server_error'?{statusCode:503,code:'api_error'}:
            {statusCode:404,code:'permission_denied'});
        return f.get(id);
      };
      const result=parse(await makeDevCleanupWrite().handler(p(),f.ctx));
      expect(result.cleanup.outcomes.find(x=>x.step==='invoice_1').status)
        .not.toBe('cleaned');
      expect(f.rows.find(x=>x.step_name==='invoice_1').cleaned).toBe(false);
    }
  });
  it('repeat confirmation cannot repeat earlier destructive Stripe mutations',async()=>{
    const f=fixture();
    await makeDevCleanupWrite().handler(p(),f.ctx);
    const n=f.calls.length;
    const replay=parse(await makeDevCleanupWrite().handler(p(),f.ctx));
    expect(replay.cleanup.outcomes.filter(x=>x.status==='already_cleaned'))
      .toHaveLength(6);
    expect(f.calls).toHaveLength(n);
  });
  it('aborts all cleanup if even one provider object has foreign provenance',async()=>{
    const f=fixture({mismatch:true});
    const denied=parse(await makeDevCleanupWrite().handler(p(),f.ctx));
    expect(denied.done).toBe(false);
    expect(f.calls).toHaveLength(0);
    expect(f.rows.every(x=>!x.cleaned)).toBe(true);
  });
  it('never reports cleaned when a provider change cannot be durably marked',async()=>{
    const f=fixture({markFailure:true});
    const v=parse(await makeDevCleanupWrite().handler(p(),f.ctx));
    expect(v.done).toBe(false);
    expect(v.cleanup.outcomes.some(x=>x.status==='uncertain')).toBe(true);
    expect(f.rows.every(x=>!x.cleaned)).toBe(true);
  });
  it('preserves paid invoices and successful payments without money out',async()=>{
    const f=fixture();
    f.objects.set('in_FAKE123',{...f.get('in_FAKE123'),status:'paid'});
    f.objects.set('pi_FAKE123',{...f.get('pi_FAKE123'),status:'succeeded'});
    const v=parse(await makeDevCleanupWrite().handler(p(),f.ctx));
    expect(v.cleanup.outcomes.filter(x=>x.status==='retained').map(x=>x.step))
      .toContain('invoice_1');
    expect(f.calls.map(x=>x[0])).not.toContain('payment_cancel');
    expect(f.calls.map(x=>x[0])).not.toContain('invoice_void');
  });
  it('accepts a bounded all-runs selection using the exact database IDs',async()=>{
    const f=fixture();
    const v=parse(await makeDevCleanupWrite().handler({
      scope:'all-runs',dryRun:true},f.ctx));
    expect(v.preview).toContain(runId);
  });
  it('read-only profile, LIVE, and missing audit store fail without a provider write',async()=>{
    for(const connection of [{profile:'read_only'},{mode:'live'}]){
      const f=fixture();Object.assign(f.ctx.connection,connection);
      const v=await makeDevCleanupWrite().handler(p(),f.ctx);
      expect(v.isError===true||parse(v).done===false).toBe(true);
      expect(f.calls).toHaveLength(0);
    }
    const f=fixture();f.ctx.db={};
    const v=parse(await makeDevCleanupWrite().handler(p(),f.ctx));
    expect(v.done).toBe(false);
    expect(f.calls).toHaveLength(0);
  });
  it('rejects altered object IDs and mismatched ownership even with a good run tag',()=>{
    const f=fixture();
    const row=f.rows.find(x=>x.object_type==='price');
    expect(()=>verifyCleanupIdentity(f.run,row,{...f.get(row.object_id),
      id:'price_SPOOF'})).toThrow(/ownership or type/);
  });
  it('full TEST reset is owner-guided and never executes provider deletion',async()=>{
    const f=fixture();
    const result=parse(await handlers.dev_reset_test_data({},f.ctx));
    expect(result.performed).toBe(false);
    expect(result.dashboard).toContain('dashboard.stripe.com');
    expect(f.calls).toHaveLength(0);
    f.ctx.connection.mode='live';
    expect((await handlers.dev_reset_test_data({},f.ctx)).isError).toBe(true);
  });
});


describe('actual TEST event cleanup receipt: retained evidence is not a failed deletion',()=>{
  it('confirms the customer deletion and treats the owned immutable event as intended retention',async()=>{
    const db=createFakeDb({accounts:[{id:account,label:'TEST'}]});
    const rows=[
      {step_name:'customer_1',object_type:'customer',object_id:'cus_EVENT123',cleaned:false},
      {step_name:'event_1',object_type:'event',object_id:'evt_EVENT123',cleaned:false}
    ];
    const run={id:runId,stripe_account:account,status:'completed',scenario:'event-customer-created'};
    db.getDevRunById=async()=>run;
    db.getDevRunObjects=async()=>rows.map(row=>({...row}));
    db.markDevRunObjectCleaned=async({stepName,objectId})=>{
      const row=rows.find(r=>r.step_name===stepName&&r.object_id===objectId);
      if(!row)return false;
      row.cleaned=true;
      return true;
    };
    let deleted=false,deleteCalls=0;
    const stripe={
      customers:{
        retrieve:async()=>({id:'cus_EVENT123',object:'customer',livemode:false,
          metadata:{rtc_run:runId},deleted}),
        del:async()=>{deleted=true;deleteCalls++;return {id:'cus_EVENT123',deleted:true};}
      },
      events:{retrieve:async()=>({id:'evt_EVENT123',object:'event',livemode:false,
        type:'customer.created',data:{object:{metadata:{rtc_run:runId}}}})}
    };
    const ctx={db,connectionId:'event-cleanup-fixture',
      connection:{stripeAccount:account,mode:'test',profile:'full'},
      services:{stripeForConnection:async()=>stripe}};
    const op=makeDevCleanupWrite();
    const request={runId,requestKey:'verify-event-retention',confirm:true};
    const first=parse(await op.handler({...request,dryRun:true},ctx));
    expect(first.done).toBe(false);
    expect(deleted).toBe(false);
    const result=parse(await op.handler(request,ctx));
    expect(result).toMatchObject({done:true,confirmed:true,cleanup:{
      allCleaned:false,allEligibleCleaned:true}});
    expect(result.cleanup.outcomes).toEqual([
      expect.objectContaining({step:'customer_1',status:'cleaned'}),
      expect.objectContaining({step:'event_1',status:'retained',retention:'immutable'})
    ]);
    expect(result.cleanup.note).toMatch(/No retry needed/);
    expect(deleted).toBe(true);
    expect(deleteCalls).toBe(1);
    const repeat=parse(await makeDevCleanupWrite().handler(request,ctx));
    expect(repeat.done).toBe(true);
    expect(deleteCalls).toBe(1);
    expect(repeat.cleanup.outcomes[0].status).toBe('already_cleaned');
  });
  it('does not label a blocked dependent seller or uncertain audit as completed',async()=>{
    const blocked=fixture({markFailure:true});
    const result=parse(await makeDevCleanupWrite().handler(p(),blocked.ctx));
    expect(result.done).toBe(false);
    expect(result.cleanup.allEligibleCleaned).toBe(false);
    expect(result.cleanup.note).toMatch(/incomplete/);
    expect(result.cleanup.outcomes.some(o=>o.status==='uncertain')).toBe(true);
  });
});

function deletedInvoiceFixture(){
  const acct='acct_TESTINVOICE123';
  const requestKey='invoice-created-owned-reconciliation';
  const plan=planTrigger({type:'invoice.created',requestKey},acct);
  const invoice='in_TESTINVOICE123',customer='cus_TESTINVOICE123',eventId='evt_TESTINVOICE123';
  const rows=[
    {step_name:'customer_1',object_type:'customer',object_id:customer,cleaned:true},
    {step_name:'invoice_1',object_type:'invoice',object_id:invoice,cleaned:false},
    {step_name:'event_1',object_type:'event',object_id:eventId,cleaned:false}
  ];
  const run={id:plan.runId,stripe_account:acct,request_key:requestKey,
    scenario:plan.scenario,plan_digest:plan.planDigest,status:'completed',size:1};
  const event={id:eventId,object:'event',type:'invoice.created',account:acct,
    livemode:false,data:{object:{id:invoice,object:'invoice',
      customer,status:'draft',currency:'usd',amount_due:0,amount_paid:0,
      metadata:{rtc_run:plan.runId}}}};
  const provider={invoiceError:{statusCode:404,code:'resource_missing'},event};
  const calls={event:0,invoice:0,delete:0,marks:0};
  const db={
    recordChange:async()=>true,
    getDevRunById:async({account,id})=>account===acct&&id===run.id?run:null,
    getDevRunObjects:async({account,id})=>account===acct&&id===run.id?
      rows.map(x=>({...x})):[],
    markDevRunObjectCleaned:async({account,id,stepName,objectType,objectId})=>{
      calls.marks++;
      if(account!==acct||id!==run.id)return false;
      const row=rows.find(x=>x.step_name===stepName&&
        x.object_type===objectType&&x.object_id===objectId);
      if(!row||row.cleaned)return false;
      row.cleaned=true;return true;
    }
  };
  const stripe={
    invoices:{
      retrieve:async()=>{calls.invoice++;
        throw Object.assign(new Error('No such invoice'),provider.invoiceError);},
      del:async()=>{calls.delete++;throw Error('Do not re-delete fixture');}
    },
    events:{retrieve:async()=>{calls.event++;return provider.event;}}
  };
  const ctx={db,connectionId:'exact-owned-test-run',
    connection:{stripeAccount:acct,mode:'test',profile:'full'},
    services:{stripeForConnection:async()=>stripe}};
  const args={runId:plan.runId,requestKey:'reconcile-confirmed-source',
    confirm:true};
  return {provider,calls,ctx,args,rows,run,plan,event};
}
describe('V-2 historical TEST draft reconciliation via original Stripe Event',()=>{
  it('reconciles missing original draft without new provider writes, preserving immutable event',async()=>{
    const f=deletedInvoiceFixture();
    const preview=parse(await makeDevCleanupWrite().handler(
      {runId:f.args.runId,dryRun:true},f.ctx));
    expect(preview.preview).toContain('in_TESTINVOICE123');
    expect(f.calls).toMatchObject({invoice:0,event:0,delete:0,marks:0});
    const verified=parse(await makeDevCleanupWrite().handler(f.args,f.ctx));
    expect(verified).toMatchObject({done:true,confirmed:true,
      cleanup:{allEligibleCleaned:true,allCleaned:false}});
    expect(verified.cleanup.outcomes.find(x=>x.step==='invoice_1'))
      .toMatchObject({status:'cleaned',
        reconciledFrom:'verified_original_event_and_provider_absence'});
    expect(f.calls).toMatchObject({delete:0,marks:1});
    expect(f.calls.event).toBeGreaterThanOrEqual(2);
    expect(f.rows.find(x=>x.step_name==='invoice_1').cleaned).toBe(true);
    expect(f.rows.find(x=>x.step_name==='event_1').cleaned).toBe(false);
    const replay=parse(await makeDevCleanupWrite().handler(f.args,f.ctx));
    expect(replay.done).toBe(true);
    expect(replay.cleanup.outcomes.find(x=>x.step==='invoice_1').status)
      .toBe('already_cleaned');
    expect(f.calls.delete).toBe(0);
    expect(f.calls.marks).toBe(1);
  });
  it('fails closed if original Stripe Event, immutable plan or absence cannot be proved',async()=>{
    for(const fault of ['unrelated404','serverError','foreignEvent',
      'wrongEventType','wrongInvoice','paidEvent','tamperedPlan','noEvent']){
      const f=deletedInvoiceFixture();
      if(fault==='unrelated404')f.provider.invoiceError.code='permission_denied';
      if(fault==='serverError')f.provider.invoiceError.statusCode=503;
      if(fault==='foreignEvent')f.provider.event={...f.event,account:'acct_FOREIGN'};
      if(fault==='wrongEventType')f.provider.event={...f.event,type:'invoice.finalized'};
      if(fault==='wrongInvoice')f.provider.event={...f.event,
        data:{object:{...f.event.data.object,id:'in_FOREIGN'}}};
      if(fault==='paidEvent')f.provider.event={...f.event,
        data:{object:{...f.event.data.object,status:'paid'}}};
      if(fault==='tamperedPlan')f.run.plan_digest='tampered';
      if(fault==='noEvent')f.rows.pop();
      let response;
      try{response=await makeDevCleanupWrite().handler(f.args,f.ctx);}catch{}
      expect(response===undefined||response.isError===true||
        parse(response).done===false,
        fault).toBe(true);
      expect(f.calls.delete,fault).toBe(0);
      expect(f.calls.marks,fault).toBe(0);
      expect(f.rows.find(x=>x.step_name==='invoice_1').cleaned,fault).toBe(false);
    }
  });
});
