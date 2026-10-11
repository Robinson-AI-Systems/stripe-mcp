// Real TEST handler contracts for separately owner-approved developer seed refunds.
import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {makeDevSeedRefundWrite} from '../../src/tools/dev-refund.js';
import {idempotencyKey} from '../../src/stripe/client.js';
const run='run_'+'a'.repeat(24),account='acct_safefixture';
const pi='pi_FAKE1234',charge='ch_FAKE1234',customer='cus_FAKE1234';
const args={runId:run,paymentStep:'payment_1'};
const parse=x=>JSON.parse(x.content[0].text);
function fixtures({appOwned=false,readBackMatches=true,limitCents=10000}={}){
  const db=createFakeDb({accounts:[{id:account,label:'Fixture',money_limit_cents:limitCents}]});
  const provider={writes:[],afterCalls:0,ledgerCalls:0};
  const metadata=appOwned?{agreementId:'ag_FAKE1234'}:{};
  const testCustomer={object:'customer',id:customer,deleted:false,metadata};
  const payment={id:pi,object:'payment_intent',customer,currency:'usd',
    status:'succeeded',amount:8500,amount_received:8500,latest_charge:charge,
    metadata:{rtc_run:run,...metadata}};
  const ch={id:charge,object:'charge',customer,currency:'usd',
    paid:true,refunded:false,amount:8500,amount_refunded:0,metadata};
  db.getDevRunById=async({account:a,id})=>a===account&&id===run?{
    id:run,status:'completed',scenario:'basic-store',size:1}:null;
  db.getDevRunObjects=async({account:a,id})=>a===account&&id===run?[
    {step_name:'payment_1',object_type:'payment_intent',object_id:pi,cleaned:false},
    {step_name:'customer_1',object_type:'customer',object_id:customer,cleaned:false}
  ]:[];
  db.recordDevRunRefund=async({account:a,id,paymentStep,refundId})=>{
    provider.ledgerCalls++;
    return a===account&&id===run&&paymentStep==='payment_1'&&refundId==='re_FAKE1234';
  };
  const sdk={
    customers:{retrieve:async()=>testCustomer},
    paymentIntents:{retrieve:async()=>payment},
    charges:{retrieve:async()=>ch},
    refunds:{
      create:async(params,opts)=>{
        if(!opts?.idempotencyKey)throw Error('Refund requires idempotency');
        provider.writes.push({params,idempotencyKey:opts.idempotencyKey});
        return {id:'re_FAKE1234',object:'refund',charge,
          currency:'usd',amount:8500,status:'succeeded',
          metadata:{rtc_run:run}};
      },
      retrieve:async()=>{
        provider.afterCalls++;
        return {id:'re_FAKE1234',object:'refund',charge,
          currency:'usd',amount:readBackMatches?8500:1,
          status:'succeeded',metadata:{rtc_run:run}};
      }
    }
  };
  const ctx={db,connectionId:'owner-client-fixture',
    connection:{stripeAccount:account,mode:'test',profile:'full'},
    getCustomer:async()=>testCustomer,
    services:{stripeForConnection:async()=>sdk}};
  return {ctx,db,provider,sdk};
}
describe('dev_seed_refund TEST money-out contract',()=>{
  runWriteContract({withMoney:true,strictArgs:true,args,
    tool:()=>makeDevSeedRefundWrite(),fixtures});
});
it('does not permit an AI confirm flag to replace independent owner approval',async()=>{
  const f=fixtures();
  const result=parse(await makeDevSeedRefundWrite().handler({...args,confirm:true},f.ctx));
  expect(result.done).toBe(false);
  expect(result.error).toMatch(/explicit approval is required/);
  expect(f.provider.writes).toHaveLength(0);
});
it('rejects non-run-owned payment records without creating a Stripe refund',async()=>{
  const f=fixtures();
  f.db.getDevRunObjects=async()=>[];
  await expect(makeDevSeedRefundWrite().handler({...args,confirm:true},f.ctx))
    .rejects.toThrow(/not recorded/);
  expect(f.provider.writes).toHaveLength(0);
});
it('refuses a charge that Stripe says was already partially refunded',async()=>{
  const f=fixtures();
  f.sdk.charges.retrieve=async()=>({
    id:charge,object:'charge',customer,currency:'usd',
    paid:true,refunded:false,amount:8500,amount_refunded:100,
    metadata:{}});
  await expect(makeDevSeedRefundWrite().handler({...args,confirm:true},f.ctx))
    .rejects.toThrow(/not fully paid, unrefunded/);
  expect(f.provider.writes).toHaveLength(0);
});
it('records the verified refund exactly once after separate owner authorization',async()=>{
  const f=fixtures(),op=makeDevSeedRefundWrite();
  const first=parse(await op.handler({...args,confirm:true,requestKey:'approved'},f.ctx));
  expect(first.done).toBe(false);
  const key=idempotencyKey(f.ctx.connection,'dev_seed_refund',{
    ...args,confirm:true,requestKey:'approved'});
  expect(await f.db.approveMoneyRequest({account,idempotencyKey:key})).toBe(true);
  const second=parse(await op.handler({...args,confirm:true,requestKey:'approved'},f.ctx));
  expect(second.done).toBe(true);
  expect(f.provider.ledgerCalls).toBe(1);
  expect(f.provider.writes[0].params).toEqual({
    charge,amount:8500,reason:'requested_by_customer',metadata:{rtc_run:run}
  });
});
