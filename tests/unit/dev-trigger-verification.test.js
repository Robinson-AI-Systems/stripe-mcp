import {describe,it,expect} from 'vitest';
import {planTrigger} from '../../src/dev/triggers.js';
import {handlers,tools} from '../../src/tools/dev-events.js';
import {registry} from '../../src/tools/index.js';
const acct='acct_EVENTOWNER123',parse=r=>JSON.parse(r.content[0].text);
function fixture(type='customer.created'){
  const key='verify-'+type,plan=planTrigger({type,requestKey:key},acct);
  const ids={customer:'cus_OWNED123',product:'prod_OWNED123',price:'price_OWNED123'};
  const rows=plan.steps.map(x=>({step_name:x.name,object_type:x.type,
    object_id:x.type==='event'?'evt_OWNED123':ids[x.type],cleaned:x.type!=='event'}));
  const objectType=type.split('.')[0];
  const original={object:objectType,id:ids[objectType],
    metadata:{rtc_run:plan.runId},
    ...(type==='customer.updated'?{description:'RTC Event Updated Customer'}:{})};
  let event={object:'event',id:'evt_OWNED123',type,account:acct,
    livemode:false,data:{object:original}};
  const run={id:plan.runId,stripe_account:acct,request_key:key,
    scenario:plan.scenario,plan_digest:plan.planDigest,status:'completed',size:1};
  let providerReads=0;
  const ctx={connection:{mode:'test',stripeAccount:acct,profile:'read_only'},
    db:{getDevRunById:async()=>run,getDevRunObjects:async()=>rows},
    services:{stripeForConnection:async()=>({events:{retrieve:async()=>{
      providerReads++;return event;}}})}};
  return {plan,rows,ctx,original,reads:()=>providerReads,setEvent:x=>{event=x;}};
}
describe('V-3 account-bound independent original Event verification',()=>{
  it('registers only a TEST read for all profiles',()=>{
    expect(tools.find(x=>x.name==='dev_verify_trigger_run'))
      .toMatchObject({writes:false,profiles:['read_only','everyday','full']});
    expect(registry.tools.filter(x=>x.name==='dev_verify_trigger_run')).toHaveLength(1);
  });
  it.each(['customer.created','customer.updated','product.created','price.created'])(
    '%s retrieves exact native Stripe Event even after source cleanup',async type=>{
      const f=fixture(type);
      const r=parse(await handlers.dev_verify_trigger_run({runId:f.plan.runId},f.ctx));
      expect(r).toMatchObject({type,providerVerified:true,sourceCleaned:true,
        eventId:'evt_OWNED123',immutableEventRetained:true,
        webhookDeliveryVerified:false});
      expect(f.reads()).toBe(1);
    });
  it('fails closed on mismatched provider identity and does not claim delivery',async()=>{
    const f=fixture(),a={runId:f.plan.runId};
    for(const patch of [{account:'acct_FOREIGN'},{livemode:true},
      {data:{object:{...f.original,metadata:{rtc_run:'run_FORGED'}}}},
      {data:{object:{...f.original,id:'cus_FOREIGN'}}}]){
      f.setEvent({object:'event',id:'evt_OWNED123',type:'customer.created',
        account:acct,livemode:false,data:{object:f.original},...patch});
      expect((await handlers.dev_verify_trigger_run(a,f.ctx)).isError).toBe(true);
    }
    expect((await handlers.dev_verify_trigger_run(a,{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    expect((await handlers.dev_verify_trigger_run(a,{
      ...f.ctx,connection:{...f.ctx.connection,stripeAccount:'acct_FOREIGN'}}))
      .isError).toBe(true);
  });
  it('refuses malformed run arguments, tampered ledger and cleared events',async()=>{
    const f=fixture(),a={runId:f.plan.runId};
    for(const args of [{},{runId:'run_INVALID'},{...a,confirm:true}])
      expect((await handlers.dev_verify_trigger_run(args,f.ctx)).isError).toBe(true);
    f.rows.at(-1).cleaned=true;
    expect((await handlers.dev_verify_trigger_run(a,f.ctx)).isError).toBe(true);
    expect(f.reads()).toBe(0);
    f.rows.at(-1).cleaned=false;f.rows.pop();
    expect((await handlers.dev_verify_trigger_run(a,f.ctx)).isError).toBe(true);
    expect(f.reads()).toBe(0);
  });
});
