// D-4 exact official SDK routes and nested request shapes; stripe-mock, never Stripe live.
import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
const sub='sub_FAKE1234',si='si_FAKE1234',customer='cus_FAKE1234';
const price='price_FAKE1234',opts={idempotencyKey:'rmcp_billing_mock_1234'};
describe('D-4 official Stripe 23.0.0 subscription requests',()=>{
  it('supports listing, retrieving, searching, and item period retrieval',async()=>{
    const s=stripe();
    expect((await s.subscriptions.list({limit:2})).object).toBe('list');
    expect((await s.subscriptions.retrieve(sub)).object).toBe('subscription');
    expect((await s.subscriptions.search({query:"status:'active'",limit:2})).object).toBe('search_result');
    expect((await s.subscriptionItems.list({subscription:sub,limit:2})).object).toBe('list');
  });
  it('creates preview using current endpoint and nested subscription items',async()=>{
    const s=stripe();
    expect((await s.invoices.createPreview({
      customer,currency:'usd',subscription_details:{items:[{price,quantity:1}],
        billing_mode:{type:'flexible'},proration_behavior:'none'}
    })).object).toBe('invoice');
    expect((await s.invoices.createPreview({
      subscription:sub,currency:'usd',
      subscription_details:{items:[{id:si,price,quantity:2}],
        proration_date:1791676800,proration_behavior:'create_prorations'}
    })).object).toBe('invoice');
  });
  it('creates and changes native subscriptions with pinned request shape',async()=>{
    const s=stripe();
    expect((await s.subscriptions.create({
      customer,items:[{price,quantity:1}],currency:'usd',
      collection_method:'charge_automatically',
      payment_behavior:'error_if_incomplete',
      billing_mode:{type:'flexible'},proration_behavior:'none'
    },opts)).object).toBe('subscription');
    expect((await s.subscriptions.update(sub,{
      items:[{id:si,price,quantity:2}],proration_behavior:'create_prorations',
      proration_date:1791676800,payment_behavior:'error_if_incomplete'
    },opts)).object).toBe('subscription');
    expect((await s.subscriptions.update(sub,{
      billing_cycle_anchor:{type:'now'},
      proration_behavior:'none',proration_date:1791676800
    },opts)).object).toBe('subscription');
  });
  it('cancels correctly using update for period-end and cancel for now',async()=>{
    const s=stripe();
    expect((await s.subscriptions.update(sub,{cancel_at_period_end:true},opts))
      .object).toBe('subscription');
    expect((await s.subscriptions.update(sub,{cancel_at_period_end:false},opts))
      .object).toBe('subscription');
    expect((await s.subscriptions.cancel(sub,{invoice_now:false,prorate:false},opts))
      .object).toBe('subscription');
  });
  it('pauses and resumes collection using official update payloads',async()=>{
    const s=stripe();
    expect((await s.subscriptions.update(sub,{
      pause_collection:{behavior:'keep_as_draft'}
    },opts)).object).toBe('subscription');
    expect((await s.subscriptions.update(sub,{pause_collection:''},opts))
      .object).toBe('subscription');
  });
  it('lists and retrieves native subscription schedules',async()=>{
    const s=stripe();
    expect((await s.subscriptionSchedules.list({limit:2})).object).toBe('list');
    expect((await s.subscriptionSchedules.retrieve('sub_sched_FAKE1234'))
      .object).toBe('subscription_schedule');
  });
});
