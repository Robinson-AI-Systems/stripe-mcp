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
  it('registers a read-only selected-account verifier',()=>{
    expect(tools[0]).toMatchObject({writes:false,
      profiles:['read_only','everyday','full']});
    expect(registry.tools.filter(x=>x.name==='dev_verify_cleanup_run'))
      .toHaveLength(1);
  });
});
