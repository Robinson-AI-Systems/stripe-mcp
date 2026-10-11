import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('uses official pinned Stripe reporting types, run lists and retrieval',async()=>{
  const s=makeStripeClient({key,mode:'test'},{
    host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  expect((await s.reporting.reportTypes.list()).object).toBe('list');
  expect((await s.reporting.reportRuns.list({limit:2})).object).toBe('list');
  expect((await s.reporting.reportRuns.retrieve('frr_FAKE1234')).object)
    .toBe('reporting.report_run');
});
