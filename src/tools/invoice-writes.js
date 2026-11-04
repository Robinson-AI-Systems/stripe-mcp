// Native draft invoice changes in the connection's own mode, with
// explicit preview, confirmation and readback (owner-obedience V2,
// family 4: the TEST-only wrapper gate is converted, not relaxed —
// the core lifecycle's LIVE guard still refuses an unenabled LIVE
// connection before any read).
import {defineWrite} from './write.js';
import {client,ref,id,ownership,writeProfiles,validateFields,optionalMetadata}
  from './billing-shared.js';
import {assertAccountResourceMode} from './account-mode.js';
import {invoiceText,invoiceCents,invoiceMethod,daysDue,verifiedCustomer,
  verifiedDraft,verifiedInvoiceItem,verifyInvoiceResult,verifyInvoiceLineResult,
  draftPreview} from './invoice-draft-shared.js';

const invoice={invoiceId:id('in')},line={lineItemId:id('ii')};
const defs=[
  {name:'invoice_create_draft',description:'Create a manual draft invoice for a verified customer without a payment attempt.',
    props:{customerId:id('cus'),collectionMethod:invoiceMethod,daysUntilDue:daysDue,
      description:invoiceText(500),...ownership},
    required:['customerId','collectionMethod'],type:'create'},
  {name:'invoice_update_draft',description:'Edit the description, footer or metadata of a draft invoice.',
    props:{...invoice,description:invoiceText(500),footer:invoiceText(500),
      metadata:optionalMetadata,...ownership},
    required:['invoiceId'],type:'update'},
  {name:'invoice_add_line',description:'Add a positive USD amount to a draft invoice without charging anyone.',
    props:{...invoice,amountCents:invoiceCents,description:invoiceText(500),...ownership},
    required:['invoiceId','amountCents','description'],type:'lineAdd'},
  {name:'invoice_update_line',description:'Change a verified positive draft invoice item amount or description.',
    props:{...invoice,...line,amountCents:invoiceCents,
      description:invoiceText(500),...ownership},
    required:['invoiceId','lineItemId'],type:'lineUpdate'},
  {name:'invoice_remove_line',description:'Remove one verified invoice item from an unfinalized draft.',
    props:{...invoice,...line,...ownership},
    required:['invoiceId','lineItemId'],type:'lineRemove',destructive:true}
];
function validate(d,a){
  // previewFingerprint is a core write-lifecycle control field (V2
  // shared machinery): strip it before the family validator, exactly
  // as the already-converted families do; the core re-verifies it
  // against the freshly evaluated state on confirm.
  const {previewFingerprint:_control,...fields}=a??{};
  validateFields(fields,d.props,d.required);
  if(d.type==='create'){
    if(fields.collectionMethod==='send_invoice'&&!fields.daysUntilDue)
      throw new TypeError('Sending an invoice requires explicit daysUntilDue');
    if(fields.collectionMethod==='charge_automatically'&&fields.daysUntilDue!==undefined)
      throw new TypeError('Automatic collection cannot specify daysUntilDue');
  }
  if(d.type==='update'&&!['description','footer','metadata'].some(k=>fields[k]!==undefined))
    throw new TypeError('Draft update requires at least one changed field');
  if(d.type==='lineUpdate'&&fields.amountCents===undefined&&fields.description===undefined)
    throw new TypeError('Draft line update requires a new amount or description');
}
async function preflight(d,a,s,mode){
  if(d.type==='create'){
    const customer=verifiedCustomer(await s.customers.retrieve(a.customerId),mode);
    return {...customer,_preview:{beforeCents:0,afterCents:0}};
  }
  const b=verifiedDraft(await s.invoices.retrieve(a.invoiceId),mode);
  if(d.type.startsWith('line')&&d.type!=='lineAdd'){
    const item=await s.invoiceItems.retrieve(a.lineItemId);
    b._item=verifiedInvoiceItem(item,b,mode);
  }
  b._preview=draftPreview(b,a,d.name,mode);
  return b;
}
function allowed(d,b){
  if(b.deleted)return 'Deleted invoice or customer';
  if(d.type!=='create'&&b.status!=='draft')return 'Only draft invoices can be changed';
  if(d.type==='create'&&b.invoice_settings===null)
    return 'Customer invoice settings unavailable';
  return true;
}
function plan(d,b,a,mode){
  const p=b._preview;
  const fields=Object.keys(a).filter(k=>
    !['confirm','dryRun','requestKey','outsideApp','previewFingerprint'].includes(k));
  return (mode==='live'?'LIVE MODE. ':'TEST MODE. ')+d.name+' target '+b.id+
    '; before '+p.beforeCents+' cents USD, proposed draft after '+
    p.afterCents+' cents USD. '+(p.explanation??'')+
    '. Changed fields '+fields.join(', ')+
    '. No finalization or payment; confirmation plus Stripe read-back mandatory.';
}
// A read-back whose provider mode disagrees with the connection can
// never verify (the assertAccountResourceMode rule, boolean form for
// the verify hook): a present livemode must equal the connection's.
const modeOk=(v,mode)=>v?.livemode===undefined||v.livemode===(mode==='live');
function make(d){
  let created=null;
  const op=defineWrite({
    name:d.name,
    read:async(a,ctx)=>{
      validate(d,a);
      return preflight(d,a,await client(ctx),ctx?.connection?.mode);
    },
    summarize:(b,a,ctx)=>plan(d,b,a,ctx?.connection?.mode),
    targetGuard:(_a,_ctx,b)=>allowed(d,b),
    apply:async(a,ctx,{before:b,idempotencyKey})=>{
      const s=await client(ctx),opts={idempotencyKey};
      switch(d.name){
        case 'invoice_create_draft':
          created=await s.invoices.create({
            customer:b.id,currency:'usd',auto_advance:false,
            pending_invoice_items_behavior:'exclude',
            collection_method:a.collectionMethod,
            ...(a.collectionMethod==='send_invoice'?{days_until_due:a.daysUntilDue}:{}),
            ...(a.description?{description:a.description}:{})
          },opts);
          b._createdId=created?.id;break;
        case 'invoice_update_draft':
          await s.invoices.update(b.id,{
            auto_advance:false,
            ...(a.description!==undefined?{description:a.description}:{}),
            ...(a.footer!==undefined?{footer:a.footer}:{}),
            ...(a.metadata?{metadata:a.metadata}:{})
          },opts);break;
        case 'invoice_add_line':
          created=await s.invoiceItems.create({customer:ref(b.customer),invoice:b.id,
            currency:'usd',amount:a.amountCents,description:a.description},opts);
          b._createdId=created?.id;break;
        case 'invoice_update_line':
          await s.invoiceItems.update(a.lineItemId,{
            ...(a.amountCents!==undefined?{amount:a.amountCents}:{}),
            ...(a.description!==undefined?{description:a.description}:{})
          },opts);break;
        case 'invoice_remove_line':
          await s.invoiceItems.del(a.lineItemId,{},opts);break;
        default:throw new TypeError('Unknown draft invoice mutation');
      }
    },
    readAfter:async(a,ctx)=>{
      const s=await client(ctx),mode=ctx?.connection?.mode;
      if(d.type==='create')return created?.id?
        assertAccountResourceMode(await s.invoices.retrieve(created.id),mode):null;
      if(d.type==='update')
        return assertAccountResourceMode(await s.invoices.retrieve(a.invoiceId),mode);
      if(d.type==='lineAdd')return created?.id?
        assertAccountResourceMode(await s.invoiceItems.retrieve(created.id),mode):null;
      if(d.type==='lineUpdate')
        return assertAccountResourceMode(await s.invoiceItems.retrieve(a.lineItemId),mode);
      const list=await s.invoiceItems.list({invoice:a.invoiceId,limit:100});
      if(Array.isArray(list?.data))
        for(const item of list.data)assertAccountResourceMode(item,mode);
      return list;
    },
    verify:(b,after,a,ctx)=>{
      const mode=ctx?.connection?.mode;
      if(d.type==='lineRemove'){
        if(!Array.isArray(after?.data)||
          !after.data.every(x=>modeOk(x,mode)))return false;
      }else if(!modeOk(after,mode))return false;
      return d.type==='create'||d.type==='update'?
        verifyInvoiceResult(b,after,a,d.name):
        verifyInvoiceLineResult(b,after,a,d.name);
    }
  });
  return op;
}
export const tools=defs.map(d=>{
  const op=make(d);
  return {...op.tool,area:'invoices',profiles:writeProfiles,
    description:d.description,annotations:{destructiveHint:d.destructive===true},
    inputSchema:{type:'object',properties:{...d.props,
      confirm:{type:'boolean'},dryRun:{type:'boolean'},
      previewFingerprint:{type:'string',maxLength:64},
      requestKey:{type:'string',minLength:1,maxLength:128}},
      required:d.required,additionalProperties:false}};
});
export const handlers=Object.fromEntries(defs.map(d=>[
  d.name,async(a,ctx)=>{
    const s=await client(ctx);
    return make(d).handler(a,{...ctx,getCustomer:id=>s.customers.retrieve(id)});
  }
]));
export function makeInvoiceDraftWrite(name){
  const d=defs.find(x=>x.name===name);
  if(!d)throw new TypeError('Unknown draft invoice write');
  return make(d);
}
