// CAP-4 D-8 §A: the nine workflow READ composites follow the
// connection's own mode. The shared verifyContext stays TEST-only for
// the write composites (preservation clause — SPLIT route): the read
// composites opt into verifyModeContext via workflow-read-common's
// {verify} plumbing; every write consumer keeps the legacy path.
import {describe,it,expect,vi,afterEach} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {APP_SEED} from '../../src/apps/profiles.js';
import {verifyContext,verifyModeContext,nativeRead,dateWindow}
  from '../../src/tools/workflow-read-common.js';

afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
const A='acct_D8A987',C='cus_D8A987',CH='ch_D8A987',DU='du_D8A987',
  IN='in_D8A987',WE='we_D8A987',RUN='frr_D8A987',TYPE='balance.summary.1';
const LEGACY='An exact selected TEST account and permitted read profile are required';
const parse=r=>{const t=r.content?.[0]?.text;try{return JSON.parse(t);}catch{return t;}};
const text=r=>r.content?.[0]?.text??'';

function fixture(livemode,{wrong=null}={}){
  const flip=obj=>wrong===obj?{...obj,livemode:!livemode}:obj;
  const db=createFakeDb({accounts:[{id:A,label:'D8 fixture',
    test_key_kind:'restricted',live_key_kind:'restricted',
    ...(livemode?{live_enabled:true,live_connected:true}:{})}]});
  const now=Math.floor(Date.now()/1000);
  const customer={object:'customer',id:C,livemode,
    metadata:{agreementId:'agreement_987'},email:'owner@example.invalid',
    name:'Fixture Owner'};
  const charge={object:'charge',id:CH,livemode,customer:C,
    payment_intent:'pi_D8A987',metadata:{agreementId:'agreement_987'},
    amount:3600,amount_refunded:0,status:'succeeded',paid:true,
    currency:'usd',refunded:false,disputed:true};
  const dispute={object:'dispute',id:DU,livemode,status:'needs_response',
    charge:CH,payment_intent:'pi_D8A987',amount:3600,currency:'usd',
    reason:'fraudulent',created:now-5000,evidence:{},
    evidence_details:{due_by:now+7200,submission_count:0,
      past_due:false,has_evidence:false}};
  const invoice={id:IN,object:'invoice',livemode,customer:C,currency:'usd',
    status:'open',total:3600,amount_due:3600,amount_paid:0,
    amount_remaining:3600,attempt_count:2,next_payment_attempt:now+86400,
    hosted_invoice_url:'https://invoice.stripe.com/i/fixture-'+IN,
    lines:{data:[],has_more:false},metadata:{},created:now-4000};
  const payment={id:'pi_D8A987',object:'payment_intent',livemode,
    status:'requires_payment_method',currency:'usd',amount:3600,
    amount_received:0,customer:C,description:'Fixture payment',
    last_payment_error:{code:'card_declined',decline_code:'mystery_code'},
    created:now-4000,metadata:{}};
  const item={id:'si_D8A987',quantity:1,
    price:{id:'price_D8A987',unit_amount:3000,currency:'usd',
      billing_scheme:'per_unit',
      recurring:{interval:'month',interval_count:1,usage_type:'licensed'}},
    discounts:[]};
  const sub={object:'subscription',id:'sub_D8A987',status:'active',
    customer:C,currency:'usd',items:{data:[item],has_more:false},
    discounts:[],metadata:{},pause_collection:null};
  const txn={object:'balance_transaction',id:'txn_D8A987',amount:6000,
    fee:200,net:5800,currency:'usd',
    created:Math.floor(Date.parse('2026-03-15T12:00:00Z')/1000)};
  const required=APP_SEED.webhook_events;
  const hook={object:'webhook_endpoint',id:WE,livemode,status:'enabled',
    url:APP_SEED.webhook_url,created:now-1000,
    api_version:'2026-09-30.endive',application:null,connect:null,
    metadata:{},enabled_events:[...required,'customer.updated']};
  const win=dateWindow('2026-03-01','2026-03-31');
  const run={id:RUN,object:'reporting.report_run',livemode,
    report_type:TYPE,created:win.from+100,status:'succeeded',
    parameters:{interval_start:win.from,interval_end:win.until},
    result:{id:'file_D8A987',object:'file',size:4321,created:win.from+200,
      purpose:'finance_report_run',filename:'report.csv'}};
  const page=records=>async()=>({data:records,has_more:false});
  const sdk={
    accounts:{retrieve:async()=>({id:A,object:'account',livemode,
      charges_enabled:true,details_submitted:true,business_profile:{},
      settings:{branding:{},payments:{}}})},
    balance:{retrieve:async()=>({object:'balance',livemode,
      available:[],pending:[]})},
    customers:{retrieve:async()=>flip(customer),
      search:async()=>({data:[flip(customer)],has_more:false}),
      list:page([flip(customer)])},
    charges:{retrieve:async()=>flip(charge),
      search:async()=>({data:[flip(charge)],has_more:false})},
    disputes:{retrieve:async()=>flip(dispute)},
    invoices:{list:page([flip(invoice)]),retrieve:async()=>flip(invoice),
      listLineItems:async()=>({data:[],has_more:false}),
      search:async()=>({data:[flip(invoice)],has_more:false})},
    invoicePayments:{list:async()=>({data:[{object:'invoice_payment',
      id:'inpay_D8A987',invoice:IN,status:'paid',amount_paid:3600,
      amount_requested:3600,
      payment:{payment_intent:'pi_D8A987',charge:CH}}],has_more:false})},
    paymentIntents:{list:page([payment]),
      search:async()=>({data:[payment],has_more:false})},
    subscriptions:{list:page([sub])},
    subscriptionItems:{list:async()=>({data:[item],has_more:false})},
    balanceTransactions:{list:page([flip(txn)])},
    files:{retrieve:async()=>({id:'file_D8A987',object:'file',livemode,
      size:4321,created:win.from+200,purpose:'finance_report_run',
      filename:'report.csv'})},
    webhookEndpoints:{retrieve:async()=>flip(hook),list:page([flip(hook)])},
    events:{list:async()=>({data:[{object:'event',id:'evt_D8A987',
      type:'charge.succeeded',created:now-1000,livemode,
      pending_webhooks:2,data:{object:{id:CH,object:'charge'}}}],
      has_more:false})},
    reporting:{
      reportTypes:{list:page([{object:'reporting.report_type',id:TYPE,
        livemode,name:'Balance Summary',version:'1',
        data_available_start:1767225600,data_available_end:1798761600,
        default_columns:[]}]),
        retrieve:async()=>({object:'reporting.report_type',id:TYPE,
          livemode,data_available_start:1767225600,
          data_available_end:1798761600})},
      reportRuns:{list:page([flip(run)]),retrieve:async()=>flip(run)}}
  };
  if(livemode)vi.stubEnv('VERCEL_ENV','production');
  const ctx={connection:{mode:livemode?'live':'test',profile:'full',
    stripeAccount:A},connectionId:'d8a-fixture',db,
    services:{stripeForConnection:async()=>sdk}};
  return {db,sdk,ctx,customer,charge,dispute,invoice,txn,hook,run,
    call:(name,args)=>registry.handlers[name](args,ctx),
    async bind(){await db.bindKnownAppAccount(
      {id:'appliance-desk',account:A,expectedVersion:1,attach:true});}};
}

