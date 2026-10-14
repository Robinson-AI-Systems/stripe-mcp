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
  it('registers an accessible READ ONLY inspection without increasing guarded writes',()=>{
    expect(tools[0]).toMatchObject({writes:false,
      profiles:['read_only','everyday','full']});
    expect(registry.tools.filter(x=>x.name==='dev_inspect_incomplete_run'))
      .toHaveLength(1);
  });
});
