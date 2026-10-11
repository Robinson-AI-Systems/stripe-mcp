import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
const cs='cs_test_FAKE1234',plink='plink_FAKE1234',bpc='bpc_FAKE1234',
  customer='cus_FAKE1234',price='price_FAKE1234';
const opts={idempotencyKey:'rmcp_hosted_mock_12345'};
describe('D-3 official pinned Stripe SDK hosted flows (stripe-mock only)',()=>{
  it('reads Checkout sessions, line items, links and portal configurations',async()=>{
    const s=stripe();
    expect((await s.checkout.sessions.list({limit:2})).object).toBe('list');
    expect((await s.checkout.sessions.retrieve(cs)).object).toBe('checkout.session');
    expect((await s.checkout.sessions.listLineItems(cs,{limit:2})).object).toBe('list');
    expect((await s.paymentLinks.list({limit:2})).object).toBe('list');
    expect((await s.paymentLinks.retrieve(plink)).object).toBe('payment_link');
    expect((await s.billingPortal.configurations.list({limit:2})).object).toBe('list');
    expect((await s.billingPortal.configurations.retrieve(bpc)).object)
      .toBe('billing_portal.configuration');
  });
  it('creates verified payment and setup Checkout sessions with nested line items',async()=>{
    const s=stripe(),urls={success_url:'https://example.test/payment/success',
      cancel_url:'https://example.test/payment/cancel'};
    expect((await s.checkout.sessions.create({
      mode:'payment',customer,
      line_items:[{price_data:{currency:'usd',unit_amount:8500,
        product_data:{name:'Safe test service'}},quantity:1}],
      payment_method_types:['card'],...urls
    },opts)).object).toBe('checkout.session');
    expect((await s.checkout.sessions.create({
      mode:'setup',customer,payment_method_types:['card','us_bank_account'],
      ...urls
    },opts)).object).toBe('checkout.session');
    expect((await s.checkout.sessions.expire(cs,{},opts)).object).toBe('checkout.session');
  });
  it('creates and updates reusable paylinks, using only verified Stripe price IDs',async()=>{
    const s=stripe();
    expect((await s.prices.retrieve(price)).object).toBe('price');
    expect((await s.paymentLinks.create({line_items:[{price,quantity:1}]},opts)).object)
      .toBe('payment_link');
    expect((await s.paymentLinks.update(plink,{active:false},opts)).object)
      .toBe('payment_link');
    expect((await s.paymentLinks.update(plink,{metadata:{test:'safe'}},opts)).object)
      .toBe('payment_link');
  });
  it('creates portal session and changes feature policy with exact official methods',async()=>{
    const s=stripe();
    expect((await s.billingPortal.sessions.create({
      customer,configuration:bpc,return_url:'https://example.test/portal/return'
    },opts)).object).toBe('billing_portal.session');
    expect((await s.billingPortal.configurations.update(bpc,{
      features:{subscription_cancel:{enabled:false}}
    },opts)).object).toBe('billing_portal.configuration');
  });
});
