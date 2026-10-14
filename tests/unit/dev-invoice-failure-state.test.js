import {describe,it,expect} from 'vitest';
import {verifyFailedInvoiceSource,verifyFailedInvoiceItem,
  ensureFailedInvoicePayment,matchesInvoiceFailureEvent,
  verifyFailedInvoiceMethod}
  from '../../src/dev/triggers-invoice-failure.js';
const plan={type:'invoice.payment_failed',runId:'run_'+'a'.repeat(24)};
const rows=new Map([
  ['customer_1',{object_id:'cus_FAKE123'}],
  ['invoice_1',{object_id:'in_FAKE123'}],
  ['invoice_item_1',{object_id:'ii_FAKE123'}],
  ['payment_method_1',{object_id:'pm_FAKE123'}]
]);
const invoice=(extra={})=>({
  id:'in_FAKE123',object:'invoice',livemode:false,
  customer:'cus_FAKE123',metadata:{rtc_run:plan.runId},
  status:'draft',currency:'usd',amount_due:3600,
  amount_remaining:3600,amount_paid:0,attempted:false,attempt_count:0,
  ...extra
});
const item=(extra={})=>({
  id:'ii_FAKE123',object:'invoiceitem',livemode:false,
  invoice:'in_FAKE123',customer:'cus_FAKE123',amount:3600,
  currency:'usd',metadata:{rtc_run:plan.runId},...extra
});
const method=(extra={})=>({
  id:'pm_FAKE123',object:'payment_method',livemode:false,type:'card',
  customer:'cus_FAKE123',metadata:{rtc_run:plan.runId},...extra
});
const failed=()=>invoice({status:'open',attempted:true,attempt_count:1});
describe('V-3c3c real declined TEST invoice evidence',()=>{
  it('does not confuse an open unattempted invoice with payment failure',()=>{
    expect(()=>verifyFailedInvoiceSource(plan,invoice({status:'open'}),
      rows)).not.toThrow();
    expect(()=>verifyFailedInvoiceSource(plan,invoice({status:'open'}),
      rows,true)).toThrow(/not independently verified/);
    expect(matchesInvoiceFailureEvent(plan,invoice({status:'open'}),{
      id:'in_FAKE123',customer:'cus_FAKE123'})).toBe(false);
  });
  it('validates exact invoice item ownership and billed positive amount',()=>{
    expect(()=>verifyFailedInvoiceItem(plan,item(),rows)).not.toThrow();
    for(const change of [
      {amount:-3600},{amount:0},{invoice:'in_FOREIGN'},
      {customer:'cus_FOREIGN'},{livemode:true},
      {metadata:{rtc_run:'run_FOREIGN'}}
    ])expect(()=>verifyFailedInvoiceItem(plan,item(change),rows)).toThrow();
  });
  it('refuses untracked, foreign, LIVE or unattached declining TEST methods',()=>{
    expect(()=>verifyFailedInvoiceMethod(plan,method(),rows)).not.toThrow();
    for(const change of [
      {customer:'cus_FOREIGN123'}, {customer:null}, {livemode:true},
      {livemode:undefined},{id:'pm_FOREIGN123'}, {type:'us_bank_account'},
      {metadata:{rtc_run:'run_FOREIGN'}}
    ])expect(()=>verifyFailedInvoiceMethod(plan,method(change),rows)).toThrow();
  });
  it('preflights recorded TEST card before touching invoice state',async()=>{
    let mutations=0;
    const sdk={
      paymentMethods:{retrieve:async()=>method({customer:'cus_FOREIGN123'})},
      invoiceItems:{retrieve:async()=>{mutations++;throw Error('must not read');}},
      invoices:{retrieve:async()=>{mutations++;throw Error('must not read');}}
    };
    await expect(ensureFailedInvoicePayment(sdk,plan,rows,'rmcp_test'))
      .rejects.toThrow(/not attached/);
    expect(mutations).toBe(0);
  });
  it('finalizes, declines and independently reads real provider state just once',async()=>{
    let current=invoice(),finalizes=0,pays=0,reads=0;
    const sdk={
      paymentMethods:{retrieve:async id=>{
        expect(id).toBe('pm_FAKE123');return method();
      }},
      invoiceItems:{retrieve:async id=>{
        expect(id).toBe('ii_FAKE123');return item();
      }},
      invoices:{
        retrieve:async id=>{reads++;expect(id).toBe('in_FAKE123');return current;},
        finalizeInvoice:async(id,p,opts)=>{
          finalizes++;expect(id).toBe('in_FAKE123');
          expect(p).toEqual({auto_advance:false});
          expect(opts.idempotencyKey).toBe('rmcp_test_failure_invoice_finalize');
          current={...current,status:'open'};return current;
        },
        pay:async(id,p,opts)=>{
          pays++;expect(id).toBe('in_FAKE123');
          expect(p).toEqual({payment_method:'pm_FAKE123'});
          expect(opts.idempotencyKey).toBe('rmcp_test_failure_invoice_pay');
          current=failed();
          throw Object.assign(new Error('declined'),{code:'card_declined'});
        }
      }
    };
    await ensureFailedInvoicePayment(sdk,plan,rows,'rmcp_test');
    await ensureFailedInvoicePayment(sdk,plan,rows,'rmcp_test');
    expect({finalizes,pays}).toEqual({finalizes:1,pays:1});
    expect(reads).toBeGreaterThanOrEqual(4);
    expect(matchesInvoiceFailureEvent(plan,current,{
      id:'in_FAKE123',customer:'cus_FAKE123'})).toBe(true);
  });
  it('refuses a paid, zero-value, foreign or unattempted provider result',()=>{
    for(const change of [
      {status:'paid',amount_paid:3600,amount_remaining:0},
      {amount_due:0,amount_remaining:0},
      {customer:'cus_FOREIGN'},{metadata:{rtc_run:'run_FOREIGN'}},
      {attempt_count:0},{attempted:false},{livemode:true}
    ])expect(()=>verifyFailedInvoiceSource(plan,
      invoice({status:'open',attempted:true,attempt_count:1,...change}),
      rows,true)).toThrow();
  });
  it('never treats an unexpected provider error as a declined TEST invoice',async()=>{
    const sdk={
      paymentMethods:{retrieve:async()=>method()},
      invoiceItems:{retrieve:async()=>item()},
      invoices:{
        retrieve:async()=>invoice({status:'open'}),
        pay:async()=>{throw Error('Stripe provider unavailable');}
      }
    };
    await expect(ensureFailedInvoicePayment(sdk,plan,rows,'rmcp_test'))
      .rejects.toThrow(/provider unavailable/);
  });
});