describe('CAP-4 D-8 §A context helpers (split route)',()=>{
  const ctxFor=mode=>({connection:{mode,profile:'full',stripeAccount:A}});
  it('verifyContext keeps the exact legacy TEST-only contract',()=>{
    expect(()=>verifyContext(ctxFor('test'))).not.toThrow();
    expect(()=>verifyContext(ctxFor('live'))).toThrow(LEGACY);
  });
  it('verifyModeContext admits both modes and substitutes the mode word',()=>{
    expect(()=>verifyModeContext(ctxFor('test'))).not.toThrow();
    expect(()=>verifyModeContext(ctxFor('live'))).not.toThrow();
    const bad={connection:{mode:'live',profile:'full',stripeAccount:'acct_BAD'}};
    // acct_BAD still matches the account pattern; use a malformed id instead.
    bad.connection.stripeAccount='not-an-account';
    expect(()=>verifyModeContext(bad)).toThrow(
      'An exact selected LIVE account and permitted read profile are required');
    bad.connection.mode='test';
    expect(()=>verifyModeContext(bad)).toThrow(LEGACY);
  });
  it('nativeRead defaults to the legacy verifier (write-path behavior)',async()=>{
    const f=fixture(true);await f.bind();
    await expect(nativeRead('customer_get',{customerId:C},f.ctx))
      .rejects.toThrow(LEGACY);
    const out=await nativeRead('customer_get',{customerId:C},f.ctx,
      {verify:verifyModeContext});
    expect(out.id).toBe(C);
  });
});

