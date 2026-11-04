// D-5b current-native Stripe invoice lifecycle writes in the
// connection's own mode; never expose raw invoices. (Owner-obedience
// V2, family 4: the TEST-only wrapper gates are converted, not
// relaxed — the core lifecycle's LIVE guard still refuses an
// unenabled LIVE connection before any read.)
import {defineWrite} from './write.js';
import {client,id,ownership,writeProfiles,validateFields} from './billing-shared.js';
import {assertAccountResourceMode} from './account-mode.js';
import {lifecyclePreflight,lifecyclePreview,verifyLifecycleTransition}
  from './invoice-lifecycle-shared.js';

const invoice={invoiceId:id('in')};
const exact={expectedRemainingCents:{type:'integer',minimum:1,maximum:100000000}};
const defs=[
  {name:'invoice_delete_draft',description:'Permanently delete a verified one-off draft invoice, with a deletion read-back.',destructive:true},
  {name:'invoice_finalize',description:'Finalize a manual invoice while keeping automatic collection disabled.'},
  {name:'invoice_send',description:'Send an open invoice to its customer (live mode emails the real customer; test mode only emits the event).'},
  {name:'invoice_charge_now',description:'Charge an open invoice once using the verified saved customer method.',exact:true},
  {name:'invoice_mark_paid_outside_stripe',description:'Record a verified external invoice payment; never charges a card.',exact:true},
  {name:'invoice_void',description:'Permanently void an unpaid open invoice after explicit review.',destructive:true},
  {name:'invoice_mark_uncollectible',description:'Mark an unpaid open invoice uncollectible after explicit review.',destructive:true}
];
const needExact=d=>d.exact===true;
function inputs(d){
  return {...invoice,...(needExact(d)?exact:{}),...ownership};
}
function check(d,a){
  // previewFingerprint is a core write-lifecycle control field (V2
  // shared machinery): strip it before the family validator, exactly
  // as the already-converted families do; the core re-verifies it
  // against the freshly evaluated state on confirm.
  const {previewFingerprint:_control,...fields}=a??{};
  validateFields(fields,inputs(d),['invoiceId',...(needExact(d)?['expectedRemainingCents']:[])]);
}
function prepare(d,a,b){
  if(needExact(d)&&a.expectedRemainingCents!==b.amount_remaining)
    throw new TypeError('Invoice balance changed; obtain a fresh preview before confirming');
  return true;
}
function make(d){
  let receipt=null;
  const op=defineWrite({
    name:d.name,
    ...(d.name==='invoice_charge_now'?{money:async(_a,_ctx,b)=>({
      amountCents:b.amount_remaining,currency:'usd',direction:'in',
      targetId:b.id,description:'Charge provider-verified '+
        (_ctx?.connection?.mode==='live'?'LIVE':'TEST')+' invoice balance'
    })}:{}),
    read:async(a,ctx)=>{
      check(d,a);
      const before=await lifecyclePreflight(d.name,a,await client(ctx),
        ctx?.connection?.mode);
      prepare(d,a,before);
      return before;
    },
    summarize:(b,_a,ctx)=>lifecyclePreview(d.name,b,ctx?.connection?.mode),
    targetGuard:(_a,_ctx,b)=>{
      if(b.deleted)return 'Deleted invoice';
      if(!b.customer)return 'Stripe invoice customer is not verified';
      return true;
    },
    apply:async(a,ctx,{before:b,idempotencyKey})=>{
      const s=await client(ctx),opts={idempotencyKey};
      switch(d.name){
        case 'invoice_delete_draft':
          receipt=await s.invoices.del(b.id,{},opts);break;
        case 'invoice_finalize':
          receipt=await s.invoices.finalizeInvoice(b.id,{auto_advance:false},opts);break;
        case 'invoice_send':
          receipt=await s.invoices.sendInvoice(b.id,{},opts);break;
        case 'invoice_charge_now':
          receipt=await s.invoices.pay(b.id,{
            paid_out_of_band:false,off_session:true,payment_method:b._paymentMethod
          },opts);break;
        case 'invoice_mark_paid_outside_stripe':
          receipt=await s.invoices.pay(b.id,{paid_out_of_band:true},opts);break;
        case 'invoice_void':
          receipt=await s.invoices.voidInvoice(b.id,{},opts);break;
        case 'invoice_mark_uncollectible':
          receipt=await s.invoices.markUncollectible(b.id,{},opts);break;
        default:throw new TypeError('Unknown invoice lifecycle operation');
      }
      if(!receipt||receipt.id!==b.id||receipt.object!=='invoice')
        throw new TypeError('Stripe invoice mutation was not acknowledged for this target');
    },
    readAfter:async(a,ctx)=>{
      const s=await client(ctx);
      if(d.name==='invoice_delete_draft'){
        try{
          await s.invoices.retrieve(a.invoiceId);
          return {id:a.invoiceId,missing:false};
        }catch(e){
          // Only Stripe's definite resource_missing 404 establishes deletion.
          if(e?.statusCode===404&&
            (e.code==='resource_missing'||e.raw?.code==='resource_missing'))
            return {id:a.invoiceId,missing:true};
          throw e;
        }
      }
      return assertAccountResourceMode(
        await s.invoices.retrieve(a.invoiceId),ctx?.connection?.mode);
    },
    verify:(b,after,_a,ctx)=>verifyLifecycleTransition(d.name,b,after,receipt,
      ctx?.connection?.mode)
  });
  return op;
}
export const tools=defs.map(d=>{
  const op=make(d);
  return {...op.tool,area:'invoices',profiles:writeProfiles,
    description:d.description,
    annotations:{destructiveHint:d.destructive===true},
    inputSchema:{type:'object',properties:{
      ...inputs(d),confirm:{type:'boolean'},dryRun:{type:'boolean'},
      previewFingerprint:{type:'string',maxLength:64},
      requestKey:{type:'string',minLength:1,maxLength:128}
    },required:['invoiceId',...(needExact(d)?['expectedRemainingCents']:[])],
    additionalProperties:false}};
});
export const handlers=Object.fromEntries(defs.map(d=>[
  d.name,async(a,ctx)=>{
    const s=await client(ctx);
    return make(d).handler(a,{...ctx,getCustomer:id=>s.customers.retrieve(id)});
  }
]));
export function makeInvoiceLifecycleWrite(name){
  const d=defs.find(x=>x.name===name);
  if(!d)throw new TypeError('Unknown invoice lifecycle write');
  return make(d);
}
