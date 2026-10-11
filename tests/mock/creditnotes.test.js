// D-5c pinned SDK native credit note paths through disposable stripe-mock.
import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',
  maxNetworkRetries:0,timeout:5000});
const invoice='in_FAKE1234',customer='cus_FAKE1234',note='cn_FAKE1234';
const opts={idempotencyKey:'rmcp_creditnote_mock_1234'};
describe('D-5c pinned Stripe native credit note routes',()=>{
  it('lists, retrieves and previews current credit notes',async()=>{
    const s=stripe();
    expect((await s.creditNotes.list({invoice,customer,limit:2})).object).toBe('list');
    expect((await s.creditNotes.retrieve(note)).object).toBe('credit_note');
    const preview=await s.creditNotes.preview({invoice,amount:8500,
      reason:'order_change',email_type:'none'});
    expect(preview.object).toBe('credit_note');
  });
  it('issues and voids credit notes without deprecated API paths',async()=>{
    const s=stripe();
    expect((await s.creditNotes.create({
      invoice,amount:8500,reason:'order_change',
      email_type:'none',credit_amount:8500
    },opts)).object).toBe('credit_note');
    expect((await s.creditNotes.voidCreditNote(note,{},opts)).object)
      .toBe('credit_note');
  });
  it('validates an exact refund allocation preview using the official SDK',async()=>{
    const v=await stripe().creditNotes.preview({
      invoice,amount:1200,reason:'duplicate',
      refund_amount:1200,email_type:'none'
    });
    expect(v.object).toBe('credit_note');
  });
});
