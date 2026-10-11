import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('uses pinned Stripe report-run and private file metadata retrieve endpoints',async()=>{
  const stripe=makeStripeClient({key,mode:'test'},{
    host:'127.0.0.1',port:12111,protocol:'http',
    maxNetworkRetries:0,timeout:5000});
  expect((await stripe.reporting.reportRuns.retrieve('frr_FAKE1234')).object)
    .toBe('reporting.report_run');
  expect((await stripe.files.retrieve('file_FAKE1234')).object).toBe('file');
});
