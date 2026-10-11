// D-5a real-handler tests: every draft invoice write exercises the actual guard.
import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makeInvoiceDraftWrite} from '../../src/tools/invoice-writes.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';

const cus='cus_FAKE1234',invoice='in_FAKE1234',item='ii_FAKE1234';
const scenarios=[
  {name:'invoice_create_draft',args:{customerId:cus,
    collectionMethod:'send_invoice',daysUntilDue:30,description:'TEST draft'}},
  {name:'invoice_update_draft',args:{invoiceId:invoice,description:'Updated TEST invoice'}},
  {name:'invoice_add_line',args:{invoiceId:invoice,amountCents:1500,
    description:'New TEST draft item'}},
  {name:'invoice_update_line',args:{invoiceId:invoice,lineItemId:item,
    amountCents:2500,description:'Updated item'}},
  {name:'invoice_remove_line',args:{invoiceId:invoice,lineItemId:item}}
];
const plain=r=>JSON.parse(r.content[0].text);
function fixture({appOwned=false,readBackMatches=true,limitCents=10000},_name){
  const marker=appOwned?{agreementId:'ag_FAKE1234'}:{};
  const provider={writes:[],afterCalls:0,payloads:[]};
  const db=createFakeDb({accounts:[{id:'acct_safefixture',
    label:'Fixture',money_limit_cents:limitCents}]});
  const customer={id:cus,object:'customer',deleted:false,metadata:marker,
    invoice_settings:{default_payment_method:null}};
  const draft={id:invoice,object:'invoice',customer:cus,status:'draft',
    auto_advance:false,collection_method:'send_invoice',currency:'usd',
    total:2000,amount_due:2000,metadata:marker,description:'Draft before',
    lines:{data:[],has_more:false},subscription:null};
  let current={...draft},createdInvoice=null;
  let currentItem={id:item,object:'invoiceitem',invoice,customer:cus,
    amount:1000,currency:'usd',metadata:{},proration:false,description:'Initial'};
  let added=null,removed=false;
  function write(kind,args,opts){
    if(!opts?.idempotencyKey)throw new Error('Provider idempotency key required');
    provider.writes.push({idempotencyKey:opts.idempotencyKey,kind});
    provider.payloads.push(args);
  }
  const sdk={
    customers:{retrieve:async()=>customer},
    invoices:{
      async retrieve(id){
        if(provider.writes.length)provider.afterCalls++;
        if(id==='in_NEW1234')return readBackMatches?createdInvoice:
          {...createdInvoice,status:'open'};
        return current;
      },
      async create(args,opts){
        write('create',args,opts);
        createdInvoice={...draft,id:'in_NEW1234',customer:args.customer,
          total:0,amount_due:0,collection_method:args.collection_method,
          auto_advance:args.auto_advance,description:args.description??null};
        return createdInvoice;
      },
      async update(id,args,opts){
        write('update',args,opts);
        if(readBackMatches)current={...current,
          description:args.description??current.description,
          footer:args.footer??current.footer,
          metadata:{...current.metadata,...args.metadata}};
        return current;
      }
    },
    invoiceItems:{
      async retrieve(id){
        if(provider.writes.length)provider.afterCalls++;
        if(id==='ii_NEW1234')return readBackMatches?added:{...added,amount:999};
        return currentItem;
      },
      async create(args,opts){
        write('add',args,opts);
        added={...currentItem,id:'ii_NEW1234',amount:args.amount,
          description:args.description,customer:args.customer,invoice:args.invoice};
        return added;
      },
      async update(id,args,opts){
        write('updateLine',args,opts);
        if(readBackMatches)currentItem={...currentItem,
          amount:args.amount??currentItem.amount,
          description:args.description??currentItem.description};
        return currentItem;
      },
      async del(id,args,opts){
        write('deleteLine',args,opts);
        removed=readBackMatches;
        return {id,object:'invoiceitem',deleted:true};
      },
      async list(){
        if(provider.writes.length)provider.afterCalls++;
        return {object:'list',data:removed?[]:[currentItem],has_more:false};
      }
    }
  };
  const ctx={connection:{stripeAccount:'acct_safefixture',mode:'test',profile:'full'},
    connectionId:'owner-client-fixture',db,getCustomer:async()=>customer,
    services:{stripeForConnection:async()=>sdk}};
  return {provider,db,ctx,sdk};
}
for(const {name,args} of scenarios){
  describe('D-5a '+name,()=>{
    runWriteContract({withMoney:false,strictArgs:true,args,
      tool:()=>makeInvoiceDraftWrite(name),fixtures:o=>fixture(o,name)});
  });
}
it('cannot insert negative USD credit or implicit money-out into a draft',async()=>{
  const f=fixture({readBackMatches:true},'invoice_add_line');
  const op=makeInvoiceDraftWrite('invoice_add_line');
  await expect(op.handler({invoiceId:invoice,amountCents:-500,
    description:'credit',confirm:true},f.ctx)).rejects.toThrow(/Invalid/);
  expect(f.provider.writes).toHaveLength(0);
});
it('cannot change a finalized invoice, even with caller confirm and full profile',async()=>{
  const f=fixture({readBackMatches:true},'invoice_update_draft');
  f.sdk.invoices.retrieve=async()=>({id:invoice,object:'invoice',status:'open',
    customer:cus,auto_advance:false,currency:'usd',total:300,
    amount_due:300,collection_method:'send_invoice'});
  await expect(makeInvoiceDraftWrite('invoice_update_draft').handler({
    invoiceId:invoice,description:'Override',confirm:true
  },f.ctx)).rejects.toThrow(/draft invoice/);
  expect(f.provider.writes).toHaveLength(0);
});
it('refuses foreign invoice item, even when it exists in TEST provider',async()=>{
  const f=fixture({readBackMatches:true},'invoice_remove_line');
  f.sdk.invoiceItems.retrieve=async()=>({id:item,object:'invoiceitem',
    invoice:'in_OTHER1234',customer:cus,amount:300,currency:'usd',metadata:{}});
  await expect(makeInvoiceDraftWrite('invoice_remove_line')
    .handler({invoiceId:invoice,lineItemId:item,confirm:true},f.ctx))
    .rejects.toThrow(/verified positive/);
  expect(f.provider.writes).toHaveLength(0);
});
it('invoice create never imports pending items or enables automatic finalization',async()=>{
  const f=fixture({readBackMatches:true},'invoice_create_draft');
  const res=plain(await makeInvoiceDraftWrite('invoice_create_draft')
    .handler({...scenarios[0].args,confirm:true},f.ctx));
  expect(res.done).toBe(true);
  expect(f.provider.payloads[0]).toMatchObject({
    customer:cus,currency:'usd',auto_advance:false,
    pending_invoice_items_behavior:'exclude',collection_method:'send_invoice',
    days_until_due:30
  });
});
it('no access to invoices by guessed name from read-only mode',async()=>{
  const f=fixture({readBackMatches:true},'invoice_update_draft');
  const result=await dispatchReadOnlyTool({registry,name:'invoice_update_draft',
    args:{invoiceId:invoice,description:'No',confirm:true},
    connection:{...f.ctx.connection,profile:'read_only'},db:f.db,
    services:f.ctx.services});
  expect(result.isError).toBe(true);
  expect(f.provider.writes).toHaveLength(0);
});
