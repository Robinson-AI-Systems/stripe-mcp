// CAP-4 PROD-BILLING — billing-area coverage completion. The card's
// outcomes are a recorded v2 decision plus door/native dispositions;
// this suite pins the facts those dispositions rest on:
//
//   * The pinned catalog contains NO /v2 operation at all — the
//     universal door resolves operations from the pinned catalog,
//     so the four claimed v2 billing meter-event POSTs cannot be
//     dispatched by any existing surface (disposition (a): v2
//     meter events stay unserved until a v2 dispatch surface is
//     commissioned as its own unit; ruling 3(iv)).
//   * The billing-family GETs with no native read tool — the
//     billing alert by id, the credit grant by id, the credit
//     balance summary and transactions, the feedback option by
//     id, the single invoice payment — are door-sufficient: the
//     guarded universal read serves them, and its per-object
//     mode verification refuses a wrong-mode object in both
//     directions. These tests pass at baseline by design (they
//     pin existing door behavior the dispositions rely on).
//   * No native read tool exists for those GETs (the registry
//     pin) — the disposition record is the deliverable, per the
//     card's named-tests line for the disposition path.
import {describe,expect,it} from 'vitest';
import {handlers} from '../../src/tools/universal.js';
import {registry} from '../../src/tools/index.js';
import {catalog} from '../../src/stripe/openapi-index.js';

const acct='acct_PRODBILL';
const parse=r=>{try{return JSON.parse(r.content[0].text);}
  catch{return r.content[0].text;}};
function ctx(mode,fixture){
  const calls=[];
  const stripe={rawRequest:async(method,path,_params,_opts)=>{
    calls.push({method,path});
    return JSON.parse(JSON.stringify(fixture));}};
  return {calls,ctx:{connection:{mode,profile:'full',stripeAccount:acct},
    services:{stripeForConnection:async()=>stripe}}};
}
const MODE_MISMATCH='Provider response does not match authenticated account mode';
const alert=(livemode,over={})=>({id:'alrt_PRODBILL',object:'billing.alert',
  livemode,alert_type:'usage_threshold',status:'active',
  title:'Usage threshold fixture',
  usage_threshold:{billing_meter:'mtr_PRODBILL',gte_value:100,...over}});
const grant=(livemode,over={})=>({id:'credgr_PRODBILL',
  object:'billing.credit_grant',livemode,category:'purchase',
  customer:'cus_PRODBILL',
  amount:{type:'monetary',monetary:{value:5000,currency:'usd'}},
  priority:50,...over});
const balanceSummary=(livemode,over={})=>({object:'billing.credit_balance_summary',
  livemode,customer:'cus_PRODBILL',
  balances:[{available_balance:{type:'monetary',
    monetary:{value:5000,currency:'usd'}}}],...over});
const balanceTxn=(livemode,over={})=>({id:'cbtxn_PRODBILL',
  object:'billing.credit_balance_transaction',livemode,type:'grant',
  credit:{amount:{type:'monetary',monetary:{value:5000,currency:'usd'}}},
  credit_grant:'credgr_PRODBILL',...over});
const feedback=(livemode,over={})=>({id:'bfo_PRODBILL',
  object:'billing.feedback_option',livemode,status:'active',
  description:'Fixture feedback option',...over});
const invoicePayment=(livemode,over={})=>({id:'invpay_PRODBILL',
  object:'invoice_payment',livemode,amount_requested:{value:2000,currency:'usd'},
  invoice:'in_PRODBILL',status:'active',...over});
const listOf=item=>({object:'list',data:[item],has_more:false,
  url:'/v1/billing/credit_balance_transactions'});

describe('CAP-4 PROD-BILLING — the v2 meter-event surface has no dispatch surface',()=>{
  it('the pinned catalog contains no /v2 operation',()=>{
    const ops=[...catalog().operations.values()];
    expect(ops.length).toBeGreaterThan(400);
    expect(ops.every(o=>o.path.startsWith('/v1/'))).toBe(true);
  });
  it('none of the four claimed v2 meter-event paths is dispatchable',()=>{
    const paths=new Set([...catalog().operations.values()].map(o=>o.path));
    for(const p of ['/v2/billing/meter_events','/v2/billing/meter_event_stream',
      '/v2/billing/meter_event_session','/v2/billing/meter_event_adjustments'])
      expect(paths.has(p)).toBe(false);
  });
  it('the v1 ingestion route is the native meter_record_usage tool',()=>{
    const names=registry.tools.map(t=>t.name);
    expect(names).toContain('meter_record_usage');
  });
});

