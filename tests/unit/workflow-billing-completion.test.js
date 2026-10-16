import {describe,it,expect} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const C='cus_COMPLETE123',A='acct_COMPLETE123',S='sub_COMPLETE123',
  I='in_COMPLETE123',OLD='price_OLD123',NEXT='price_NEW123';
const data=r=>{const value=r.content[0].text;
  try{return JSON.parse(value);}catch{return value;}
};
function fixture({creditQuote=false}={}){
  const calls=[],db=createFakeDb({accounts:[{id:A,label:'TEST customer workflow'}]});
  const customer={object:'customer',id:C,metadata:{},name:'TEST',email:'owner@example.invalid'};
  const oldPrice={id:OLD,object:'price',active:true,type:'recurring',currency:'usd',
    unit_amount:6000,billing_scheme:'per_unit',metadata:{},recurring:{interval:'month',interval_count:1,
      usage_type:'licensed'}};
  const newPrice={...oldPrice,id:NEXT,unit_amount:8000};
  const item={id:'si_COMPLETE123',quantity:1,price:oldPrice,
    current_period_start:1791900000,current_period_end:1794500000,
    discounts:[]};
  const sub={id:S,object:'subscription',customer:C,status:'active',
    currency:'usd',cancel_at_period_end:false,items:{data:[item],has_more:false},
    metadata:{},pause_collection:null,billing_mode:{type:'classic'}};
  const invoice={id:I,object:'invoice',customer:C,status:'open',
    collection_method:'send_invoice',currency:'usd',amount_due:2500,
    amount_remaining:2500,total:2500,amount_paid:0,auto_advance:false,
    post_payment_credit_notes_amount:0,
    lines:{data:[],has_more:false},metadata:{}};
  let breakAfterCancel=false;
  const list=(arr,a)=>{
    const start=a.starting_after?arr.findIndex(x=>x.id===a.starting_after)+1:0;
    const page=arr.slice(start,start+a.limit);
    return {data:page,has_more:start+page.length<arr.length};
  };
  const sdk={
    customers:{retrieve:async()=>customer},
    subscriptions:{
      list:async a=>list([sub],a),
      retrieve:async()=>sub,
      update:async(_id,p,opts)=>{
        calls.push({name:'subscription.update',p,opts});
        if('cancel_at_period_end' in p){
          sub.cancel_at_period_end=p.cancel_at_period_end;
          sub.cancel_at=item.current_period_end;
          breakAfterCancel=true;
        }
        if(p.items){
          item.price=p.items[0].price===NEXT?newPrice:oldPrice;
          item.quantity=p.items[0].quantity;
        }
        return sub;
      }
    },
    invoices:{
      list:async a=>list([invoice],a),
      retrieve:async()=>{
        if(breakAfterCancel&&failRetrieve)throw Error('synthetic Stripe retrieval outage');
        return invoice;
      },
      voidInvoice:async(_id,params,opts)=>{
        calls.push({name:'invoice.void',opts});
        invoice.status='void';invoice.status_transitions={voided_at:1792200000};
        return invoice;
      },
      createPreview:async a=>{
        const target=a.subscription_details.items[0];
        calls.push({name:'invoice.createPreview',target});
        const isCredit=creditQuote&&target.price===NEXT;
        const total=isCredit?-500:target.price===NEXT?8000:6000;
        return {object:'invoice',currency:'usd',total,
          amount_due:isCredit?0:total,
          lines:{data:isCredit?[{amount:-500,description:'Verified TEST credit',
            parent:{subscription_item_details:{proration:true}}}]:[],has_more:false}};
      }
    },
    prices:{retrieve:async id=>id===NEXT?newPrice:oldPrice}
  };
  let failRetrieve=false;
  const ctx={connection:{stripeAccount:A,mode:'test',profile:'full'},
    connectionId:'synthetic-customer-billing',db,
    services:{stripeForConnection:async()=>sdk}};
  const call=(name,args)=>registry.handlers[name](args,ctx);
  return {ctx,db,calls,call,sub,item,invoice,newPrice,oldPrice,
    stalePrice:()=>{item.price=newPrice;},
    throwAfterCancel:()=>{failRetrieve=true;}};
}
describe('W-3/W-4 corrections and successful guarded customer actions',()=>{
  it('successfully cancels period-end and voids a manual invoice with TWO native confirmed reads',async()=>{
    const f=fixture(),a={customerId:C,timing:'period_end',voidOpenInvoices:true};
    const preview=data(await f.call('workflow_cancel_customer',a));
    expect(preview.steps.map(s=>s.tool)).toEqual(['billing_cancel_subscription','invoice_void']);
    expect(f.calls).toHaveLength(0);
    const receipt=data(await f.call('workflow_cancel_customer',{...a,
      confirm:true,requestKey:'complete-cancel-1',previewToken:preview.previewToken}));
    expect(receipt.done).toBe(true);
    expect(receipt.completedSteps).toMatchObject([
      {tool:'billing_cancel_subscription',confirmed:true},
      {tool:'invoice_void',confirmed:true}
    ]);
    expect(f.sub.cancel_at_period_end).toBe(true);
    expect(f.invoice.status).toBe('void');
    expect(f.calls.map(x=>x.name)).toEqual(['subscription.update','invoice.void']);
    expect((await f.db.listAuditForTest()).length).toBeGreaterThanOrEqual(2);
  });
  it('rejects a fresh item price change after preview despite same item count',async()=>{
    const f=fixture(),a={customerId:C,timing:'period_end'};
    const old=data(await f.call('workflow_cancel_customer',a));
    f.stalePrice();
    const mismatch=await f.call('workflow_cancel_customer',{...a,
      confirm:true,requestKey:'stale-pricing',previewToken:old.previewToken});
    expect(mismatch.isError).toBe(true);
    expect(data(mismatch)).toMatch(/Plan changed/);
    expect(f.calls).toHaveLength(0);
  });
  it('retains first committed cancellation receipt when later native invoice raises an exception',async()=>{
    const f=fixture(),a={customerId:C,timing:'period_end',voidOpenInvoices:true};
    const preview=data(await f.call('workflow_cancel_customer',a));
    f.throwAfterCancel();
    const receipt=data(await f.call('workflow_cancel_customer',{...a,
      confirm:true,requestKey:'partial-cancel',previewToken:preview.previewToken}));
    expect(receipt.done).toBe(false);
    expect(receipt.completedSteps).toMatchObject([
      {tool:'billing_cancel_subscription',confirmed:true}
    ]);
    expect(receipt.failedStep).toMatchObject({tool:'invoice_void',confirmed:false});
    expect(receipt.warning).toMatch(/uncertain/);
    expect(f.calls.map(x=>x.name)).toEqual(['subscription.update']);
  });
});
describe('W-5 original end-to-end provider quote and guarded write',()=>{
  const change={customerId:C,itemId:'si_COMPLETE123',priceId:NEXT,
    effectiveAt:1792200000,prorationBehavior:'create_prorations'};
  it('previews both native Stripe invoice totals and shows exact difference WITHOUT a write',async()=>{
    const f=fixture(),p=data(await f.call('workflow_change_plan',change));
    expect(p).toMatchObject({kind:'change_plan',done:false,complete:true,
      baselineInvoiceQuote:{invoiceTotalCents:6000,currency:'usd'},
      changedInvoiceQuote:{invoiceTotalCents:8000,currency:'usd'},
      quotedInvoiceDifferenceCents:2000,requestedPriceId:NEXT});
    expect(p.previewToken).toMatch(/^[a-f0-9]{64}$/);
    expect(f.calls.every(x=>x.name==='invoice.createPreview')).toBe(true);
    expect(f.calls.length).toBe(3);
  });
  it('performs exactly one confirmed original native guarded billing write and readback',async()=>{
    const f=fixture(),p=data(await f.call('workflow_change_plan',change));
    const result=data(await f.call('workflow_change_plan',{...change,
      confirm:true,requestKey:'plan-change-1',previewToken:p.previewToken}));
    expect(result.done).toBe(true);
    expect(result.completedSteps).toMatchObject([
      {tool:'billing_change_plan',target:S,confirmed:true}
    ]);
    expect(f.item.price.id).toBe(NEXT);
    expect(f.calls.filter(x=>x.name==='subscription.update')).toHaveLength(1);
    expect((await f.db.listAuditForTest()).length).toBeGreaterThanOrEqual(1);
  });
  it('rejects changed provider price, source period and invalid/missing selections',async()=>{
    const f=fixture(),p=data(await f.call('workflow_change_plan',change));
    f.item.current_period_end+=3600;
    const stale=await f.call('workflow_change_plan',{...change,
      confirm:true,requestKey:'stale-quote',previewToken:p.previewToken});
    expect(stale.isError).toBe(true);
    expect(data(stale)).toMatch(/changed/);
    expect(f.calls.filter(x=>x.name==='subscription.update')).toHaveLength(0);
    expect((await f.call('workflow_change_plan',{customerId:C,
      effectiveAt:change.effectiveAt,prorationBehavior:'none'})).isError).toBe(true);
    f.ctx.connection.mode='live';
    expect((await f.call('workflow_change_plan',change)).isError).toBe(true);
    f.ctx.connection.mode='test';f.ctx.connection.profile='read_only';
    expect((await f.call('workflow_change_plan',change)).isError).toBe(true);
  });
  it('enforces separate original money-out approval for provider-quoted credit and then confirms readback',async()=>{
    const f=fixture({creditQuote:true});
    const p=data(await f.call('workflow_change_plan',change));
    expect(p.changedInvoiceQuote.invoiceTotalCents).toBe(-500);
    expect(p.changedInvoiceQuote.prorationLines).toMatchObject([
      {amountCents:-500}]);
    const requestKey='credit-with-independent-owner';
    const args={...change,confirm:true,requestKey,previewToken:p.previewToken};
    const blocked=data(await f.call('workflow_change_plan',args));
    expect(blocked).toMatchObject({done:false,confirmed:false,
      failedStep:{tool:'billing_change_plan'}});
    expect(f.calls.filter(x=>x.name==='subscription.update')).toHaveLength(0);
    const pending=await f.db.listPendingMoneyApprovals({account:A});
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({tool:'billing_change_plan',
      amount_cents:500,currency:'usd'});
    // Only this synthetic TEST fake owner action can approve the pending grant.
    // The public workflow has NO approval argument or grant authority.
    expect(await f.db.approveMoneyRequest({account:A,
      idempotencyKey:pending[0].request_key})).toBe(true);
    const succeeded=data(await f.call('workflow_change_plan',args));
    expect(succeeded).toMatchObject({done:true,confirmed:true,
      completedSteps:[{tool:'billing_change_plan',confirmed:true}]});
    expect(f.calls.filter(x=>x.name==='subscription.update')).toHaveLength(1);
    expect(f.item.price.id).toBe(NEXT);
    expect(registry.tools.find(x=>x.name==='workflow_change_plan'))
      .toMatchObject({writes:true,safety:'
});
,moneySpec:'provider-derived'});
  });
});
