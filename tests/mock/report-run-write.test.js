import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('uses official pinned reporting type retrieve and async report run create',async()=>{
  const s=makeStripeClient({key,mode:'test'},{
    host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  expect((await s.reporting.reportTypes.retrieve('balance.summary.1')).object)
    .toBe('reporting.report_type');
  expect((await s.reporting.reportRuns.create({report_type:'balance.summary.1',
    parameters:{interval_start:1680000000,interval_end:1680010000}},
    {idempotencyKey:'rmcp_report_run_mock_1234'})).object)
    .toBe('reporting.report_run');
});
