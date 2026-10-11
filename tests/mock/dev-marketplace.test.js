import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const opts={idempotencyKey:'rmcp_connect_marketplace_test_1'};
const metadata={rtc_run:'run_'+'a'.repeat(24)};
describe('V-1b4f pinned Connect account API shapes',()=>{
  it('retrieves platform account and lists Connect accounts',async()=>{
    expect((await sdk().accounts.retrieve()).object).toBe('account');
    const list=await sdk().accounts.list({limit:1});
    expect(list.object).toBe('list');
  });
  it('creates and independently retrieves synthetic Express TEST seller',async()=>{
    const a=await sdk().accounts.create({
      type:'express',country:'US',
      email:'rtc-dev+run_aaaaaaaaaaaaaaaaaaaaaaaa-1@example.test',
      capabilities:{transfers:{requested:true}},metadata
    },opts);
    expect(a.object).toBe('account');
    expect((await sdk().accounts.retrieve('acct_FAKE123')).object).toBe('account');
  });
});
