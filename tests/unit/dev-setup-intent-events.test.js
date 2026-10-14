import {describe,it,expect} from 'vitest';
import {planTrigger} from '../../src/dev/triggers.js';
import {verifyCleanupIdentity} from '../../src/dev/cleanup.js';
import {verifySetupIntent,matchesSetupIntentEvent,ensureSetupIntentEvent}
  from '../../src/dev/triggers-setup-intents.js';
const acct='acct_TEST123',setup='seti_TEST123';
const make=type=>planTrigger({type,requestKey:type},acct);
const object=(plan,props={})=>({
  object:'setup_intent',id:setup,livemode:false,customer:null,
  payment_method_types:['card'],usage:'off_session',
  status:'requires_payment_method',metadata:{rtc_run:plan.runId},...props
});
function fake(plan){
  let state=object(plan);
  const calls=[];
  const get=async(id)=>{
    expect(id).toBe(setup);calls.push('retrieve');return {...state};
  };
  const sdk={setupIntents:{
    retrieve:get,
    cancel:async(id,body,opts)=>{
      expect(id).toBe(setup);
      expect(body.cancellation_reason).toBe('abandoned');
      expect(opts.idempotencyKey).toMatch(/^rmcp_/);
      calls.push('cancel');state={...state,status:'canceled'};
      return {...state};
    },
    confirm:async(id,body,opts)=>{
      expect(id).toBe(setup);
      expect(body.payment_method).toBe('pm_card_visa');
      expect(opts.idempotencyKey).toMatch(/^rmcp_/);
      calls.push('confirm');state={...state,status:'succeeded'};
      return {...state};
    }
  }};
  return {sdk,calls,set:x=>{state=x},state:()=>state};
}
describe('Native run-owned TEST SetupIntent event workflows',()=>{
  it('cleanup independently denies foreign SetupIntent ownership and methods',()=>{
    const plan=make('setup_intent.created');
    const run={id:plan.runId,stripe_account:acct,scenario:plan.scenario};
    const row={object_id:setup,object_type:'setup_intent'};
    expect(()=>verifyCleanupIdentity(run,row,object(plan))).not.toThrow();
    for(const changed of [{customer:'cus_FOREIGN'},{
      payment_method_types:['us_bank_account']},{livemode:true},
      {metadata:{rtc_run:'run_FOREIGN'}},{usage:'on_session'}]){
      expect(()=>verifyCleanupIdentity(run,row,object(plan,changed))).toThrow();
    }
  });
  it.each(['setup_intent.created','setup_intent.canceled',
    'setup_intent.succeeded'])('keeps exact immutable ledger plan and event state: %s',async type=>{
    const plan=make(type),f=fake(plan);
    expect(plan.steps.map(x=>x.type)).toEqual(['setup_intent','event']);
    verifySetupIntent(plan,f.state());
    await ensureSetupIntentEvent(f.sdk,plan,f.state(),'rmcp_seti_test');
    const current=f.state();
    verifySetupIntent(plan,current,{final:true});
    expect(matchesSetupIntentEvent(plan,current,{id:setup})).toBe(true);
    const count=f.calls.filter(x=>x!=='retrieve').length;
    await ensureSetupIntentEvent(f.sdk,plan,current,'rmcp_seti_test');
    expect(f.calls.filter(x=>x!=='retrieve')).toHaveLength(count);
    expect(matchesSetupIntentEvent(plan,{...current,id:'seti_OTHER'},{
      id:setup})).toBe(false);
    expect(matchesSetupIntentEvent(plan,{...current,livemode:true},{
      id:setup})).toBe(false);
    expect(matchesSetupIntentEvent(plan,{...current,metadata:{rtc_run:'run_FOREIGN'}},{
      id:setup})).toBe(false);
  });
  it('refuses foreign customer or app-attached setup before any provider write',async()=>{
    const plan=make('setup_intent.canceled'),f=fake(plan);
    for(const bad of [
      {customer:'cus_FOREIGN'},{metadata:{rtc_run:'run_WRONG'}},
      {usage:'on_session'},{payment_method_types:['us_bank_account']},
      {livemode:true},{status:'processing'}
    ]){
      await expect(ensureSetupIntentEvent(f.sdk,plan,
        object(plan,bad),'rmcp_seti_test')).rejects.toThrow();
    }
    expect(f.calls).toHaveLength(0);
  });
  it('never retries a terminal SetupIntent into the opposite state',async()=>{
    const plan=make('setup_intent.succeeded'),f=fake(plan);
    await expect(ensureSetupIntentEvent(f.sdk,plan,
      object(plan,{status:'canceled'}),'rmcp_seti_test')).rejects.toThrow();
    expect(f.calls).toHaveLength(0);
  });
});
