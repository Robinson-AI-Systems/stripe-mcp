import {describe,it,expect} from 'vitest';
import {planTrigger} from '../../src/dev/triggers.js';
import {verifyMethodFixture,matchesPaymentMethodEvent,
  ensurePaymentMethodEvent,paymentMethodEventTypes}
  from '../../src/dev/triggers-payment-methods.js';

const account='acct_CARDTEST123',customer='cus_CARDTEST123',pm='pm_CARDTEST123';
const run=x=>planTrigger({type:x,requestKey:'card-'+x},account);
const ledger=new Map([
  ['customer_1',{object_id:customer}],
  ['payment_method_1',{object_id:pm}]
]);
const card=(plan,extra={})=>({
  id:pm,object:'payment_method',livemode:false,
  customer:null,type:'card',
  billing_details:{name:null},
  metadata:{rtc_run:plan.runId},
  ...extra
});
function fixture(plan){
  let current=card(plan);
  const actions=[];
  const get=async id=>{
    expect(id).toBe(pm);actions.push(['retrieve',id]);return {...current};
  };
  const options=o=>expect(o.idempotencyKey).toMatch(/^rmcp_/);
  const sdk={paymentMethods:{
    retrieve:get,
    attach:async(id,{customer:owner},o)=>{
      options(o);actions.push(['attach',id,owner]);
      if(id!==pm||owner!==customer)throw Error('cross-customer attachment');
      current={...current,customer:owner};return {...current};
    },
    update:async(id,{billing_details,metadata},o)=>{
      options(o);actions.push(['update',id]);
      if(current.customer!==customer)throw Error('not attached');
      current={...current,...(billing_details?{billing_details}:{}),
        ...(metadata?{metadata}: {})};return {...current};
    },
    detach:async(id,_,o)=>{
      options(o);actions.push(['detach',id]);
      if(current.customer!==customer)throw Error('not attached');
      current={...current,customer:null};return {...current};
    }
  }};
  return {sdk,actions,state:()=>current,set:x=>{current=x;}};
}
describe('V-3 original TEST PaymentMethod Event generation',()=>{
  it('advertises only the three documented native lifecycle Event types',()=>{
    expect(paymentMethodEventTypes).toEqual([
      'payment_method.attached','payment_method.updated','payment_method.detached'
    ]);
    for(const type of paymentMethodEventTypes)
      expect(run(type).steps.map(x=>x.type))
        .toEqual(['customer','payment_method','event']);
  });
  it.each(paymentMethodEventTypes)(
    '%s requires its real TEST action and exact independent provider state',
    async type=>{
      const plan=run(type),f=fixture(plan);
      await ensurePaymentMethodEvent(f.sdk,plan,ledger,'rmcp_test_owned');
      const state=f.state();
      verifyMethodFixture(plan,state,ledger,{final:true});
      expect(matchesPaymentMethodEvent(plan,state,{id:pm,customer}))
        .toBe(true);
      const mutations=f.actions.filter(x=>x[0]!=='retrieve').map(x=>x[0]);
      expect(mutations).toEqual(type==='payment_method.attached'?
        ['attach']:type==='payment_method.updated'?
          ['attach','update']:['attach','update','detach']);
      const before=f.actions.filter(x=>x[0]!=='retrieve').length;
      await ensurePaymentMethodEvent(f.sdk,plan,ledger,'rmcp_test_owned');
      expect(f.actions.filter(x=>x[0]!=='retrieve')).toHaveLength(before);
      expect(matchesPaymentMethodEvent(plan,{
        ...state,metadata:{rtc_run:'run_FOREIGN'}},{id:pm,customer}))
        .toBe(false);
      expect(matchesPaymentMethodEvent(plan,{...state,livemode:true},
        {id:pm,customer})).toBe(false);
      expect(matchesPaymentMethodEvent(plan,state,
        {id:'pm_FOREIGN123',customer})).toBe(false);
    });
  it('refuses an independently read foreign customer before any mutation',async()=>{
    const plan=run('payment_method.detached'),f=fixture(plan);
    f.set(card(plan,{customer:'cus_FOREIGN123'}));
    await expect(ensurePaymentMethodEvent(f.sdk,plan,ledger,'rmcp_test_owned'))
      .rejects.toThrow(/foreign owner/);
    expect(f.actions.map(x=>x[0])).toEqual(['retrieve']);
  });
  it('rejects a LIVE or cross-run card and cannot count a forged Event',()=>{
    const plan=run('payment_method.updated');
    for(const changed of [
      {livemode:true},{metadata:{rtc_run:'run_FOREIGN'}},
      {id:'pm_OTHER123'},{type:'us_bank_account'},
      {customer:'cus_FOREIGN123'}
    ])expect(()=>verifyMethodFixture(plan,card(plan,changed),ledger))
      .toThrow();
    expect(matchesPaymentMethodEvent(plan,card(plan,{
      customer, billing_details:{name:'Unmodified'}}),{id:pm,customer}))
      .toBe(false);
    expect(()=>verifyMethodFixture(plan,card(plan),ledger,{final:true}))
      .toThrow(/expected state/);
  });
  it('never needs raw card numbers, a successful charge or any payout',()=>{
    const plan=run('payment_method.attached'),f=fixture(plan);
    expect(JSON.stringify(f.state())).not.toContain('424242');
    expect(JSON.stringify(f.sdk)).not.toMatch(/refund|payout|transfer/);
  });
});