describe('CAP-4 D-8 §A workflow_customer_overview + workflow_failed_payments',()=>{
  it('serves TEST end-to-end with baseline stamps and wording',async()=>{
    const f=fixture(false);
    const failed=parse(await f.call('workflow_failed_payments',{}));
    expect(failed).toMatchObject({mode:'test',complete:true,
      counts:{unpaidAttemptedInvoices:1,failedPaymentIntents:1}});
    expect(failed.failedPayments[0].reason).toContain('TEST Dashboard');
    const over=parse(await f.call('workflow_customer_overview',{customerId:C}));
    expect(over).toMatchObject({mode:'test',complete:true});
    expect(over.explanation).toContain('TEST customer-owned billing records');
  });
  it('serves LIVE end-to-end with connection-mode stamps and wording',async()=>{
    const f=fixture(true);
    const failed=parse(await f.call('workflow_failed_payments',{}));
    expect(failed).toMatchObject({mode:'live',complete:true,
      counts:{unpaidAttemptedInvoices:1,failedPaymentIntents:1}});
    expect(failed.failedPayments[0].reason).toContain('LIVE Dashboard');
    const over=parse(await f.call('workflow_customer_overview',{customerId:C}));
    expect(over).toMatchObject({mode:'live',complete:true});
    expect(over.explanation).toContain('LIVE customer-owned billing records');
  });
  it('fails the composite when any composed object is wrong-mode',async()=>{
    const f=fixture(true);
    f.sdk.invoices.list=async()=>({data:[{...f.invoice,livemode:false}],
      has_more:false});
    const failed=parse(await f.call('workflow_failed_payments',{}));
    expect(failed.complete).toBe(false);
    // The overview's own verified customer read is not collect-based:
    // a wrong-mode customer refuses the whole composite.
    f.sdk.customers.retrieve=async()=>({...f.customer,livemode:false});
    const over=await f.call('workflow_customer_overview',{customerId:C});
    expect(over.isError).toBe(true);
  });
});

describe('CAP-4 D-8 §A workflow_money_snapshot + workflow_month_end_close',()=>{
  const march={fromDate:'2026-03-01',toDate:'2026-03-31'};
  it('stamps the snapshot with the connection mode in both modes',async()=>{
    const t=fixture(false);
    expect(parse(await t.call('workflow_money_snapshot',march)))
      .toMatchObject({mode:'test',complete:true});
    const l=fixture(true);
    const snap=parse(await l.call('workflow_money_snapshot',march));
    expect(snap).toMatchObject({mode:'live',complete:true});
    expect(snap.explanation).toContain('LIVE balance transaction');
  });
  it('reports an incomplete snapshot when a composed row is wrong-mode',async()=>{
    const l=fixture(true);
    l.sdk.balanceTransactions.list=async()=>({data:[{...l.txn,
      livemode:false}],has_more:false});
    const snap=parse(await l.call('workflow_money_snapshot',march));
    expect(snap.complete).toBe(false);
    expect(snap.balanceTransactionCount).toBe(0);
  });
  it('month-end close composes the snapshot of the same mode',async()=>{
    const t=fixture(false);
    expect(parse(await t.call('workflow_month_end_close',{month:'2026-03'})))
      .toMatchObject({mode:'test',complete:true,moneyFlowsComplete:true});
    const l=fixture(true);
    expect(parse(await l.call('workflow_month_end_close',{month:'2026-03'})))
      .toMatchObject({mode:'live',complete:true,moneyFlowsComplete:true});
  });
  it('serves a same-mode stored report run and keeps the other mode partitioned',async()=>{
    const t=fixture(false);
    const closed=parse(await t.call('workflow_month_end_close',
      {month:'2026-03',runId:RUN}));
    expect(closed.mode).toBe('test');
    expect(closed.report).toMatchObject({id:RUN,status:'succeeded',
      resultFileId:'file_D8A987'});
    expect(closed.report.privateExport.downloadUrl).toBeNull();
    // The very same provider run, still TEST-stamped, is NOT served
    // (or silently re-stamped) under a LIVE connection: the D-6
    // verified read partitions stored report runs by mode.
    const l=fixture(true);
    l.sdk.reporting.reportRuns.retrieve=async()=>({...l.run,livemode:false});
    const denied=await l.call('workflow_month_end_close',
      {month:'2026-03',runId:RUN});
    expect(denied.isError).toBe(true);
  });
});

