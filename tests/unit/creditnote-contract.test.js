// D-5c actual-handler contracts, including separately simulated owner money grant.
import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makeCreditNoteWrite} from '../../src/tools/creditnote-writes.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const invoice='in_FAKE1234',customerId='cus_FAKE1234',credit='cn_FAKE1234';
const issue={invoiceId:invoice,amountCents:8500,
  reason:'order_change',allocation:'reduce_unpaid'};
const voidArgs={creditNoteId:credit};
const parse=r=>JSON.parse(r.content[0].text);
function fixture({appOwned=false,readBackMatches=true,limitCents=10000}){
  const metadata=appOwned?{agreementId:'ag_FAKE1234'}:{};
  const db=createFakeDb({accounts:[{id:'acct_safefixture',
    label:'Fixture',money_limit_cents:limitCents}]});
  const provider={writes:[],afterCalls:0,payloads:[]};
  const customer={id:customerId,object:'customer',metadata,deleted:false};
  const before={id:invoice,object:'invoice',customer:customerId,
    status:'open',currency:'usd',amount_remaining:8500,amount_paid:0,
    total:8500,metadata,pre_payment_credit_notes_amount:0,
    post_payment_credit_notes_amount:0};
  const creditNote={id:credit,object:'credit_note',invoice,
    customer:customerId,status:'issued',currency:'usd',amount:8500,
    refund_amount:0,credit_amount:0,out_of_band_amount:0};
  let created={...creditNote,id:'cn_NEW1234'},current={...creditNote};
  const write=(kind,args,opts)=>{
    if(!opts?.idempotencyKey)throw new Error('Stripe idempotency required');
    provider.writes.push({kind,idempotencyKey:opts.idempotencyKey});
    provider.payloads.push(args);
  };
  const sdk={
    customers:{retrieve:async()=>customer},
    invoices:{retrieve:async()=>before},
    creditNotes:{
      preview:async params=>({...creditNote,id:'cn_PREVIEW1234',
        amount:params.amount,
        refund_amount:params.refund_amount??0,
        credit_amount:params.credit_amount??0}),
      async retrieve(id){
        if(provider.writes.length)provider.afterCalls++;
        if(id==='cn_NEW1234')return readBackMatches?created:
          {...created,status:'void'};
        return current;
      },
      async create(params,opts){
        write('create',params,opts);
        created={...creditNote,id:'cn_NEW1234',amount:params.amount,
          refund_amount:params.refund_amount??0,
          credit_amount:params.credit_amount??0};
        return created;
      },
      async voidCreditNote(id,params,opts){
        write('void',params,opts);
        if(readBackMatches)current={...current,status:'void'};
        return {...current,status:'void'};
      }
    }
  };
  const ctx={connection:{stripeAccount:'acct_safefixture',mode:'test',
    profile:'full'},connectionId:'owner-client-fixture',db,
    getCustomer:async()=>customer,
    services:{stripeForConnection:async()=>sdk}};
  return {ctx,db,sdk,provider};
}
describe('creditnote_create',()=>{
  runWriteContract({withMoney:true,strictArgs:true,args:issue,
    tool:()=>makeCreditNoteWrite('creditnote_create'),
    fixtures:o=>fixture(o,'create')});
});
describe('creditnote_void',()=>{
  runWriteContract({withMoney:false,strictArgs:true,args:voidArgs,
    tool:()=>makeCreditNoteWrite('creditnote_void'),
    fixtures:o=>fixture(o,'void')});
});
it('never issues a provider credit with unverified allocation',async()=>{
  const f=fixture({});
  const original=f.sdk.creditNotes.preview;
  f.sdk.creditNotes.preview=async p=>({...await original(p),
    refund_amount:8500});
  await expect(makeCreditNoteWrite('creditnote_create').handler({
    ...issue,confirm:true},f.ctx)).rejects.toThrow(/allocation/);
  expect(f.provider.writes).toHaveLength(0);
});
it('no AI-supplied money-out confirmation alone can create a credit',async()=>{
  const f=fixture({});
  const out=parse(await makeCreditNoteWrite('creditnote_create').handler({
    ...issue,confirm:true},f.ctx));
  expect(out.done).toBe(false);
  expect(out.error).toMatch(/explicit approval is required/);
  expect(f.provider.writes).toHaveLength(0);
});
it('refuses open invoices when requested credit exceeds provider remainder',async()=>{
  const f=fixture({});
  await expect(makeCreditNoteWrite('creditnote_create').handler({
    ...issue,amountCents:9000,confirm:true},f.ctx))
    .rejects.toThrow(/exceed current unpaid/);
  expect(f.provider.writes).toHaveLength(0);
});
it('refuses reversing refunded credit note, even for a confirmed request',async()=>{
  const f=fixture({});
  f.sdk.creditNotes.retrieve=async()=>({
    id:credit,object:'credit_note',invoice,customer:customerId,
    status:'issued',currency:'usd',amount:8500,refund_amount:8500,
    credit_amount:0,out_of_band_amount:0
  });
  await expect(makeCreditNoteWrite('creditnote_void').handler({
    ...voidArgs,confirm:true},f.ctx)).rejects.toThrow(/non-refunded/);
  expect(f.provider.writes).toHaveLength(0);
});
it('read-only users cannot call creditnote_create by guessing its name',async()=>{
  const f=fixture({});
  const res=await dispatchReadOnlyTool({
    registry,name:'creditnote_create',args:{...issue,confirm:true},
    connection:{...f.ctx.connection,profile:'read_only'},
    db:f.db,services:f.ctx.services
  });
  expect(res.isError).toBe(true);
  expect(f.provider.writes).toHaveLength(0);
});
