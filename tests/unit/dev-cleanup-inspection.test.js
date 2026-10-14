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
  it('registers a read-only selected-account verifier',()=>{
    expect(tools[0]).toMatchObject({writes:false,
      profiles:['read_only','everyday','full']});
    expect(registry.tools.filter(x=>x.name==='dev_verify_cleanup_run'))
      .toHaveLength(1);
  });
});