describe('CAP-4 D-8 §A workflow_find',()=>{
  it('searches in the connection mode in both modes',async()=>{
    const t=fixture(false);
    expect(parse(await t.call('workflow_find',
      {type:'customer',query:"email:'owner@example.invalid'"})))
      .toMatchObject({mode:'test',complete:true,resultCount:1});
    const l=fixture(true);
    expect(parse(await l.call('workflow_find',
      {type:'customer',query:"email:'owner@example.invalid'"})))
      .toMatchObject({mode:'live',complete:true,resultCount:1});
  });
  it('degrades honestly when the composed search returns wrong-mode rows',async()=>{
    const l=fixture(true);
    l.sdk.customers.search=async()=>({data:[{...l.customer,
      livemode:false}],has_more:false});
    const out=parse(await l.call('workflow_find',
      {type:'customer',query:"email:'owner@example.invalid'"}));
    expect(out).toMatchObject({mode:'live',complete:false,
      reason:'provider_search_unavailable',resultCount:0});
  });
});

describe('CAP-4 D-8 §A workflow_dispute_kit (read)',()=>{
  it('prepares the kit in both modes with the connection-mode stamp',async()=>{
    const t=fixture(false);await t.bind();
    const testKit=parse(await t.call('workflow_dispute_kit',
      {disputeId:DU,invoiceId:IN,app:'appliance-desk'}));
    expect(testKit).toMatchObject({mode:'test',complete:true,
      actualBankSubmission:false});
    const l=fixture(true);await l.bind();
    const liveKit=parse(await l.call('workflow_dispute_kit',
      {disputeId:DU,invoiceId:IN,app:'appliance-desk'}));
    // On LIVE the dispute, charge and invoice all verify in-mode.
    // The one honest gap is the app agreement link: project_record_link
    // is a Projects read that stays TEST-gated until the owner-surface
    // migration (coordinator ruling 4), so examine() records the gap
    // and the agreement lands on the checklist instead of fabricating.
    expect(liveKit).toMatchObject({mode:'live',complete:false,
      actualBankSubmission:false,agreement:null,
      dispute:{id:DU,needsResponse:true},invoice:{id:IN}});
    expect(liveKit.gaps).toEqual([{section:'app_agreement_link',
      reason:'guarded_profile_route_unavailable'}]);
    expect(JSON.stringify(liveKit)).not.toContain('owner@example.invalid');
  });
  it('refuses when the composed dispute is wrong-mode',async()=>{
    const l=fixture(true);await l.bind();
    l.sdk.disputes.retrieve=async()=>({...l.dispute,livemode:false});
    const out=await l.call('workflow_dispute_kit',{disputeId:DU});
    expect(out.isError).toBe(true);
    expect(text(out)).toContain('LIVE');
  });
});

describe('CAP-4 D-8 §A workflow_webhook_health (read)',()=>{
  it('serves both modes; the closing note follows the connection',async()=>{
    const t=fixture(false);await t.bind();
    const testOut=parse(await t.call('workflow_webhook_health',
      {endpointId:WE,apps:['appliance-desk']}));
    expect(testOut).toMatchObject({mode:'test',complete:true});
    expect(testOut.note).toContain('No LIVE endpoint was queried or altered');
    const l=fixture(true);await l.bind();
    const liveOut=parse(await l.call('workflow_webhook_health',
      {endpointId:WE,apps:['appliance-desk']}));
    expect(liveOut).toMatchObject({mode:'live',complete:true});
    expect(liveOut.note).toContain('queried read-only');
  });
  it('refuses when the composed endpoint is wrong-mode',async()=>{
    const l=fixture(true);await l.bind();
    l.sdk.webhookEndpoints.retrieve=async()=>({...l.hook,livemode:false});
    const out=await l.call('workflow_webhook_health',
      {endpointId:WE,apps:['appliance-desk']});
    expect(out.isError).toBe(true);
  });
});

