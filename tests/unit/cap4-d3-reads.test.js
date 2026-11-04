// CAP-4 D-3 — invoice, billing and credit-note READ tools verify every
// returned object against the connection's own mode. Closes the A9
// half-open state: PR #304's seam (modeClient) let these handlers
// execute on LIVE connections while their projections never verified
// `livemode`, so a TEST object projected without complaint on a LIVE
// connection (and a LIVE object on a TEST connection). The wrong-mode
// tests below fail at the pre-D-3 baseline for exactly the handlers
// the card names; mode-correct reads and every historical no-mode
// projection keep their established shapes byte-identically.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {tools as invoiceTools,handlers as invoiceReads,
  safeInvoice} from '../../src/tools/invoices.js';
import {handlers as billingReads} from '../../src/tools/billing.js';
import {itemSafe,scheduleSafe,subscriptionSafe}
  from '../../src/tools/billing-shared.js';
import {tools as creditTools,handlers as creditReads}
  from '../../src/tools/creditnotes.js';
import {safeCredit} from '../../src/tools/creditnote-shared.js';

const acct='acct_D3FAKE',cus='cus_D3FAKE',invId='in_D3FAKE',
  subId='sub_D3FAKE',itemId='si_D3FAKE',schedId='sub_sched_D3FAKE',
  cnId='cn_D3FAKE';
const parse=r=>JSON.parse(r.content[0].text);
const page=data=>({data,has_more:false});

function testCtx(sdk){
  return {connection:{stripeAccount:acct,mode:'test',profile:'full'},
    services:{stripeForConnection:async()=>sdk}};
}
async function liveCtx(sdk){
  vi.stubEnv('VERCEL_ENV','production');
  const db=createFakeDb({accounts:[{id:acct,live_enabled:true,
    live_connected:true,money_limit_cents:0}]});
  return {db,connection:{stripeAccount:acct,mode:'live',profile:'full'},
    services:{stripeForConnection:async()=>sdk}};
}
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});

// --- Fixtures -----------------------------------------------------------
const invoice=(livemode,over={})=>({id:invId,object:'invoice',livemode,
  customer:cus,status:'open',currency:'usd',total:1000,amount_due:1000,
  amount_paid:0,amount_remaining:1000,subtotal:1000,number:'INV-D3',
  hosted_invoice_url:null,created:1790000000,due_date:1791000000,
  collection_method:'charge_automatically',automatic_tax:{enabled:false},
  metadata:{},lines:{data:[],has_more:false},...over});
const lineItem=(livemode)=>({id:'il_D3FAKE',livemode,currency:'usd',
  amount:1000,description:'Service',quantity:1,parent:{}});
const payment=(livemode)=>({id:'ip_D3FAKE',object:'invoice_payment',
  livemode,invoice:invId,amount_paid:1000,amount_requested:1000,
  status:'paid',payment:{payment_intent:'pi_D3FAKE'},created:1790000000});
const customer=(livemode)=>({id:cus,object:'customer',livemode,
  deleted:false,metadata:{}});
const previewInvoice=(livemode)=>invoice(livemode,{status:'draft',
  lines:{data:[{id:'il_D3FAKE',amount:1000,currency:'usd',
    description:'Service'}],has_more:false}});
const item=(livemode,over={})=>({id:itemId,object:'subscription_item',
  livemode,quantity:1,price:{id:'price_D3FAKE',livemode},
  current_period_start:1791000000,current_period_end:1793500000,
  discounts:[],metadata:{},...over});
const subscription=(livemode,over={})=>({id:subId,object:'subscription',
  livemode,status:'active',customer:cus,currency:'usd',
  billing_mode:{type:'flexible'},discounts:[],metadata:{},
  items:{data:[item(livemode)],has_more:false},latest_invoice:null,
  default_payment_method:null,trial_end:null,cancel_at:null,
  cancel_at_period_end:false,pause_collection:null,
  billing_cycle_anchor:1791000000,...over});
const schedule=(livemode)=>({id:schedId,object:'subscription_schedule',
  livemode,status:'active',customer:cus,created:1790000000,
  start_date:1791000000,end_date:1793500000,
  phases:[{start_date:1791000000,end_date:1793500000,iterations:null,
    items:[{price:'price_D3FAKE',quantity:1}]}],
  metadata:{},subscription:null,canceled_at:null,end_behavior:null});
const creditNote=(livemode,over={})=>({id:cnId,object:'credit_note',
  livemode,invoice:invId,customer:cus,status:'issued',currency:'usd',
  amount:500,refund_amount:0,credit_amount:500,out_of_band_amount:0,
  reason:'order_change',created:1790000000,memo:null,number:'CN-D3',
  ...over});

