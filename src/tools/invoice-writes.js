// TEST-only native draft invoice changes with explicit preview, confirmation and readback.
import {defineWrite,gone} from './write.js';
import {client,ref,id,ownership,writeProfiles,validateFields,optionalMetadata}
  from './billing-shared.js';
import {invoiceText,invoiceCents,invoiceMethod,daysDue,verifiedCustomer,
  verifiedDraft,verifiedInvoiceItem,verifyInvoiceResult,verifyInvoiceLineResult,
  draftPreview} from './invoice-draft-shared.js';

const invoice={invoiceId:id('in')},line={lineItemId:id('ii')};
const defs=[
  {name:'invoice_create_draft',description:'Create a manual TEST draft invoice for a verified customer without a payment attempt.',
    props:{customerId:id('cus'),collectionMethod:invoiceMethod,daysUntilDue:daysDue,
      description:invoiceText(500),...ownership},
    required:['customerId','collectionMethod'],type:'create'},
  {name:'invoice_update_draft',description:'Edit the description, footer or metadata of a TEST draft invoice.',
    props:{...invoice,description:invoiceText(500),footer:invoiceText(500),
      metadata:optionalMetadata,...ownership},
    required:['invoiceId'],type:'update'},
  {name:'invoice_add_line',description:'Add a positive USD amount to a TEST draft invoice without charging anyone.',
    props:{...invoice,amountCents:invoiceCents,description:invoiceText(500),...ownership},
    required:['invoiceId','amountCents','description'],type:'lineAdd'},
  {name:'invoice_update_line',description:'Change a verified positive draft invoice item amount or description.',
    props:{...invoice,...line,amountCents:invoiceCents,
      description:invoiceText(500),...ownership},
    required:['invoiceId','lineItemId'],type:'lineUpdate'},
  {name:'invoice_remove_line',description:'Remove one verified TEST invoice item from an unfinalized draft.',
    props:{...invoice,...line,...ownership},
    required:['invoiceId','lineItemId'],type:'lineRemove',destructive:true}
];
function validate(d,a){
  validateFields(a,d.props,d.required);
  if(d.type==='create'){
    if(a.collectionMethod==='send_invoice'&&!a.daysUntilDue)
      throw new TypeError('Sending an invoice requires explicit daysUntilDue');
    if(a.collectionMethod==='charge_automatically'&&a.daysUntilDue!==undefined)
      throw new TypeError('Automatic collection cannot specify daysUntilDue');
  }
  if(d.type==='update'&&!['description','footer','metadata'].some(k=>a[k]!==undefined))
    throw new TypeError('Draft update requires at least one changed field');
  if(d.type==='lineUpdate'&&a.amountCents===undefined&&a.description===undefined)
    throw new TypeError('Draft line update requires a new amount or description');
}
async function preflight(d,a,s){
  if(d.type==='create'){
    const customer=verifiedCustomer(await s.customers.retrieve(a.customerId));
    return {...customer,_preview:{beforeCents:0,afterCents:0}};
  }
  const b=verifiedDraft(await s.invoices.retrieve(a.invoiceId));
  if(d.type.startsWith('line')&&d.type!=='lineAdd'){
    const item=await s.invoiceItems.retrieve(a.lineItemId);
    b._item=verifiedInvoiceItem(item,b);
  }
  b._preview=draftPreview(b,a,d.name);
  return b;
}
function allowed(d,b){
  if(b.deleted)return 'Deleted invoice or customer';
  if(d.type!=='create'&&b.status!=='draft')return 'Only draft invoices can be changed';
  if(d.type==='create'&&b.invoice_settings===null)
    return 'Customer invoice settings unavailable';
  return true;
}
function plan(d,b,a){
  const p=b._preview;
  const fields=Object.keys(a).filter(k=>
    !['confirm','dryRun','requestKey','outsideApp'].includes(k));
  return 'TEST MODE. '+d.name+' target '+b.id+
    '; before '+p.beforeCents+' cents USD, proposed draft after '+
    p.afterCents+' cents USD. '+(p.explanation??'')+
    '. Changed fields '+fields.join(', ')+
    '. No finalization or payment; confirmation plus Stripe read-back mandatory.';
}
function make(d){
  let created=null;
  const op=defineWrite({
    name:d.name,
    read:async(a,ctx)=>{
      validate(d,a);return preflight(d,a,await client(ctx));
    },
    summarize:(b,a)=>plan(d,b,a),
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
      const s=await client(ctx);
      if(d.type==='create')return created?.id?s.invoices.retrieve(created.id):null;
      if(d.type==='update')return s.invoices.retrieve(a.invoiceId);
      if(d.type==='lineAdd')return created?.id?s.invoiceItems.retrieve(created.id):null;
      if(d.type==='lineUpdate')return s.invoiceItems.retrieve(a.lineItemId);
      return s.invoiceItems.list({invoice:a.invoiceId,limit:100});
    },
    verify:(b,after,a)=>d.type==='create'||d.type==='update'?
      verifyInvoiceResult(b,after,a,d.name):
      verifyInvoiceLineResult(b,after,a,d.name)
  });
  return {...op,handler:async(a,ctx)=>{
    if(ctx?.connection?.mode!=='test')return gone('Invoice draft writes require TEST mode');
    return op.handler(a,ctx);
  }};
}
export const tools=defs.map(d=>{
  const op=make(d);
  return {...op.tool,area:'invoices',profiles:writeProfiles,
    description:d.description,annotations:{destructiveHint:d.destructive===true},
    inputSchema:{type:'object',properties:{...d.props,
      confirm:{type:'boolean'},dryRun:{type:'boolean'},
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
