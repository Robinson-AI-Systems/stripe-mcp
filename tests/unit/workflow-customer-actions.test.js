import {describe,it,expect,vi,afterEach} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';

const C='cus_WORK123',A='acct_WORK123',CH='ch_WORK123',SUB='sub_WORK123';
const parse=r=>{try{return JSON.parse(r.content[0].text);}catch{return r.content[0].text;}};
const charged=(id=CH,description='October washer service')=>({
  id,object:'charge',customer:C,status:'succeeded',paid:true,
  amount:7800,amount_refunded:800,currency:'usd',
  refunded:false,disputed:false,description,created:1791900000,
  payment_intent:'pi_WORK123',metadata:{},receipt_email:null
});
const subscribed=(id=SUB)=>({
  object:'subscription',id,customer:C,currency:'usd',status:'active',
  cancel_at_period_end:false,items:{data:[{id:'si_WORK123',
    price:{id:'price_WORK123',currency:'usd',unit_amount:6000,
      recurring:{interval:'month',usage_type:'licensed'},billing_scheme:'per_unit'},
    quantity:1,current_period_start:1791900000,current_period_end:1794500000}],
    has_more:false},metadata:{}
});
const billed=(id='in_WORK123')=>({
  id,object:'invoice',customer:C,status:'open',
  amount_remaining:2400,amount_due:2400,total:2400,amount_paid:0,
  currency:'usd',auto_advance:false,collection_method:'send_invoice',
  post_payment_credit_notes_amount:0,lines:{data:[],has_more:false},
  metadata:{}
});
function fixture({charges=[charged()],subs=[subscribed()],invoices=[]}={}){
  const seen=[],db=createFakeDb({accounts:[{id:A,label:'Synthetic TEST'}]});
  const list=(rows,args,name)=>{
    seen.push({name,args});
    const ix=args.starting_after?rows.findIndex(x=>x.id===args.starting_after)+1:0;
    const page=rows.slice(ix,ix+args.limit);
    return {data:page,has_more:ix+page.length<rows.length};
  };
  const sdk={
    customers:{retrieve:async id=>({id,object:'customer',metadata:{},
      name:'TEST fixture',email:'test@example.invalid'})},
    charges:{list:async a=>list(charges,a,'charge_list'),retrieve:async id=>{
      seen.push({name:'charge_get',id});return charges.find(x=>x.id===id)??null;}},
    subscriptions:{list:async a=>list(subs,a,'subscriptions_list'),
      retrieve:async id=>{seen.push({name:'subscription_get',id});
        return subs.find(x=>x.id===id)??null;}},
    invoices:{list:async a=>list(invoices,a,'invoice_list'),
      retrieve:async id=>{seen.push({name:'invoice_get',id});
        return invoices.find(x=>x.id===id)??null;}},
    refunds:{create:async(...a)=>{seen.push({name:'MONEY_REFUND_CREATE',a});
      throw Error('Provider writes must not occur without owner approval');}}
  };
  const ctx={connection:{stripeAccount:A,mode:'test',profile:'full'},
    connectionId:'work-test',db,services:{stripeForConnection:async()=>sdk}};
  const call=(name,args)=>registry.handlers[name](args,ctx);
  return {sdk,ctx,db,call,seen,charges,subs,invoices};
}
afterEach(()=>vi.useRealTimers());
const args={customerId:C,description:'washer service',reason:'requested_by_customer'};
describe('W-3 guarded customer refund workflow',()=>{
  it('discovers exact refundable charge, native previews, and only read operations',async()=>{
    const f=fixture();
    const o=parse(await f.call('workflow_refund_customer',args));
    expect(o).toMatchObject({kind:'refund_customer',done:false,complete:true,
      needsConfirmation:true,steps:[{tool:'payment_create_refund',target:CH}]});
    expect(o.steps[0].preview).toMatch(/Refund/);
    expect(o.previewToken).toMatch(/^[a-f0-9]{64}$/);
    expect(f.seen.some(x=>x.name==='MONEY_REFUND_CREATE')).toBe(false);
    expect(registry.tools.find(x=>x.name==='workflow_refund_customer'))
      .toMatchObject({writes:true,moneyOut:true,moneySpec:'provider-derived',
        writeContract:'defineWrite-v1'});
  });
  it('uses chargeId for exact target and rejects incorrect customer, currency and amounts',async()=>{
    const f=fixture();
    const valid=parse(await f.call('workflow_refund_customer',{
      customerId:C,chargeId:CH,amountCents:2000,reason:'duplicate'}));
    expect(valid.steps[0].preview).toContain('payment_create_refund');
    expect((await f.call('workflow_refund_customer',{customerId:C,
      chargeId:CH,amountCents:99999})).isError).toBe(true);
    f.charges[0].customer='cus_NOTOWNER';
    expect((await f.call('workflow_refund_customer',{
      customerId:C,chargeId:CH})).isError).toBe(true);
    f.charges[0].customer=C;f.charges[0].currency='eur';
    expect((await f.call('workflow_refund_customer',args)).isError).toBe(true);
  });
  it('refuses ambiguous, missing or incomplete list selection rather than choosing one',async()=>{
    const f=fixture({charges:[charged(),charged('ch_WORK456')]});
    const ambiguous=parse(await f.call('workflow_refund_customer',args));
    expect(ambiguous).toMatch(/Ambiguous/);
    const empty=fixture({charges:[]});
    expect(parse(await empty.call('workflow_refund_customer',args))).toMatch(/No verified/);
    const rows=Array.from({length:1001},(_,i)=>
      charged('ch_'+String(1000+i),'washer service'));
    const incomplete=fixture({charges:rows});
    expect(parse(await incomplete.call('workflow_refund_customer',args)))
      .toMatch(/incomplete/);
  });
  it('rejects missing confirmation token, stale plan, read_only, LIVE and absent audit',async()=>{
    const f=fixture();const p=parse(await f.call('workflow_refund_customer',args));
    const run={...args,confirm:true,requestKey:'refund-work-1',
      previewToken:p.previewToken};
    expect((await f.call('workflow_refund_customer',{
      ...args,confirm:true})).isError).toBe(true);
    f.charges[0].amount_refunded=900;
    expect(parse(await f.call('workflow_refund_customer',run))).toMatch(/Plan changed/);
    f.charges[0].amount_refunded=800;
    f.ctx.connection.profile='read_only';
    expect((await f.call('workflow_refund_customer',run)).isError).toBe(true);
    f.ctx.connection.profile='full';f.ctx.connection.mode='live';
    expect((await f.call('workflow_refund_customer',run)).isError).toBe(true);
    f.ctx.connection.mode='test';f.ctx.db=null;
    expect((await f.call('workflow_refund_customer',args)).isError).toBe(true);
  });
  it('actual confirmation retains independent owner money-out refusal; never refunds',async()=>{
    const f=fixture(),p=parse(await f.call('workflow_refund_customer',args));
    const out=parse(await f.call('workflow_refund_customer',{
      ...args,confirm:true,requestKey:'refund-no-owner-grant',
      previewToken:p.previewToken}));
    expect(out).toMatchObject({done:false,confirmed:false,
      failedStep:{tool:'payment_create_refund'},completedSteps:[]});
    expect(out.warning).toMatch(/Do not retry automatically/);
    expect(f.seen.some(x=>x.name==='MONEY_REFUND_CREATE')).toBe(false);
  });
});
describe('W-4 guarded customer cancellation workflow',()=>{
  it('previews period-end subscription and one manual invoice void before changes',async()=>{
    const f=fixture({invoices:[billed()]});
    const p=parse(await f.call('workflow_cancel_customer',{
      customerId:C,timing:'period_end',voidOpenInvoices:true}));
    expect(p.steps.map(x=>x.tool)).toEqual(['billing_cancel_subscription','invoice_void']);
    expect(p.steps[0].preview).toContain('billing_cancel_subscription');
    expect(p.done).toBe(false);
    expect(f.seen.filter(x=>x.name==='invoice_get')).toHaveLength(1);
    expect(f.seen.some(x=>x.name==='MONEY_REFUND_CREATE')).toBe(false);
  });
  it('refuses multiple subscriptions until an exact target is supplied',async()=>{
    const f=fixture({subs:[subscribed(),subscribed('sub_OTHER123')]});
    expect(parse(await f.call('workflow_cancel_customer',{
      customerId:C,timing:'period_end'}))).toMatch(/Multiple/);
    const p=parse(await f.call('workflow_cancel_customer',{
      customerId:C,subscriptionId:SUB,timing:'period_end'}));
    expect(p.steps).toHaveLength(1);
  });
  it('requires immediate invoice choices and refuses inconclusive auto invoices',async()=>{
    const f=fixture({invoices:[{...billed(),auto_advance:true}]});
    expect(parse(await f.call('workflow_cancel_customer',{
      customerId:C,timing:'now'}))).toMatch(/invoiceNow and prorate/);
    expect((await f.call('workflow_cancel_customer',{
      customerId:C,timing:'now',invoiceNow:false,prorate:false,
      voidOpenInvoices:true})).isError).toBe(true);
    const normal=parse(await f.call('workflow_cancel_customer',{
      customerId:C,timing:'now',invoiceNow:false,prorate:false}));
    expect(normal.steps.map(x=>x.tool)).toEqual(['billing_cancel_subscription']);
  });
  it('previews optional refund BEFORE cancel and retains separate native approval',async()=>{
    const f=fixture();
    const plan=parse(await f.call('workflow_cancel_customer',{
      customerId:C,timing:'now',invoiceNow:false,prorate:false,
      refundChargeId:CH,refundAmountCents:1500}));
    expect(plan.steps.map(x=>x.tool)).toEqual([
      'payment_create_refund','billing_cancel_subscription']);
    const denied=parse(await f.call('workflow_cancel_customer',{
      customerId:C,timing:'now',invoiceNow:false,prorate:false,
      refundChargeId:CH,refundAmountCents:1500,confirm:true,
      previewToken:plan.previewToken,requestKey:'cancel-needs-owner-1'}));
    expect(denied).toMatchObject({done:false,confirmed:false,
      failedStep:{tool:'payment_create_refund'},completedSteps:[]});
    expect(f.seen.some(x=>x.name==='MONEY_REFUND_CREATE')).toBe(false);
  });
  it('refuses stale subscriptions, oversized invoice set and foreign invoice',async()=>{
    const f=fixture({invoices:Array.from({length:6},(_,i)=>billed('in_'+String(100+i)))});
    expect(parse(await f.call('workflow_cancel_customer',{
      customerId:C,timing:'period_end',voidOpenInvoices:true}))).toMatch(/More than five/);
    f.invoices.splice(1);
    f.invoices[0].customer='cus_OTHER123';
    const p=parse(await f.call('workflow_cancel_customer',{
      customerId:C,timing:'period_end',voidOpenInvoices:true}));
    expect(p).toMatch(/Native open-invoice state or customer/);
    f.invoices[0].customer=C;
    f.subs[0].status='canceled';
    expect((await f.call('workflow_cancel_customer',{
      customerId:C,timing:'period_end'})).isError).toBe(true);
  });
});
