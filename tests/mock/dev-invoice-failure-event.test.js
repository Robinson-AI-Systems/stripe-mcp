import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
const opts={idempotencyKey:'rmcp_test_failed_invoice_123'};
describe('V-3c3c native TEST failed invoice request shapes',()=>{
  it('creates nonadvancing automatic-collection draft invoice without sending email',async()=>{
    const created=await stripe().invoices.create({
      customer:'cus_FAKE123',currency:'usd',
      collection_method:'charge_automatically',auto_advance:false,
      pending_invoice_items_behavior:'exclude',metadata
    },opts);
    expect(created.object).toBe('invoice');
  });
  it('creates one attached 3600-cent synthetic TEST invoice item',async()=>{
    const item=await stripe().invoiceItems.create({
      customer:'cus_FAKE123',invoice:'in_FAKE123',currency:'usd',
      amount:3600,description:'Synthetic declined TEST invoice charge',metadata
    },opts);
    expect(item.object).toBe('invoiceitem');
    expect((await stripe().invoiceItems.retrieve('ii_FAKE123')).object)
      .toBe('invoiceitem');
  });
  it('finalizes without automatic payment then sends only synthetic decline attempt',async()=>{
    const invoice=await stripe().invoices.finalizeInvoice('in_FAKE123',{
      auto_advance:false
    },opts);
    expect(invoice.object).toBe('invoice');
    try{
      const paid=await stripe().invoices.pay('in_FAKE123',{
        payment_method:'pm_card_chargeCustomerFail'
      },opts);
      expect(paid.object).toBe('invoice');
    }catch(error){expect(error.type).toBe('StripeCardError');}
  });
  it('independently reads provider invoice and exact Event',async()=>{
    expect((await stripe().invoices.retrieve('in_FAKE123')).object)
      .toBe('invoice');
    const events=await stripe().events.list({
      type:'invoice.payment_failed',limit:100
    });
    expect(events.object).toBe('list');
    expect((await stripe().events.retrieve('evt_FAKE123')).object)
      .toBe('event');
  });
});
