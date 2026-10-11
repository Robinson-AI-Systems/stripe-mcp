// D-5b actual-handler seven-case write contracts. No Stripe key or live requests.
import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makeInvoiceLifecycleWrite} from '../../src/tools/invoice-lifecycle-writes.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';

const inv='in_FAKE1234',cus='cus_FAKE1234',pm='pm_FAKE1234';
const cases=[
  ['invoice_delete_draft',{invoiceId:inv},'draft','send_invoice'],
  ['invoice_finalize',{invoiceId:inv},'draft','send_invoice'],
  ['invoice_send',{invoiceId:inv},'open','send_invoice'],
  ['invoice_charge_now',{invoiceId:inv,expectedRemainingCents:2000},'open','charge_automatically'],
  ['invoice_mark_paid_outside_stripe',{invoiceId:inv,expectedRemainingCents:2000},'open','send_invoice'],
  ['invoice_void',{invoiceId:inv},'open','send_invoice'],
  ['invoice_mark_uncollectible',{invoiceId:inv},'open','send_invoice']
];
function fixture({appOwned=false,readBackMatches=true,limitCents=10000},
  name,status,method){
  const metadata=appOwned?{agreementId:'ag_FAKE1234'}:{};
  const db=createFakeDb({accounts:[{id:'acct_safefixture',
    label:'Fixture',money_limit_cents:limitCents}]});
  const provider={writes:[],afterCalls:0,payloads:[]};
  const customer={object:'customer',id:cus,deleted:false,
    email:'fixture@example.test',metadata,
    invoice_settings:{default_payment_method:pm}};
  const draft={object:'invoice',id:inv,customer:cus,
    status,collection_method:method,auto_advance:false,
    currency:'usd',metadata,
    total:2000,subtotal:2000,amount_due:2000,amount_remaining:2000,amount_paid:0,
    hosted_invoice_url:'https://invoice.stripe.com/i/test_FAKE',
    default_payment_method:method==='charge_automatically'?pm:null,
    lines:{data:[],has_more:false},status_transitions:{}};
  let current={...draft},deleted=false;
  function write(kind,params,opts){
    if(!opts?.idempotencyKey)throw new Error('Idempotency key required');
    provider.writes.push({kind,idempotencyKey:opts.idempotencyKey});
    provider.payloads.push(params);
  }
  function changed(patch){
    const outcome={...draft,...patch,metadata:draft.metadata};
    if(readBackMatches)current={...outcome};
    else if(name==='invoice_send')current={...draft,status:'void'};
    return outcome;
  }
  const sdk={
    customers:{retrieve:async()=>customer},
    paymentMethods:{retrieve:async()=>({object:'payment_method',id:pm,customer:cus})},
    invoices:{
      async retrieve(){
        if(provider.writes.length)provider.afterCalls++;
        if(deleted)throw Object.assign(new Error('Resource missing'),{
          statusCode:404,code:'resource_missing'});
        return current;
      },
      async del(id,params,opts){
        write('delete',params,opts);
        deleted=readBackMatches;
        return {id,object:'invoice',deleted:true};
      },
      async finalizeInvoice(id,params,opts){
        write('finalize',params,opts);
        return changed({status:'open',auto_advance:params.auto_advance,
          status_transitions:{finalized_at:1791676800}});
      },
      async sendInvoice(id,params,opts){
        write('send',params,opts);
        return changed({status:'open'});
      },
      async pay(id,params,opts){
        write('pay',params,opts);
        return changed({status:'paid',paid:true,paid_out_of_band:params.paid_out_of_band,
          amount_remaining:0,amount_paid:2000});
      },
      async voidInvoice(id,params,opts){
        write('void',params,opts);
        return changed({status:'void',status_transitions:{voided_at:1791676800}});
      },
      async markUncollectible(id,params,opts){
        write('uncollectible',params,opts);
        return changed({status:'uncollectible',
          status_transitions:{marked_uncollectible_at:1791676800}});
      }
    }
  };
  const ctx={connection:{stripeAccount:'acct_safefixture',mode:'test',
      profile:'full'},connectionId:'owner-client-fixture',db,
    getCustomer:async()=>customer,
    services:{stripeForConnection:async()=>sdk}};
  return {db,ctx,provider,sdk};
}
for(const [name,args,status,method] of cases){
  describe(name,()=>{
    runWriteContract({withMoney:false,strictArgs:true,args,
      tool:()=>makeInvoiceLifecycleWrite(name),
      fixtures:o=>fixture(o,name,status,method)});
  });
}
it('rejects changed amount before charging or recording external payment',async()=>{
  for(const name of ['invoice_charge_now','invoice_mark_paid_outside_stripe']){
    const f=fixture({},name,'open',
      name==='invoice_charge_now'?'charge_automatically':'send_invoice');
    await expect(makeInvoiceLifecycleWrite(name).handler({
      invoiceId:inv,expectedRemainingCents:1900,confirm:true
    },f.ctx)).rejects.toThrow(/balance changed/);
    expect(f.provider.writes).toHaveLength(0);
  }
});
it('rejects an open invoice with partial payments before voiding',async()=>{
  const f=fixture({},'invoice_void','open','send_invoice');
  const saved=f.sdk.invoices.retrieve;
  f.sdk.invoices.retrieve=async()=>({...await saved(),
    amount_paid:100,amount_remaining:1900});
  await expect(makeInvoiceLifecycleWrite('invoice_void').handler({
    invoiceId:inv,confirm:true},f.ctx)).rejects.toThrow(/partial payments/);
  expect(f.provider.writes).toHaveLength(0);
});
it('requires definite Stripe 404 resource_missing before claiming deletion',async()=>{
  const f=fixture({},'invoice_delete_draft','draft','send_invoice');
  let after=false;
  f.sdk.invoices.retrieve=async()=>{
    if(after)throw Object.assign(new Error('network timeout'),{statusCode:503});
    return {object:'invoice',id:inv,customer:cus,metadata:{},status:'draft',
      auto_advance:false,currency:'usd',collection_method:'send_invoice',
      total:2000,subtotal:2000,amount_due:2000,amount_remaining:2000,
      amount_paid:0,lines:{data:[],has_more:false}};
  };
  f.sdk.invoices.del=async(id,p,o)=>{
    if(!o.idempotencyKey)throw new Error('No idempotency');
    after=true;f.provider.writes.push({idempotencyKey:o.idempotencyKey});
    return {object:'invoice',id,deleted:true};
  };
  const result=JSON.parse((await makeInvoiceLifecycleWrite('invoice_delete_draft')
    .handler({invoiceId:inv,confirm:true},f.ctx)).content[0].text);
  expect(result.done).toBe(false);
  expect(result.warning).toMatch(/Read-back/);
});
it('TEST invoice send never accepts a caller-supplied email address',async()=>{
  const f=fixture({},'invoice_send','open','send_invoice');
  await expect(makeInvoiceLifecycleWrite('invoice_send').handler({
    invoiceId:inv,email:'redirect@elsewhere.test',confirm:true},f.ctx))
    .rejects.toThrow(/Unsupported email/);
  expect(f.provider.writes).toHaveLength(0);
});
it('manual paid-outside operation carries the explicit Stripe flag',async()=>{
  const f=fixture({},'invoice_mark_paid_outside_stripe','open','send_invoice');
  const result=JSON.parse((await makeInvoiceLifecycleWrite('invoice_mark_paid_outside_stripe')
    .handler({invoiceId:inv,expectedRemainingCents:2000,confirm:true},f.ctx))
    .content[0].text);
  expect(result.done).toBe(true);
  expect(f.provider.payloads[0]).toEqual({paid_out_of_band:true});
});
