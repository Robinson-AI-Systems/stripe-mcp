import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const opts={idempotencyKey:'rmcp_dependent_cleanup_123'};
describe('V-2b current-native pinned TEST dependent deletion calls',()=>{
  it('reads connected-account balance through the Stripe-Account option',async()=>{
    const balance=await sdk().balance.retrieve({stripeAccount:'acct_FAKE123'});
    expect(balance.object).toBe('balance');
  });
  it('deletes an exact connected seller using pinned native account API',async()=>{
    const r=await sdk().accounts.del('acct_FAKE123',{},opts);
    expect(r.object).toBe('account');
  });
  it('lists only customers attached to one clock with a bounded filter',async()=>{
    const list=await sdk().customers.list({test_clock:'clock_FAKE123',limit:1});
    expect(list.object).toBe('list');
  });
  it('uses native TEST clock delete endpoint with idempotency',async()=>{
    const r=await sdk().testHelpers.testClocks.del('clock_FAKE123',{},opts);
    expect(r.object).toBe('test_helpers.test_clock');
  });
});
