import {describe,it,expect} from 'vitest';
import {planTrigger} from '../../src/dev/triggers.js';
import {tools,handlers} from '../../src/tools/dev-acceptance.js';
import {registry} from '../../src/tools/index.js';
const account='acct_BATCHTEST123',parse=x=>JSON.parse(x.content[0].text);
const ids={customer:'cus_BATCHTEST123',product:'prod_BATCHTEST123'};
function fixture(){
  const entries=['customer.created','product.created'].map(type=>{
    const requestKey='batch-verification-'+type;
    const plan=planTrigger({type,requestKey},account);
    const sourceType=type.split('.')[0],source=ids[sourceType];
    const eventId='evt_'+(sourceType==='customer'?'CUSTOMER123':'PRODUCT123');
    const run={id:plan.runId,request_key:requestKey,stripe_account:account,
      size:1,status:'completed',scenario:plan.scenario,plan_digest:plan.planDigest};
    const rows=plan.steps.map(step=>({
      step_name:step.name,object_type:step.type,
      object_id:step.type==='event'?eventId:source,
      cleaned:step.type!=='event'
    }));
    const event={id:eventId,object:'event',type,livemode:false,account,
      data:{object:{id:source,object:sourceType,metadata:{rtc_run:plan.runId}}}};
    return {plan,run,rows,event};
  });
  const calls=[],provider=new Map(entries.map(x=>[x.event.id,x.event]));
  const db={
    getDevRunById:async({account:a,id})=>a===account?
      entries.find(x=>x.run.id===id)?.run:null,
    getDevRunObjects:async({account:a,id})=>a===account?
      entries.find(x=>x.run.id===id)?.rows:null
  };
  const stripe={events:{retrieve:async id=>{
    calls.push(id);
    if(!provider.has(id))throw Object.assign(new Error('not found'),{statusCode:404});
    return provider.get(id);
  }}};
  const ctx={connection:{stripeAccount:account,mode:'test',profile:'read_only'},
    db,services:{stripeForConnection:async()=>stripe}};
  return {entries,calls,provider,ctx};
}
describe('native bounded Stripe TEST event batch acceptance',()=>{
  it('registers read_only independent verification without a write contract',()=>{
    expect(tools[0]).toMatchObject({writes:false,
      profiles:['read_only','everyday','full']});
    expect(registry.tools.filter(x=>x.name==='dev_verify_trigger_runs'))
      .toHaveLength(1);
  });
  it('independently retrieves each original Event and reports proof after source cleanup',async()=>{
    const f=fixture(),runIds=f.entries.map(x=>x.run.id);
    const response=await handlers.dev_verify_trigger_runs({runIds},f.ctx);
    const v=parse(response);
    expect(v).toMatchObject({mode:'test',requested:2,verifiedCount:2,
      unverifiedCount:0,allProviderVerified:true});
    expect(v.results).toEqual(runIds.map((runId,i)=>expect.objectContaining({
      runId,verification:'provider_verified',
      eventId:f.entries[i].event.id,sourceId:ids[f.entries[i].event.type.split('.')[0]],
      sourceCleanedInLedger:true,immutableEventRetained:true,
      webhookDeliveryVerified:false
    })));
    expect(f.calls).toEqual(f.entries.map(x=>x.event.id));
  });
  it('isolates tampered original Event without granting success to the other run',async()=>{
    const f=fixture(),bad=f.entries[1];
    f.provider.set(bad.event.id,{...bad.event,account:'acct_FOREIGN'});
    const v=parse(await handlers.dev_verify_trigger_runs({
      runIds:f.entries.map(x=>x.run.id)},f.ctx));
    expect(v).toMatchObject({verifiedCount:1,unverifiedCount:1,
      allProviderVerified:false});
    expect(v.results[0].verification).toBe('provider_verified');
    expect(v.results[1]).toMatchObject({runId:bad.run.id,
      verification:'unverified',providerVerified:false});
    expect(JSON.stringify(v)).not.toContain('acct_FOREIGN');
    expect(f.calls).toHaveLength(2);
  });
  it('fails closed on unknown run, foreign account or provider outage',async()=>{
    const f=fixture(),foreign='run_'+'b'.repeat(24);
    const v=parse(await handlers.dev_verify_trigger_runs({
      runIds:[f.entries[0].run.id,foreign]},f.ctx));
    expect(v.verifiedCount).toBe(1);
    expect(v.results[1].verification).toBe('unverified');
    expect((await handlers.dev_verify_trigger_runs({
      runIds:[f.entries[0].run.id]},{
        ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    const alt=parse(await handlers.dev_verify_trigger_runs({
      runIds:[f.entries[0].run.id]},{
        ...f.ctx,connection:{...f.ctx.connection,stripeAccount:'acct_OTHER123'}}));
    expect(alt.verifiedCount).toBe(0);
    f.provider.clear();
    const outage=parse(await handlers.dev_verify_trigger_runs({
      runIds:[f.entries[0].run.id]},f.ctx));
    expect(outage.allProviderVerified).toBe(false);
  });
  it('rejects duplicate, malformed or oversized requests before accessing Stripe',async()=>{
    const f=fixture(),good=f.entries[0].run.id;
    for(const args of [{},{runIds:[]},{runIds:[good,good]},
      {runIds:['run_INVALID']},{runIds:Array(11).fill(good)},
      {runIds:[good],confirm:true}]){
      const response=await handlers.dev_verify_trigger_runs(args,f.ctx);
      expect(response.isError,args).toBe(true);
    }
    expect(f.calls).toHaveLength(0);
  });
});