describe('CAP-4 D-8 §A workflow_go_live_checklist + workflow_app_readiness',()=>{
  it('TEST checklist composes the TEST matrix and the LIVE sentinel (parity pattern preserved)',async()=>{
    const f=fixture(false);await f.bind();
    const out=parse(await f.call('workflow_go_live_checklist',{}));
    expect(out).toMatchObject({mode:'test',complete:true,projectCount:1,
      liveProviderQueried:false,liveParity:'not_verified'});
    expect(out.projects[0].live).toMatchObject({readPerformed:false,
      parityVerified:false,needsSeparateOwnerApproval:true});
    expect(out.projects[0].test.checks).toHaveLength(21);
  });
  it('LIVE checklist never fabricates a TEST matrix: verified LIVE observations meet the matrix refusal',async()=>{
    const f=fixture(true);await f.bind();
    // The composite's internal contract still requires the TEST
    // readiness matrix. A LIVE connection's readiness read succeeds
    // against real LIVE data but returns a LIVE-mode matrix, so the
    // matrix check refuses — the composite reports nothing false.
    const out=await f.call('workflow_go_live_checklist',{});
    expect(out.isError).toBe(true);
    expect(text(out)).toBe('Complete selected TEST readiness matrix unavailable');
  });
  it('LIVE checklist degrades per app when the readiness read itself is unavailable',async()=>{
    const f=fixture(true);await f.bind();
    f.sdk.accounts.retrieve=async()=>({id:A,object:'account',
      livemode:false});
    const out=parse(await f.call('workflow_go_live_checklist',{}));
    expect(out).toMatchObject({mode:'live',complete:false,projectCount:0,
      liveProviderQueried:false});
    expect(out.gaps[0].reason).toBe('protected_test_read_unavailable');
  });
  it('readiness read handler follows the connection mode; TEST observations unchanged',async()=>{
    const t=fixture(false);await t.bind();
    const testOut=parse(await t.call('workflow_app_readiness',
      {app:'appliance-desk'}));
    expect(testOut).toMatchObject({mode:'test',liveProviderQueried:false});
    expect(testOut.rows).toHaveLength(21);
    const sentinel=parse(await t.call('workflow_app_readiness',
      {app:'appliance-desk',mode:'live'}));
    expect(sentinel).toMatchObject({mode:'live',liveProviderQueried:false,
      ready:false});
    expect(sentinel.rows).toHaveLength(21);
    expect(sentinel.rows.filter(r=>r.status==='done')).toHaveLength(1);
    const l=fixture(true);await l.bind();
    const liveOut=parse(await l.call('workflow_app_readiness',
      {app:'appliance-desk'}));
    expect(liveOut).toMatchObject({mode:'live',liveProviderQueried:true});
    expect(liveOut.rows).toHaveLength(21);
  });
});

describe('CAP-4 D-8 §A write-consumer preservation pins',()=>{
  it('every write composite still meets the exact legacy gate on a LIVE context',async()=>{
    const f=fixture(true);await f.bind();
    const attempts=[
      ['workflow_refund_customer',{customerId:C}],
      ['workflow_brand_business',{brandKit:{backgroundColor:'#112233'}}],
      ['workflow_set_up_catalog',{name:'X',lookupKey:'x_1',
        unitAmountCents:100,currency:'usd',productId:'prod_D8A987'}],
      ['workflow_month_end_report',{month:'2026-03',reportType:TYPE}],
      ['workflow_dispute_kit_save',{disputeId:DU,
        evidence:{productDescription:'Washer rental'}}],
      ['workflow_webhook_health_fix',{endpointId:WE,apps:['appliance-desk']}]
    ];
    for(const [name,args] of attempts){
      const out=await f.call(name,args);
      expect(out.isError,name).toBe(true);
      expect(text(out),name).toContain(LEGACY);
    }
  });
  it('the shared read phases keep legacy defaults when called by write paths',async()=>{
    // dispute_kit_save and webhook_health_fix on TEST still observe
    // through examine()/source() exactly as at baseline (their own
    // suites pin the full flows); here the LIVE gate proves the
    // defaults were not widened by the read conversions above.
    const t=fixture(false);await t.bind();
    const kit=parse(await t.call('workflow_dispute_kit',{disputeId:DU}));
    expect(kit.mode).toBe('test');
  });
});

describe('CAP-4 D-8 §A catalog descriptions',()=>{
  it('the nine read composites name both modes and stay writes:false',()=>{
    const names=['workflow_customer_overview','workflow_failed_payments',
      'workflow_money_snapshot','workflow_month_end_close','workflow_find',
      'workflow_dispute_kit','workflow_webhook_health',
      'workflow_go_live_checklist','workflow_app_readiness'];
    for(const name of names){
      const tool=registry.tools.find(t=>t.name===name);
      expect(tool,name).toBeTruthy();
      expect(tool.writes,name).toBe(false);
      expect(tool.description,name).not.toContain('TEST');
    }
    for(const name of names.filter(n=>n!=='workflow_app_readiness')){
      const tool=registry.tools.find(t=>t.name===name);
      expect(tool.description,name).toContain('either mode');
    }
    const readiness=registry.tools.find(t=>t.name==='workflow_app_readiness');
    expect(readiness.description).toBe('Observe all 21 project setup rows '+
      'with honest unknown, owner decision and repair plans. Never changes Stripe.');
  });
});
