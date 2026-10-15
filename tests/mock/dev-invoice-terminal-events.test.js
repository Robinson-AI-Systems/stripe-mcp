import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
const opts={idempotencyKey:'rmcp_test_terminal_invoice_123'};
describe('Stripe-mock terminal TEST invoice provider request shapes',()=>{
  it('creates no-auto-advance send-invoice draft and exact positive line',async()=>{
    expect((await sdk().invoices.create({
      customer:'cus_FAKE123',currency:'usd',auto_advance:false,
      collection_method:'send_invoice',days_until_due:30,
      pending_invoice_items_behavior:'exclude',metadata
    },opts)).object).toBe('invoice');
    expect((await sdk().invoiceItems.create({
      customer:'cus_FAKE123',invoice:'in_FAKE123',amount:3600,
      currency:'usd',metadata,description:'Synthetic uncharged terminal TEST invoice'
    },opts)).object).toBe('invoiceitem');
  });
  it('finalizes without collecting payment or sending email',async()=>{
    expect((await sdk().invoices.finalizeInvoice('in_FAKE123',{
      auto_advance:false
    },opts)).object).toBe('invoice');
  });
  it('voids the exact native TEST invoice',async()=>{
    expect((await sdk().invoices.voidInvoice('in_FAKE123',{},
      opts)).object).toBe('invoice');
  });
  it('marks exact native TEST invoice uncollectible',async()=>{
    expect((await sdk().invoices.markUncollectible('in_FAKE123',{},
      opts)).object).toBe('invoice');
  });
  it.each(['invoice.voided','invoice.marked_uncollectible'])(
    'lists and retrieves native %s Event',async type=>{
      expect((await sdk().events.list({type,limit:100})).object).toBe('list');
      expect((await sdk().events.retrieve('evt_FAKE123')).object).toBe('event');
    });
});
