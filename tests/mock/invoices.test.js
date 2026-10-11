// D-5a pinned official Stripe SDK invoice routes: against local stripe-mock.
import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
const invoice='in_FAKE1234',customer='cus_FAKE1234';
const opts={idempotencyKey:'rmcp_invoice_mock_1234'};
describe('D-5 current Stripe 23.0.0 invoice request shapes',()=>{
  it('lists, gets, searches and previews invoices without a deprecated route',async()=>{
    const s=stripe();
    expect((await s.invoices.list({limit:2,customer})).object).toBe('list');
    expect((await s.invoices.retrieve(invoice)).object).toBe('invoice');
    expect((await s.invoices.search({query:"status:'draft'",limit:2})).object)
      .toBe('search_result');
    expect((await s.invoices.createPreview({customer,currency:'usd'})).object)
      .toBe('invoice');
    expect((await s.invoicePayments.list({invoice,limit:2})).object).toBe('list');
  });
  it('creates and edits explicitly manual draft invoice',async()=>{
    const s=stripe();
    expect((await s.invoices.create({
      customer,collection_method:'send_invoice',days_until_due:30,
      auto_advance:false,pending_invoice_items_behavior:'exclude',
      currency:'usd'
    },opts)).object).toBe('invoice');
    expect((await s.invoices.update(invoice,{
      description:'TEST invoice memo',auto_advance:false
    },opts)).object).toBe('invoice');
  });
  it('adds updates removes invoice draft items with pinned SDK routes',async()=>{
    const s=stripe(),item='ii_FAKE1234';
    expect((await s.invoiceItems.create({customer,invoice,
      currency:'usd',amount:1500,description:'Verified TEST labor'
    },opts)).object).toBe('invoiceitem');
    expect((await s.invoiceItems.retrieve(item)).object).toBe('invoiceitem');
    expect((await s.invoiceItems.update(item,{amount:1800,
      description:'Verified TEST labor revised'},opts)).object).toBe('invoiceitem');
    expect((await s.invoiceItems.del(item,{},opts)).deleted).toBe(true);
  });
});
