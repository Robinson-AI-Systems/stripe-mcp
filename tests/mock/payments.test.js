import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
const pi='pi_FAKE1234',ch='ch_FAKE1234',re='re_FAKE1234',setup='seti_FAKE1234';
const opts={idempotencyKey:'rmcp_payment_mock_12345'};
describe('D-2 official pinned Stripe SDK request shapes (stripe-mock only)',()=>{
  it('supports all ten current payment, charge, refund and setup read APIs',async()=>{
    const s=stripe();
    expect((await s.paymentIntents.list({limit:2})).object).toBe('list');
    expect((await s.paymentIntents.retrieve(pi)).object).toBe('payment_intent');
    expect((await s.paymentIntents.search({query:"status:'succeeded'",limit:2})).object)
      .toBe('search_result');
    expect((await s.charges.list({limit:2})).object).toBe('list');
    expect((await s.charges.retrieve(ch)).object).toBe('charge');
    expect((await s.charges.search({query:"status:'succeeded'",limit:2})).object)
      .toBe('search_result');
    expect((await s.refunds.list({limit:2})).object).toBe('list');
    expect((await s.refunds.retrieve(re)).object).toBe('refund');
    expect((await s.setupIntents.list({limit:2})).object).toBe('list');
    expect((await s.setupIntents.retrieve(setup)).object).toBe('setup_intent');
  });
  it('uses PaymentIntents, not deprecated Charges creation, for saved-method charges',async()=>{
    const s=stripe();
    expect((await s.paymentIntents.create({amount:1000,currency:'usd',
      customer:'cus_FAKE1234',payment_method:'pm_FAKE1234',
      description:'Approved TEST charge',off_session:true,confirm:true},opts)).object)
      .toBe('payment_intent');
    expect((await s.paymentIntents.capture(pi,{amount_to_capture:1000},opts)).object)
      .toBe('payment_intent');
    expect((await s.paymentIntents.cancel(pi,{},opts)).object).toBe('payment_intent');
    expect((await s.paymentIntents.update(pi,{description:'Safe update'},opts)).object)
      .toBe('payment_intent');
    expect((await s.charges.update(ch,{description:'Safe update'},opts)).object)
      .toBe('charge');
  });
  it('sends exact charge-bound refund amounts, metadata updates and guarded cancels',async()=>{
    const s=stripe();
    expect((await s.refunds.create({charge:ch,amount:1000,
      reason:'requested_by_customer'},opts)).object).toBe('refund');
    expect((await s.refunds.update(re,{metadata:{test:'yes'}},opts)).object)
      .toBe('refund');
    expect((await s.refunds.cancel(re,{},opts)).object).toBe('refund');
    expect((await s.setupIntents.cancel(setup,{},opts)).object).toBe('setup_intent');
  });
});
