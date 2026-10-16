import {describe,it,expect} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';

const A='acct_REFUNDCOMPLETE',C='cus_REFUNDCOMPLETE',CH='ch_REFUNDCOMPLETE';
const result=r=>JSON.parse(r.content[0].text);
function fixture(){
  const operations=[],db=createFakeDb({accounts:[{id:A,label:'synthetic original'}]});
  const charge={object:'charge',id:CH,customer:C,
    status:'succeeded',paid:true,refunded:false,disputed:false,currency:'usd',
    amount:6500,amount_refunded:1000,description:'Synthetic washer deposit',
    metadata:{},created:1791900000};
  const customer={object:'customer',id:C,metadata:{},name:'Synthetic TEST'};
  let refund=null;
  const sdk={
    customers:{retrieve:async()=>customer},
    charges:{retrieve:async()=>charge},
    refunds:{
      create:async(values,opts)=>{
        operations.push({kind:'refund_created',values,opts});
        refund={object:'refund',id:'re_COMPLETE123',charge:CH,
          amount:values.amount,status:'pending',currency:'usd'};
        return refund;
      },
      retrieve:async()=>refund
    }
  };
  const ctx={connection:{mode:'test',profile:'full',stripeAccount:A},
    connectionId:'synthetic-refund-completion',db,
    services:{stripeForConnection:async()=>sdk}};
  return {call:a=>registry.handlers.workflow_refund_customer(a,ctx),
    db,charge,operations};
}
describe('W-3 actual native guarded refund readback after independent synthetic owner grant',()=>{
  it('requires distinct owner approval before provider refund and verifies exact charge/amount/readback',async()=>{
    const f=fixture();
    const args={customerId:C,chargeId:CH,amountCents:2000,
      reason:'requested_by_customer'};
    const preview=result(await f.call(args));
    expect(preview).toMatchObject({done:false,complete:true,
      steps:[{tool:'payment_create_refund',target:CH}]});
    const confirm={...args,confirm:true,requestKey:'refund-owner-separate',
      previewToken:preview.previewToken};
    const refused=result(await f.call(confirm));
    expect(refused).toMatchObject({done:false,confirmed:false,
      failedStep:{tool:'payment_create_refund',confirmed:false}});
    expect(f.operations).toHaveLength(0);
    const requests=await f.db.listPendingMoneyApprovals({account:A});
    expect(requests).toMatchObject([{
      amount_cents:2000,tool:'payment_create_refund',target:CH,
      currency:'usd',approved_at:null
    }]);
    // Synthetic fake owner step is NOT a workflow operation. The real owner
    // must use the independently authenticated private approval route.
    const ownerGranted=await f.db.approveMoneyRequest({account:A,
      idempotencyKey:requests[0].request_key});
    expect(ownerGranted).toBe(true);
    const done=result(await f.call(confirm));
    expect(done).toMatchObject({done:true,confirmed:true,
      completedSteps:[{tool:'payment_create_refund',confirmed:true}]});
    expect(f.operations).toHaveLength(1);
    expect(f.operations[0].values).toMatchObject({
      charge:CH,amount:2000,reason:'requested_by_customer'});
    expect(done.completedSteps[0].idempotencyKey).toBeTruthy();
    const usage=await f.db.getMoneyUsage({account:A,connection:'owner'});
    expect(usage.used_cents).toBe(2000);
  });
  it('refuses stale refund remainder even after owner approved original amount',async()=>{
    const f=fixture(),args={customerId:C,chargeId:CH,amountCents:2000};
    const preview=result(await f.call(args));
    f.charge.amount_refunded+=500;
    const out=await f.call({...args,confirm:true,requestKey:'stale-owner',
      previewToken:preview.previewToken});
    expect(out.isError).toBe(true);
    expect(f.operations).toHaveLength(0);
    expect(await f.db.listPendingMoneyApprovals({account:A})).toHaveLength(0);
  });
});
