import {describe,it,expect} from 'vitest';
import {makeDevCleanupWrite,handlers} from '../../src/tools/dev-cleanup.js';
import {verifyCleanupIdentity} from '../../src/dev/cleanup.js';
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
  sdk.customers.del=async(id,opts)=>{
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
  sdk.invoices.del=async(id,opts)=>{
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