describe('CAP-4 PROD-BILLING — billing alert GET is door-sufficient',()=>{
  it('serves a TEST alert on a TEST connection',async()=>{
    const {ctx:c}=ctx('test',alert(false));
    const r=parse(await handlers.api_read(
      {op:'GetBillingAlertsId',pathParams:{id:'alrt_PRODBILL'}},c));
    expect(r.provider.id).toBe('alrt_PRODBILL');
  });
  it('serves a LIVE alert on a LIVE connection',async()=>{
    const {ctx:c}=ctx('live',alert(true));
    const r=parse(await handlers.api_read(
      {op:'GetBillingAlertsId',pathParams:{id:'alrt_PRODBILL'}},c));
    expect(r.provider.id).toBe('alrt_PRODBILL');
  });
  it('refuses a LIVE alert on a TEST connection',async()=>{
    const {ctx:c}=ctx('test',alert(true));
    const r=parse(await handlers.api_read(
      {op:'GetBillingAlertsId',pathParams:{id:'alrt_PRODBILL'}},c));
    expect(r).toBe(MODE_MISMATCH);
  });
  it('refuses a TEST alert on a LIVE connection',async()=>{
    const {ctx:c}=ctx('live',alert(false));
    const r=parse(await handlers.api_read(
      {op:'GetBillingAlertsId',pathParams:{id:'alrt_PRODBILL'}},c));
    expect(r).toBe(MODE_MISMATCH);
  });
});

describe('CAP-4 PROD-BILLING — billing credit GETs are door-sufficient',()=>{
  it('serves a credit grant by id, mode-matched',async()=>{
    const {ctx:c}=ctx('test',grant(false));
    const r=parse(await handlers.api_read(
      {op:'GetBillingCreditGrantsId',pathParams:{id:'credgr_PRODBILL'}},c));
    expect(r.provider.id).toBe('credgr_PRODBILL');
  });
  it('refuses a wrong-mode credit grant by id',async()=>{
    const {ctx:c}=ctx('live',grant(false));
    const r=parse(await handlers.api_read(
      {op:'GetBillingCreditGrantsId',pathParams:{id:'credgr_PRODBILL'}},c));
    expect(r).toBe(MODE_MISMATCH);
  });
  it('serves the credit balance summary, mode-matched',async()=>{
    const {ctx:c}=ctx('live',balanceSummary(true));
    const r=parse(await handlers.api_read(
      {op:'GetBillingCreditBalanceSummary',
        query:{customer:'cus_PRODBILL',filter:{type:'applicability_scope',
          applicability_scope:{price_type:'metered'}}}},c));
    expect(r.provider.customer).toBe('cus_PRODBILL');
  });
  it('refuses a wrong-mode credit balance summary',async()=>{
    const {ctx:c}=ctx('test',balanceSummary(true));
    const r=parse(await handlers.api_read(
      {op:'GetBillingCreditBalanceSummary',
        query:{customer:'cus_PRODBILL',filter:{type:'applicability_scope',
          applicability_scope:{price_type:'metered'}}}},c));
    expect(r).toBe(MODE_MISMATCH);
  });
  it('serves the credit balance transaction list',async()=>{
    const {ctx:c}=ctx('test',listOf(balanceTxn(false)));
    const r=parse(await handlers.api_read(
      {op:'GetBillingCreditBalanceTransactions',
        query:{customer:'cus_PRODBILL'}},c));
    expect(r.provider.data[0].id).toBe('cbtxn_PRODBILL');
  });
  it('serves a credit balance transaction by id, mode-matched',async()=>{
    const {ctx:c}=ctx('test',balanceTxn(false));
    const r=parse(await handlers.api_read(
      {op:'GetBillingCreditBalanceTransactionsId',
        pathParams:{id:'cbtxn_PRODBILL'}},c));
    expect(r.provider.id).toBe('cbtxn_PRODBILL');
  });
});

describe('CAP-4 PROD-BILLING — feedback option and invoice payment GETs are door-sufficient',()=>{
  it('serves a feedback option by id, mode-matched',async()=>{
    const {ctx:c}=ctx('test',feedback(false));
    const r=parse(await handlers.api_read(
      {op:'GetBillingFeedbackOptionsId',pathParams:{id:'bfo_PRODBILL'}},c));
    expect(r.provider.id).toBe('bfo_PRODBILL');
  });
  it('refuses a wrong-mode feedback option by id',async()=>{
    const {ctx:c}=ctx('live',feedback(false));
    const r=parse(await handlers.api_read(
      {op:'GetBillingFeedbackOptionsId',pathParams:{id:'bfo_PRODBILL'}},c));
    expect(r).toBe(MODE_MISMATCH);
  });
  it('serves a single invoice payment, mode-matched',async()=>{
    const {ctx:c}=ctx('test',invoicePayment(false));
    const r=parse(await handlers.api_read(
      {op:'GetInvoicePaymentsInvoicePayment',
        pathParams:{invoice_payment:'invpay_PRODBILL'}},c));
    expect(r.provider.id).toBe('invpay_PRODBILL');
  });
});

describe('CAP-4 PROD-BILLING — no native read tool claims the door-sufficient GETs',()=>{
  it('registers no alert-get, credit-balance or feedback read tool',()=>{
    const names=registry.tools.map(t=>t.name);
    expect(names.some(n=>n==='alert_get'||/credit_balance|feedback/.test(n)))
      .toBe(false);
    // The native reads that DO exist for this area are the ones the
    // sweep records (E-3/E-4/D-3/D-12); the gap GETs stay door-served.
    for(const n of ['meter_list','meter_get','meter_list_usage_summaries',
      'alert_list','credit_list_grants','invoice_list','billing_list_subscriptions',
      'quote_list','brand_list_invoice_templates'])
      expect(names).toContain(n);
  });
});
