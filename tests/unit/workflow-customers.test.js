import {describe,it,expect,vi,afterEach} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {declineReason} from '../../src/tools/workflow-customers.js';

afterEach(()=>vi.useRealTimers());
const C='cus_WTEST',A='acct_WTEST';
const parse=r=>JSON.parse(r.content[0].text);
const invoice=(id,status='open',due=2600,attempt=2)=>({
  id,object:'invoice',status,currency:'usd',customer:C,amount_remaining:due,
  amount_due:due,amount_paid:0,amount_total:due,attempt_count:attempt,
  next_payment_attempt:1793500000,
  hosted_invoice_url:'https://invoice.stripe.com/i/test-'+id,
  created:1791990000,metadata:{},lines:{data:[],has_more:false}});
const payment=(id,status='requires_payment_method')=>({
  id,object:'payment_intent',status,currency:'usd',amount:2600,
  amount_received:0,customer:C,description:'Test only',
  last_payment_error:{code:'card_declined',decline_code:'insufficient_funds'},
  created:1791990000,metadata:{},client_secret:'must-never-appear'});
const sub=(id,status='active')=>({
  id,status,currency:'usd',customer:C,items:{data:[],has_more:false},
  metadata:{},pause_collection:null});
function fixture({invoices=[],payments=[],subscriptions=[],customer=true}={}){
  const seen=[];
  const page=(kind,records,p)=>{
    seen.push({kind,args:p});
    const start=p.starting_after?records.findIndex(r=>r.id===p.starting_after)+1:0;
    const data=records.slice(start,start+p.limit);
    return {data,has_more:start+data.length<records.length};
  };
  const stripe={
    invoices:{list:async p=>page('invoices',invoices,p)},
    paymentIntents:{list:async p=>page('payments',payments,p)},
    subscriptions:{list:async p=>page('subscriptions',subscriptions,p)},
    customers:{retrieve:async id=>{
      seen.push({kind:'customer',id});
      return customer?{object:'customer',id,name:'Synthetic Test',
        email:'synthetic@example.invalid',metadata:{}}:{id,deleted:true};
    }}
  };
  const ctx={connection:{mode:'test',profile:'read_only',stripeAccount:A},
    services:{stripeForConnection:async()=>stripe},getCustomer:async()=>null};
  const call=(name,a={})=>registry.handlers[name](a,ctx);
  return {ctx,call,seen};
}
describe('W-2 failed payment and customer overview guarded workflows',()=>{
  it('returns real provider retry/hosted links, decoded decline and no secrets',async()=>{
    const f=fixture({invoices:[invoice('in_A1'),invoice('in_A2','paid',0,2)],
      payments:[payment('pi_A1'),payment('pi_A2','succeeded')]});
    const out=parse(await f.call('workflow_failed_payments',{customerId:C}));
    expect(out.complete).toBe(true);
    expect(out.counts).toEqual({unpaidAttemptedInvoices:1,failedPaymentIntents:1});
    expect(out.invoices[0]).toMatchObject({
      id:'in_A1',amountRemainingMinor:2600,attempts:2,
      hostedInvoiceUrl:'https://invoice.stripe.com/i/test-in_A1',
      nextRetryUnix:1793500000});
    expect(out.failedPayments[0].reason).toBe('Insufficient funds');
    expect(JSON.stringify(out)).not.toContain('must-never-appear');
    expect(f.seen.filter(x=>x.kind==='payments')).toHaveLength(1);
    expect(f.seen.filter(x=>x.kind==='invoices')).toHaveLength(1);
  });
  it('reports missing next retry without fabricating Stripe schedule',async()=>{
    const pending=invoice('in_B1');
    pending.next_payment_attempt=null;
    const f=fixture({invoices:[pending],payments:[payment('pi_B1')]});
    const out=parse(await f.call('workflow_failed_payments',{}));
    expect(out.invoices[0].nextRetryAt).toBeNull();
    expect(out.invoices[0].note).toMatch(/No provider-confirmed/);
    expect(declineReason({failureCode:'unrecognized'})).toMatch(/Stripe reported/);
  });
  it('handles empty accounts, selected TEST scope and direct LIVE denial',async()=>{
    const f=fixture();
    expect(parse(await f.call('workflow_failed_payments',{}))).toMatchObject({
      complete:true,counts:{unpaidAttemptedInvoices:0,failedPaymentIntents:0}});
    f.ctx.connection.mode='live';
    const denied=await f.call('workflow_failed_payments',{customerId:C});
    expect(denied.isError).toBe(true);
    expect(f.seen).toHaveLength(2);
    expect((await f.call('workflow_customer_overview',{customerId:C})).isError).toBe(true);
  });
  it('provides verified customer and compact owned billing records without writes',async()=>{
    const f=fixture({invoices:[invoice('in_C1')],payments:[payment('pi_C1')],
      subscriptions:[sub('sub_C1')]});
    const out=parse(await f.call('workflow_customer_overview',{customerId:C}));
    expect(out.complete).toBe(true);
    expect(out.customer).toMatchObject({id:C,name:'Synthetic Test'});
    expect(out.counts).toEqual({invoices:1,subscriptions:1,payments:1});
    expect(out.subscriptions[0]).toMatchObject({id:'sub_C1',status:'active'});
    expect(out.invoices[0].hostedInvoiceUrl).toContain('invoice.stripe.com');
    expect(JSON.stringify(out)).not.toContain('must-never-appear');
    expect(f.seen.map(x=>x.kind)).toEqual(['customer','invoices','subscriptions','payments']);
  });
  it('rejects invalid or missing customer and no provider access to absent customer',async()=>{
    const f=fixture({customer:false});
    const denied=await f.call('workflow_customer_overview',{customerId:C});
    expect(denied.isError).toBe(true);
    expect(f.seen.map(x=>x.kind)).toEqual(['customer']);
    expect((await f.call('workflow_customer_overview',{})).isError).toBe(true);
    expect((await f.call('workflow_failed_payments',{customerId:'invalid'})).isError).toBe(true);
  });
  it('returns incomplete instead of false success when a native read is unavailable',async()=>{
    const f=fixture({invoices:[invoice('in_F1')]});
    f.ctx.services.stripeForConnection=async()=>({
      invoices:{list:async()=>{throw new Error('Stripe temporary outage');}},
      paymentIntents:{list:async()=>({data:[],has_more:false})}
    });
    const out=parse(await f.call('workflow_failed_payments',{}));
    expect(out.complete).toBe(false);
    expect(out.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({section:'invoices',reason:'guarded_read_unavailable'})]));
  });
  it('shows bounded interrupted work when the budget expires mid-read',async()=>{
    const f=fixture({invoices:[invoice('in_G1')]});
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-15T16:00:00Z'));
    const original=f.ctx.services.stripeForConnection;
    f.ctx.services.stripeForConnection=async()=>{
      const sdk=await original();
      sdk.invoices.list=async _p=>{
        const result={data:[invoice('in_G1')],has_more:false};
        vi.setSystemTime(new Date('2026-10-15T16:02:00Z'));
        return result;
      };
      return sdk;
    };
    const result=parse(await f.call('workflow_failed_payments',{}));
    expect(result.complete).toBe(false);
    expect(result.continuation).toContain('Repeat this read');
  });
});
