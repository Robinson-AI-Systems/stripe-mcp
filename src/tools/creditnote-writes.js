// D-5c guarded TEST credit-note issuing and voiding; never an AI-approved refund.
import {defineWrite,gone} from './write.js';
import {client,id,ownership,ref,writeProfiles,validateFields}
  from './billing-shared.js';
import {protectAppOwnedTarget} from './app-guard.js';
import {creditPreflight,creditSummary,creditVerifyIssued,
  creditReasons,creditAllocation,creditAmount,creditMemo}
  from './creditnote-shared.js';
const defs=[
  {name:'creditnote_create',description:'Issue a TEST credit note only after exact independent owner money-out approval.',
    props:{invoiceId:id('in'),amountCents:creditAmount,
      allocation:creditAllocation,reason:creditReasons,memo:creditMemo,
      ...ownership},required:['invoiceId','amountCents','allocation','reason'],money:true},
  {name:'creditnote_void',description:'Void a TEST credit note without reversing a settled refund.',
    props:{creditNoteId:id('cn'),...ownership},required:['creditNoteId'],destructive:true}
];
const cents=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
async function preflight(d,a,s){
  if(d.money)return creditPreflight(a,s);
  const cn=await s.creditNotes.retrieve(a.creditNoteId);
  if(cn?.object!=='credit_note'||cn.status!=='issued'||
    cn.currency!=='usd'||!cents(cn.amount)||cn.amount===0||
    !/^in_[A-Za-z0-9]{2,100}$/.test(ref(cn.invoice)??'')||
    !cents(cn.refund_amount??0)||cn.refund_amount>0||
    !cents(cn.out_of_band_amount??0)||cn.out_of_band_amount>0)
    throw new TypeError('Only issued non-refunded TEST credit notes can be voided');
  const invoice=await s.invoices.retrieve(ref(cn.invoice));
  if(invoice?.object!=='invoice'||invoice.currency!=='usd'||
    ref(invoice.customer)!==ref(cn.customer))
    throw new TypeError('Credit note original invoice cannot be verified');
  return {...cn,_invoice:invoice};
}
function make(d){
  let created=null;
  const op=defineWrite({
    name:d.name,
    read:async(a,ctx)=>{
      validateFields(a,d.props,d.required);
      return preflight(d,a,await client(ctx));
    },
    summarize:(b,a)=>d.money?creditSummary(b,a):
      'TEST MODE. Void credit note '+b.id+' for invoice '+
      ref(b.invoice)+'. Refunds and externally settled credits cannot be voided.'+
      ' Confirmation and independent Stripe read-back are required.',
    money:d.money?async(a,_ctx,b)=>({
      amountCents:b._creditPreview.amountCents,currency:'usd',direction:'out',
      targetId:b.id,description:'Owner approval for exact Stripe credit note issuance'
    }):undefined,
    targetGuard:async(a,ctx,b)=>d.money?true:
      protectAppOwnedTarget(a,ctx,b._invoice),
    apply:async(a,ctx,{before:b,idempotencyKey})=>{
      const s=await client(ctx),opts={idempotencyKey};
      if(d.money){
        created=await s.creditNotes.create(b._creditParams,opts);
        if(!created||created.object!=='credit_note'||
          ref(created.invoice)!==b.id||!created.id)
          throw new TypeError('Stripe did not acknowledge an exact credit note');
        b._createdId=created.id;
      }else{
        created=await s.creditNotes.voidCreditNote(a.creditNoteId,{},opts);
        if(created?.id!==b.id||created.object!=='credit_note')
          throw new TypeError('Stripe did not acknowledge target credit note void');
      }
    },
    readAfter:async(a,ctx)=>{
      const s=await client(ctx);
      return d.money?(created?.id?s.creditNotes.retrieve(created.id):null):
        s.creditNotes.retrieve(a.creditNoteId);
    },
    verify:(b,after,a)=>d.money?
      creditVerifyIssued(b,after,a,b._createdId):
      after?.id===b.id&&after?.object==='credit_note'&&
        after.status==='void'&&ref(after.invoice)===ref(b.invoice)&&
        ref(after.customer)===ref(b.customer)&&after.currency==='usd'
  });
  return {...op,handler:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Credit note writes require TEST mode'):op.handler(a,ctx)};
}
export const tools=defs.map(d=>{
  const op=make(d);
  return {...op.tool,area:'invoices',profiles:writeProfiles,
    description:d.description,
    annotations:{destructiveHint:d.destructive===true},
    inputSchema:{type:'object',properties:{...d.props,
      dryRun:{type:'boolean'},confirm:{type:'boolean'},
      requestKey:{type:'string',minLength:1,maxLength:128}},
      required:d.required,additionalProperties:false}};
});
export const handlers=Object.fromEntries(defs.map(d=>[
  d.name,async(a,ctx)=>{
    if(ctx?.connection?.mode!=='test')return gone('Credit note writes require TEST mode');
    const s=await client(ctx);
    return make(d).handler(a,{...ctx,getCustomer:id=>s.customers.retrieve(id)});
  }
]));
export function makeCreditNoteWrite(name){
  const d=defs.find(x=>x.name===name);
  if(!d)throw new TypeError('Unknown credit note write');
  return make(d);
}