const verified={accounts:{retrieve:async()=>({object:'account',id:acct,
    livemode:true})},
  balance:{retrieve:async()=>({object:'balance',livemode:true})}};
const invoiceSdk=(livemode,{listMode,searchMode,getMode,
    paymentInvoiceMode,paymentMode,previewMode}={})=>({...verified,
  invoices:{list:async()=>page([invoice(listMode??livemode)]),
    retrieve:async()=>invoice(paymentInvoiceMode??getMode??livemode),
    search:async()=>page([invoice(searchMode??livemode)]),
    listLineItems:async()=>page([lineItem(livemode)]),
    createPreview:async()=>previewInvoice(previewMode??livemode)},
  invoicePayments:{list:async()=>page([payment(paymentMode??livemode)])},
  customers:{retrieve:async()=>customer(livemode)}});
const billingSdk=(livemode,{subMode,itemMode,schedMode}={})=>({...verified,
  subscriptions:{list:async()=>page([subscription(subMode??livemode)]),
    retrieve:async()=>subscription(subMode??livemode),
    search:async()=>page([subscription(subMode??livemode)])},
  subscriptionItems:{list:async()=>page([item(itemMode??livemode)])},
  subscriptionSchedules:{list:async()=>page([schedule(schedMode??livemode)]),
    retrieve:async()=>schedule(schedMode??livemode)}});
const creditSdk=(livemode,{listMode,getMode}={})=>({...verified,
  creditNotes:{list:async()=>page([creditNote(listMode??livemode)]),
    retrieve:async()=>creditNote(getMode??livemode)}});

// --- Invoice reads ------------------------------------------------------
describe('CAP-4 D-3 invoice reads verify returned objects',()=>{
  it('invoice_list projects LIVE invoices on a LIVE connection',async()=>{
    const r=await invoiceReads.invoice_list({},
      await liveCtx(invoiceSdk(true)));
    expect(r.isError).toBeFalsy();
    expect(parse(r).data[0]).toMatchObject({id:invId,status:'open',
      total:1000});
  });
  it('invoice_list refuses a TEST invoice on a LIVE connection',async()=>{
    const r=await invoiceReads.invoice_list({},
      await liveCtx(invoiceSdk(true,{listMode:false})));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/mode mismatch/);
  });
  it('invoice_list refuses a LIVE invoice on a TEST connection',async()=>{
    const r=await invoiceReads.invoice_list({},
      testCtx(invoiceSdk(true)));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/mode mismatch/);
  });
  it('invoice_list TEST output shape is unchanged',async()=>{
    const r=await invoiceReads.invoice_list({},
      testCtx(invoiceSdk(false)));
    expect(r.isError).toBeFalsy();
    expect(Object.keys(parse(r).data[0]).sort()).toEqual([
      'amount_due','amount_paid','amount_remaining','attemptCount',
      'auto_advance','collection_method','created_local','currency',
      'due_date_local','hosted_invoice_url','id','lines','linesHasMore',
      'metadata','nextPaymentAttemptLocal','nextPaymentAttemptUnix',
      'number','object','status','subtotal','total','customer'].sort());
  });
  it('invoice_get refuses wrong-mode invoices in both directions',async()=>{
    const live=await invoiceReads.invoice_get({invoiceId:invId},
      await liveCtx(invoiceSdk(true,{getMode:false})));
    expect(live.isError).toBe(true);
    expect(live.content[0].text).toMatch(/mode mismatch/);
    const test=await invoiceReads.invoice_get({invoiceId:invId},
      testCtx(invoiceSdk(true)));
    expect(test.isError).toBe(true);
  });
  it('invoice_get projects a LIVE invoice with its lines',async()=>{
    const r=await invoiceReads.invoice_get({invoiceId:invId},
      await liveCtx(invoiceSdk(true)));
    expect(r.isError).toBeFalsy();
    expect(parse(r).lines).toHaveLength(1);
    expect(parse(r).linesCount).toBe(1);
  });
  it('invoice_search refuses a TEST invoice on LIVE, projects on TEST',
    async()=>{
      const live=await invoiceReads.invoice_search({query:'number:INV-D3'},
        await liveCtx(invoiceSdk(true,{searchMode:false})));
      expect(live.isError).toBe(true);
      const test=await invoiceReads.invoice_search({query:'number:INV-D3'},
        testCtx(invoiceSdk(false)));
      expect(test.isError).toBeFalsy();
      expect(parse(test).data).toHaveLength(1);
    });
  it('invoice_list_payments refuses a wrong-mode invoice',async()=>{
    const r=await invoiceReads.invoice_list_payments({invoiceId:invId},
      await liveCtx(invoiceSdk(true,{paymentInvoiceMode:false})));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/mode mismatch/);
  });
  it('invoice_list_payments refuses a wrong-mode payment',async()=>{
    const r=await invoiceReads.invoice_list_payments({invoiceId:invId},
      await liveCtx(invoiceSdk(true,{paymentMode:false})));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/mode mismatch/);
  });
  it('invoice_list_payments projects LIVE payments on LIVE',async()=>{
    const r=await invoiceReads.invoice_list_payments({invoiceId:invId},
      await liveCtx(invoiceSdk(true)));
    expect(r.isError).toBeFalsy();
    expect(parse(r).data[0]).toMatchObject({status:'paid',
      amount_paid:1000});
  });
  it('invoice_preview refuses a wrong-mode preview in both directions',
    async()=>{
      const live=await invoiceReads.invoice_preview({customerId:cus},
        await liveCtx(invoiceSdk(true,{previewMode:false})));
      expect(live.isError).toBe(true);
      expect(live.content[0].text).toMatch(/mode mismatch/);
      const test=await invoiceReads.invoice_preview({customerId:cus},
        testCtx(invoiceSdk(true)));
      expect(test.isError).toBe(true);
    });
  it('invoice_preview projects a LIVE preview on LIVE',async()=>{
    const r=await invoiceReads.invoice_preview({customerId:cus},
      await liveCtx(invoiceSdk(true)));
    expect(r.isError).toBeFalsy();
    expect(parse(r).invoiceTotalCents).toBe(1000);
  });
  it('safeInvoice verifies only when a mode is supplied',()=>{
    expect(safeInvoice(invoice(true)).id).toBe(invId);
    expect(safeInvoice(invoice(false)).id).toBe(invId);
    expect(()=>safeInvoice(invoice(false),'live')).toThrow(/mode mismatch/);
    expect(safeInvoice(invoice(true),'live').id).toBe(invId);
  });
  it('invoice read descriptions no longer claim TEST-only',()=>{
    for(const name of ['invoice_list','invoice_get','invoice_search',
      'invoice_list_payments','invoice_preview']){
      const tool=invoiceTools.find(t=>t.name===name);
      expect(tool.description).not.toMatch(/TEST/);
    }
  });
});

