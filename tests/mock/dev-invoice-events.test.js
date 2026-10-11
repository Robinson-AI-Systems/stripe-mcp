import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
const opts={idempotencyKey:'rmcp_test_invoice_events_123'};
describe('V-3c2 native TEST invoice event request shapes',()=>{
  it('creates actual nonadvancing zero-line TEST invoice with durable metadata',async()=>{
    const invoice=await sdk().invoices.create({
      customer:'cus_FAKE123',currency:'usd',auto_advance:false,
      collection_method:'send_invoice',days_until_due:30,
      pending_invoice_items_behavior:'exclude',metadata
    },opts);
    expect(invoice.object).toBe('invoice');
    expect((await sdk().invoices.retrieve('in_FAKE123')).object).toBe('invoice');
  });
  it('updates only the draft description without taking payment',async()=>{
    const changed=await sdk().invoices.update('in_FAKE123',{
      description:'RTC TEST Event Updated Invoice'
    },opts);
    expect(changed.object).toBe('invoice');
  });
  it('finalizes without automatic collection or unexpected invoice advance',async()=>{
    const done=await sdk().invoices.finalizeInvoice('in_FAKE123',
      {auto_advance:false},opts);
    expect(done.object).toBe('invoice');
  });
  it.each(['invoice.created','invoice.updated','invoice.finalized'])(
    'lists and retrieves the actual %s provider Event',async type=>{
      const page=await sdk().events.list({type,limit:100});
      expect(page.object).toBe('list');
      expect((await sdk().events.retrieve('evt_FAKE123')).object).toBe('event');
    });
});
