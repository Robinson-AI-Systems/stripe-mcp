import {describe,it,expect} from 'vitest';
import {cleanupTestConnectSeller,cleanupTestClock} from '../../src/dev/dependent-cleanup.js';
import {makeDevCleanupWrite} from '../../src/tools/dev-cleanup.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const account='acct_PLATFORM123',seller='acct_SELLER123';
const clock='clock_SEED123',customer='cus_TEST123',runId='run_'+'a'.repeat(24);
const parse=r=>JSON.parse(r.content[0].text);
function fixture({balanceCents=0,externalCustomer=false,enableSeller=false,
  otherDependency=false,clockState='ready'}={}){
  const db=createFakeDb({accounts:[{id:account,label:'TEST'}]});
  const calls=[],rows=[
    {step_name:'customer_1',object_type:'customer',object_id:customer,cleaned:false},
    {step_name:'connected_account_1',object_type:'connected_account',object_id:seller,cleaned:false},
    {step_name:'clock_1',object_type:'test_clock',object_id:clock,cleaned:false}
  ];
  const objects=new Map([
    [customer,{id:customer,object:'customer',metadata:{rtc_run:runId},
      livemode:false,deleted:false}],
    [seller,{id:seller,object:'account',type:'express',country:'US',
      charges_enabled:enableSeller,payouts_enabled:false,
      details_submitted:false,capabilities:{transfers:enableSeller?'active':'pending'},
      metadata:{rtc_run:runId},livemode:false}],
    [clock,{id:clock,object:'test_helpers.test_clock',livemode:false,
      name:'RTC DEV RUN '+runId+' 1',status:clockState}]
  ]);
  const sdk={
    customers:{
      retrieve:async id=>({...objects.get(id)}),
      del:async(id,_params,opts)=>{
        expect(opts.idempotencyKey).toMatch(/^rmcp_/);
        calls.push('customer_delete');
        objects.set(id,{...objects.get(id),deleted:true});
        return {...objects.get(id)};
      },
      list:async filter=>{
        calls.push('customer_list');
        expect(filter).toEqual({test_clock:clock,limit:1});
        return {object:'list',data:externalCustomer?[{id:'cus_FOREIGN'}]:[],
          has_more:false};
      }
    },
    accounts:{
      retrieve:async id=>({...objects.get(id)}),
      del:async(id,_params,opts)=>{
        expect(opts.idempotencyKey).toMatch(/^rmcp_/);
        calls.push('seller_delete');
        objects.set(id,{...objects.get(id),deleted:true});
        return {...objects.get(id)};
      }
    },
    balance:{retrieve:async options=>{
      calls.push('balance_read');
      expect(options.stripeAccount).toBe(seller);
      return {object:'balance',
        available:[{amount:balanceCents,currency:'usd'}],
        pending:[{amount:0,currency:'usd'}]};
    }},
    testHelpers:{testClocks:{
      retrieve:async id=>({...objects.get(id)}),
      del:async(id,_params,opts)=>{
        expect(opts.idempotencyKey).toMatch(/^rmcp_/);
        calls.push('clock_delete');
        objects.set(id,{...objects.get(id),deleted:true});
        return {...objects.get(id)};
      }
    }}
  };
  const run={id:runId,stripe_account:account,status:'completed',
    scenario:'marketplace-onboarding',size:1};
  db.getDevRunById=async({account:a,id})=>a===account&&id===runId?run:null;
  db.getDevRunObjects=async({account:a,id})=>{
    if(a!==account||id!==runId)return [];
    return [...rows.map(x=>({...x})),
      ...(otherDependency?[{step_name:'subscription_1',object_type:'subscription',
        object_id:'sub_TEST123',cleaned:false}]:[])];
  };
  db.markDevRunObjectCleaned=async({account:a,id,stepName,objectType,objectId})=>{
    if(a!==account||id!==runId)return false;
    const row=rows.find(x=>x.step_name===stepName);
    if(!row||row.object_type!==objectType||row.object_id!==objectId)return false;
    row.cleaned=true;return true;
  };
  const ctx={db,connectionId:'dependent-test',
    connection:{stripeAccount:account,mode:'test',profile:'full'},
    services:{stripeForConnection:async()=>sdk}};
  return {ctx,db,sdk,calls,rows,objects};
}
describe('V-2b dependency and zero-balance TEST cleanup',()=>{
  it('actually deletes safe seller and clock only after verified customer cleanup',async()=>{
    const f=fixture();
    const result=parse(await makeDevCleanupWrite().handler({
      runId,requestKey:'dependent-clear',confirm:true},f.ctx));
    expect(result.done).toBe(true);
    expect(result.cleanup.allCleaned).toBe(true);
    expect(f.rows.every(x=>x.cleaned)).toBe(true);
    expect(f.calls).toEqual(['customer_delete','balance_read','seller_delete',
      'customer_list','clock_delete']);
  });
  it('never deletes an enabled seller even when balance is zero',async()=>{
    const f=fixture({enableSeller:true});
    const result=parse(await makeDevCleanupWrite().handler({
      runId,requestKey:'enabled-seller',confirm:true},f.ctx));
    expect(result.done).toBe(false);
    expect(result.cleanup.outcomes.find(x=>x.step==='connected_account_1')
      .status).toBe('retained');
    expect(f.calls).not.toContain('seller_delete');
  });
  it('never deletes a seller with available or pending funds',async()=>{
    const f=fixture({balanceCents:1});
    const result=parse(await makeDevCleanupWrite().handler({
      runId,requestKey:'seller-has-money',confirm:true},f.ctx));
    expect(result.cleanup.allCleaned).toBe(false);
    expect(f.calls).not.toContain('seller_delete');
  });
  it('cannot delete a TEST clock with an unrecorded external customer',async()=>{
    const f=fixture({externalCustomer:true});
    const result=parse(await makeDevCleanupWrite().handler({
      runId,requestKey:'foreign-clock-customer',confirm:true},f.ctx));
    expect(result.cleanup.allCleaned).toBe(false);
    expect(f.calls).toContain('customer_list');
    expect(f.calls).not.toContain('clock_delete');
  });
  it('will not delete a TEST clock unless every recorded subscription is cleaned',async()=>{
    const f=fixture({otherDependency:true});
    // A partially tracked dependent record makes the entire cleanup fail
    // closed at provider provenance validation, before any mutation.
    const result=parse(await makeDevCleanupWrite().handler({
      runId,requestKey:'pending-sub',confirm:true},f.ctx));
    expect(result.done).toBe(false);
    expect(f.calls).not.toContain('clock_delete');
  });
  it('disallows deleting an advancing TEST clock',async()=>{
    const f=fixture({clockState:'advancing'});
    const result=parse(await makeDevCleanupWrite().handler({
      runId,requestKey:'advancing-clock',confirm:true},f.ctx));
    expect(result.cleanup.allCleaned).toBe(false);
    expect(f.calls).not.toContain('clock_delete');
  });
  it('does not treat unrelated network errors as verified provider deletion',async()=>{
    const f=fixture();
    f.sdk.accounts.retrieve=async id=>{
      if(f.objects.get(id)?.deleted)throw new Error('503 timeout');
      return {...f.objects.get(id)};
    };
    const result=parse(await makeDevCleanupWrite().handler({
      runId,requestKey:'uncertain-delete',confirm:true},f.ctx));
    expect(result.done).toBe(false);
    expect(result.cleanup.outcomes.find(x=>x.step==='connected_account_1')
      .status).toBe('retained');
    expect(f.rows.find(x=>x.step_name==='connected_account_1').cleaned).toBe(false);
  });
  it('requires exact Stripe deletion receipt plus independent missing confirmation',async()=>{
    const f=fixture();const original=f.sdk.accounts.retrieve;
    f.sdk.accounts.retrieve=async id=>{
      const accountRow=await original(id);
      if(accountRow.deleted){
        const err=new Error('No such account');err.statusCode=404;
        err.code='resource_missing';throw err;
      }
      return accountRow;
    };
    const ok=await cleanupTestConnectSeller(f.sdk,f.objects.get(seller),
      {idempotencyKey:'rmcp_delete_test'});
    expect(ok).toBe(true);
  });
  it('pure dependency check refuses uncleaned customer without provider mutation',async()=>{
    const f=fixture();
    const ok=await cleanupTestClock(f.sdk,f.objects.get(clock),f.ctx,runId,
      {idempotencyKey:'rmcp_delete_clock'});
    expect(ok).toBe(false);
    expect(f.calls).toHaveLength(0);
  });
});