// --- Billing reads ------------------------------------------------------
describe('CAP-4 D-3 billing reads verify returned objects',()=>{
  it('billing_list_subscriptions refuses a TEST subscription on LIVE',
    async()=>{
      const r=await billingReads.billing_list_subscriptions({},
        await liveCtx(billingSdk(true,{subMode:false})));
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toMatch(/mode mismatch/);
    });
  it('billing_list_subscriptions refuses a LIVE subscription on TEST',
    async()=>{
      const r=await billingReads.billing_list_subscriptions({},
        testCtx(billingSdk(true)));
      expect(r.isError).toBe(true);
    });
  it('billing_list_subscriptions projects LIVE subscriptions on LIVE',
    async()=>{
      const r=await billingReads.billing_list_subscriptions({},
        await liveCtx(billingSdk(true)));
      expect(r.isError).toBeFalsy();
      expect(parse(r).data[0]).toMatchObject({id:subId,status:'active'});
    });
  it('billing_get_subscription refuses wrong-mode in both directions',
    async()=>{
      const live=await billingReads.billing_get_subscription(
        {subscriptionId:subId},
        await liveCtx(billingSdk(true,{subMode:false})));
      expect(live.isError).toBe(true);
      const test=await billingReads.billing_get_subscription(
        {subscriptionId:subId},testCtx(billingSdk(true)));
      expect(test.isError).toBe(true);
    });
  it('billing_search_subscriptions refuses a TEST subscription on LIVE',
    async()=>{
      const r=await billingReads.billing_search_subscriptions(
        {query:'status:active'},
        await liveCtx(billingSdk(true,{subMode:false})));
      expect(r.isError).toBe(true);
    });
  it('billing_list_items refuses wrong-mode items in both directions',
    async()=>{
      const live=await billingReads.billing_list_items(
        {subscriptionId:subId},
        await liveCtx(billingSdk(true,{itemMode:false})));
      expect(live.isError).toBe(true);
      expect(live.content[0].text).toMatch(/mode mismatch/);
      const test=await billingReads.billing_list_items(
        {subscriptionId:subId},testCtx(billingSdk(true)));
      expect(test.isError).toBe(true);
    });
  it('billing_list_items refuses an item whose expanded price is '+
    'wrong-mode',async()=>{
      const sdk=billingSdk(false);
      sdk.subscriptionItems.list=async()=>page([item(false,
        {price:{id:'price_D3FAKE',livemode:true}})]);
      const r=await billingReads.billing_list_items(
        {subscriptionId:subId},testCtx(sdk));
      expect(r.isError).toBe(true);
    });
  it('billing_list_items projects LIVE items on LIVE',async()=>{
    const r=await billingReads.billing_list_items({subscriptionId:subId},
      await liveCtx(billingSdk(true)));
    expect(r.isError).toBeFalsy();
    expect(parse(r).data[0]).toMatchObject({id:itemId,quantity:1});
  });
  it('billing_list_schedules refuses a TEST schedule on LIVE',async()=>{
    const r=await billingReads.billing_list_schedules({},
      await liveCtx(billingSdk(true,{schedMode:false})));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/mode mismatch/);
  });
  it('billing_get_schedule refuses wrong-mode in both directions',
    async()=>{
      const live=await billingReads.billing_get_schedule(
        {scheduleId:schedId},
        await liveCtx(billingSdk(true,{schedMode:false})));
      expect(live.isError).toBe(true);
      const test=await billingReads.billing_get_schedule(
        {scheduleId:schedId},testCtx(billingSdk(true)));
      expect(test.isError).toBe(true);
    });
  it('billing_get_schedule projects a LIVE schedule on LIVE',async()=>{
    const r=await billingReads.billing_get_schedule({scheduleId:schedId},
      await liveCtx(billingSdk(true)));
    expect(r.isError).toBeFalsy();
    expect(parse(r)).toMatchObject({id:schedId,status:'active'});
  });
  it('shared projections verify only when a mode is supplied',()=>{
    expect(()=>subscriptionSafe(subscription(false),'live'))
      .toThrow(/mode mismatch/);
    expect(()=>itemSafe(item(true),'test')).toThrow(/mode mismatch/);
    expect(()=>scheduleSafe(schedule(false),'live'))
      .toThrow(/mode mismatch/);
    // Historical no-mode callers are unchanged: no new refusal.
    expect(subscriptionSafe(subscription(true)).id).toBe(subId);
    expect(itemSafe(item(false)).id).toBe(itemId);
    expect(scheduleSafe(schedule(true)).id).toBe(schedId);
  });
});

