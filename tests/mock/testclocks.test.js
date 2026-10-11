import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const idempotencyKey='rmcp_clock_create_test_12345';
describe('V-1b4c TEST clock endpoints on pinned Stripe SDK',()=>{
  it('creates and retrieves a named TEST clock',async()=>{
    const c=await stripe().testHelpers.testClocks.create({
      name:'RTC DEV Subscription Simulation',frozen_time:1700000000
    },{idempotencyKey});
    expect(c.object).toBe('test_helpers.test_clock');
    expect((await stripe().testHelpers.testClocks.retrieve('clock_FAKE123')).object)
      .toBe('test_helpers.test_clock');
  });
  it('advances a TEST clock with expected frozen_time parameter',async()=>{
    const c=await stripe().testHelpers.testClocks.advance('clock_FAKE123',{
      frozen_time:1700086400
    },{idempotencyKey});
    expect(c.object).toBe('test_helpers.test_clock');
  });
  it('lists TEST clocks with bounded paging',async()=>{
    const r=await stripe().testHelpers.testClocks.list({limit:20});
    expect(r.object).toBe('list');
  });
});
