// Current native invoice reads and explicit provider preview, in the
// connection's own mode (CAP-4 D-3). All results are safe projections;
// every returned object is verified against the connection mode.
import {allProfiles,id,paging,pageResult,guarded,checkId,ref,local,
  positiveTotal} from './billing-shared.js';
import {assertAccountResourceMode} from './account-mode.js';
import {invoicePaymentSafe,invoicePreviewReadSafe} from './invoice-read-safety.js';
const page={limit:{type:'integer',minimum:1,maximum:100},
  starting_after:{type:'string',minLength:2,maxLength:110}};
const query={type:'string',minLength:1,maxLength:400};
const def=(name,description,properties={},required=[])=>({
  name,description,area:'invoices',profiles:allProfiles,writes:false,
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties,required,additionalProperties:false}
});
export const tools=[
  def('invoice_list','List invoices in the connection mode with exact amount, currency and customer.',{
    ...page,customerId:id('cus'),status:{type:'string',
      enum:['draft','open','paid','void','uncollectible']}}),
  def('invoice_get','Inspect an invoice in the connection mode, its customer, totals and status.',
    {invoiceId:id('in'),linesLimit:{type:'integer',minimum:1,maximum:100},
      linesStartingAfter:{type:'string',minLength:2,maxLength:110}},['invoiceId']),
  def('invoice_search','Search invoices in the connection mode with bounded native Stripe search.',{
    query,limit:page.limit,page:{type:'string',minLength:2,maxLength:200}},['query']),
  def('invoice_list_payments','List payments allocated to one invoice in the connection mode.',{
    invoiceId:id('in'),...page},['invoiceId']),
  def('invoice_preview','Preview the next invoice for a verified customer in the connection mode.',{
    customerId:id('cus')},['customerId'])
];
export function safeInvoice(v,mode){
  if(!v||v.object!=='invoice'||typeof v.id!=='string')
    throw new TypeError('Verified Stripe invoice required');
  // CAP-4 D-3: with a connection mode supplied, the invoice's own
  // livemode must equal it; no mode keeps historical behavior.
  if(['test','live'].includes(mode))assertAccountResourceMode(v,mode);
  return {id:v.id,object:'invoice',customer:ref(v.customer),
    status:v.status,number:v.number??null,currency:v.currency,
    attemptCount:Number.isSafeInteger(v.attempt_count)?v.attempt_count:null,
    nextPaymentAttemptUnix:Number.isSafeInteger(v.next_payment_attempt)?v.next_payment_attempt:null,
    nextPaymentAttemptLocal:local(v.next_payment_attempt),
    amount_due:v.amount_due??null,amount_paid:v.amount_paid??null,
    amount_remaining:v.amount_remaining??null,total:v.total??null,
    subtotal:v.subtotal??null,collection_method:v.collection_method??null,
    auto_advance:v.auto_advance??null,due_date_local:local(v.due_date),
    created_local:local(v.created),hosted_invoice_url:v.hosted_invoice_url??null,
    lines:v.lines?.data?.slice(0,15).map(x=>({
      id:x.id,amount:x.amount,currency:x.currency,description:x.description,
      invoiceItem:ref(x.parent?.invoice_item_details?.invoice_item)??ref(x.invoice_item),
      quantity:x.quantity??null
    }))??[],linesHasMore:v.lines?.has_more??false,
    metadata:v.metadata??{}};
}
function search(a){
  if(typeof a?.query!=='string'||a.query.length>400||!a.query.trim()||
    !/^[A-Za-z0-9_@\-\s.\[\]:'"~+*]+$/.test(a.query))
    throw new TypeError('Invalid native invoice search expression');
  const p=a.page;
  if(p!==undefined&&!/^[A-Za-z0-9_-]{2,200}$/.test(p))
    throw new TypeError('Invalid invoice search cursor');
  return {query:a.query,limit:paging(a).limit,...(p?{page:p}:{})};
}
export const handlers={
  invoice_list:(a,ctx)=>guarded(ctx,async s=>pageResult(
    await s.invoices.list({...paging(a),
      ...(a?.customerId?{customer:checkId(a.customerId,'cus')}:{}),
      ...(a?.status?{status:a.status}:{})}),
    v=>safeInvoice(v,ctx?.connection?.mode))),
  invoice_get:(a,ctx)=>guarded(ctx,async s=>{
    const invoiceId=checkId(a?.invoiceId,'in');
    const invoice=await s.invoices.retrieve(invoiceId);
    if(['test','live'].includes(ctx?.connection?.mode))
      assertAccountResourceMode(invoice,ctx.connection.mode);
    const limit=a?.linesLimit??20;
    if(!Number.isInteger(limit)||limit<1||limit>100)
      throw new TypeError('Invoice line page limit must be 1–100');
    if(a?.linesStartingAfter!==undefined&&
      !/^il_[A-Za-z0-9]{2,100}$/.test(a.linesStartingAfter))
      throw new TypeError('Invalid invoice line cursor');
    const lines=await s.invoices.listLineItems(invoiceId,{limit,
      ...(a?.linesStartingAfter?{starting_after:a.linesStartingAfter}:{})});
    if(!Array.isArray(lines?.data)||lines.data.some(l=>!l.id||l.currency!=='usd'))
      throw new TypeError('Stripe invoice line page unavailable');
    return {...safeInvoice({...invoice,lines},ctx?.connection?.mode),
      nextLineCursor:lines.has_more===true?lines.data.at(-1)?.id??null:null,
      linesCount:lines.data.length};
  }),
  invoice_search:(a,ctx)=>guarded(ctx,async s=>{
    const found=await s.invoices.search(search(a));
    if(!Array.isArray(found?.data))throw new TypeError('Invoice search unavailable');
    return {data:found.data.map(v=>safeInvoice(v,ctx?.connection?.mode)),
      has_more:found.has_more===true,
      next:found.next_page??null};
  }),
  invoice_list_payments:(a,ctx)=>guarded(ctx,async s=>{
    const invoiceId=checkId(a?.invoiceId,'in');
    const invoice=await s.invoices.retrieve(invoiceId);
    if(invoice?.object!=='invoice')throw new TypeError('Invoice not verified');
    const mode=ctx?.connection?.mode;
    if(['test','live'].includes(mode))assertAccountResourceMode(invoice,mode);
    return pageResult(await s.invoicePayments.list({
      invoice:invoiceId,...paging(a)
    }),p=>invoicePaymentSafe(p,invoiceId,mode));
  }),
  invoice_preview:(a,ctx)=>guarded(ctx,async s=>{
    const customerId=checkId(a?.customerId,'cus');
    const c=await s.customers.retrieve(customerId);
    if(c?.deleted||!c?.metadata)throw new TypeError('Verified customer required');
    const mode=ctx?.connection?.mode;
    if(['test','live'].includes(mode))assertAccountResourceMode(c,mode);
    const v=await s.invoices.createPreview({customer:customerId,currency:'usd'});
    positiveTotal(v);
    return invoicePreviewReadSafe(v,customerId,mode);
  })
};