// --- Credit-note reads ----------------------------------------------------
describe('CAP-4 D-3 credit-note reads verify returned objects',()=>{
  it('creditnote_list refuses wrong-mode notes in both directions',
    async()=>{
      const live=await creditReads.creditnote_list({},
        await liveCtx(creditSdk(true,{listMode:false})));
      expect(live.isError).toBe(true);
      expect(live.content[0].text).toMatch(/mode mismatch/);
      const test=await creditReads.creditnote_list({},
        testCtx(creditSdk(true)));
      expect(test.isError).toBe(true);
    });
  it('creditnote_list projects LIVE notes on LIVE, TEST notes on TEST',
    async()=>{
      const live=await creditReads.creditnote_list({},
        await liveCtx(creditSdk(true)));
      expect(live.isError).toBeFalsy();
      expect(parse(live).data[0]).toMatchObject({id:cnId,amountCents:500});
      const test=await creditReads.creditnote_list({},
        testCtx(creditSdk(false)));
      expect(test.isError).toBeFalsy();
    });
  it('creditnote_get refuses wrong-mode in both directions',async()=>{
    const live=await creditReads.creditnote_get({creditNoteId:cnId},
      await liveCtx(creditSdk(true,{getMode:false})));
    expect(live.isError).toBe(true);
    const test=await creditReads.creditnote_get({creditNoteId:cnId},
      testCtx(creditSdk(true)));
    expect(test.isError).toBe(true);
  });
  it('safeCredit verifies only when a mode is supplied',()=>{
    expect(()=>safeCredit(creditNote(false),'live'))
      .toThrow(/mode mismatch/);
    expect(safeCredit(creditNote(true),'live').id).toBe(cnId);
    // No-mode callers (the write preflight path) keep historical
    // behavior, including fixtures that carry no livemode at all.
    expect(safeCredit(creditNote(true)).id).toBe(cnId);
    const bare=creditNote(true);delete bare.livemode;
    expect(safeCredit(bare).id).toBe(cnId);
    expect(safeCredit(bare,'live').id).toBe(cnId);
  });
  it('credit-note read descriptions no longer claim TEST-only',()=>{
    for(const name of ['creditnote_list','creditnote_get',
      'creditnote_preview']){
      const tool=creditTools.find(t=>t.name===name);
      expect(tool.description).not.toMatch(/TEST/);
    }
  });
});
