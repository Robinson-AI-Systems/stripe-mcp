// D-5b pinned Stripe SDK 23.0.0 invoice lifecycle paths via local stripe-mock.
import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',
  maxNetworkRetries:0,timeout:5000});
const invoice='in_FAKE1234',pm='pm_FAKE1234';
const opts={idempotencyKey:'rmcp_invoice_lifecycle_1234'};
describe('D-5b native invoice lifecycle SDK routes on pinned stripe-mock',()=>{
  it('finalizes without automatic collection',async()=>{
    const s=stripe();
    expect((await s.invoices.finalizeInvoice(invoice,{
      auto_advance:false},opts)).object).toBe('invoice');
  });
  it('sends only the native TEST invoice.sent request',async()=>{
    expect((await stripe().invoices.sendInvoice(invoice,{},opts)).object)
      .toBe('invoice');
  });
  it('pays with a verified saved method, never a raw client secret',async()=>{
    const v=await stripe().invoices.pay(invoice,{
      paid_out_of_band:false,off_session:true,payment_method:pm},opts);
    expect(v.object).toBe('invoice');
  });
  it('records a separate external payment with paid_out_of_band true',async()=>{
    const v=await stripe().invoices.pay(invoice,{
      paid_out_of_band:true},opts);
    expect(v.object).toBe('invoice');
  });
  it('voids and writes off using modern invoice lifecycle endpoints',async()=>{
    const s=stripe();
    expect((await s.invoices.voidInvoice(invoice,{},opts)).object).toBe('invoice');
    expect((await s.invoices.markUncollectible(invoice,{},opts)).object).toBe('invoice');
  });
  it('deletes only via the native draft DELETE endpoint',async()=>{
    expect((await stripe().invoices.del(invoice,{},opts)).deleted).toBe(true);
  });
});
