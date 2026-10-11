// Current native TEST invoice reads and explicit provider preview. All results are safe projections.
import {allProfiles,id,paging,pageResult,guarded,checkId,ref,local,
  positiveTotal} from './billing-shared.js';
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
  def('invoice_list','List TEST invoices with exact amount, currency and customer.',{
    ...page,customerId:id('cus'),status:{type:'string',
      enum:['draft','open','paid','void','uncollectible']}}),
  def('invoice_get','Inspect a TEST invoice, its customer, totals and status.',
    {invoiceId:id('in')},['invoiceId']),
  def('invoice_search','Search TEST invoices with bounded native Stripe search.',{
    query,limit:page.limit,page:{type:'string',minLength:2,maxLength:200}},['query']),
  def('invoice_list_payments','List payments allocated to one TEST invoice.',{
    invoiceId:id('in'),...page},['invoiceId']),
  def('invoice_preview','Preview the next TEST invoice for a verified customer.',{
    customerId:id('cus')},['customerId'])
];
export function safeInvoice(v){
  if(!v||v.object!=='invoice'||typeof v.id!=='string')
    throw new TypeError('Verified Stripe invoice required');
  return {id:v.id,object:'invoice',customer:ref(v.customer),
    status:v.status,number:v.number??null,currency:v.currency,
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
      ...(a?.status?{status:a.status}:{})}),safeInvoice)),
  invoice_get:(a,ctx)=>guarded(ctx,async s=>safeInvoice(
    await s.invoices.retrieve(checkId(a?.invoiceId,'in')))),
  invoice_search:(a,ctx)=>guarded(ctx,async s=>{
    const found=await s.invoices.search(search(a));
    if(!Array.isArray(found?.data))throw new TypeError('Invoice search unavailable');
    return {data:found.data.map(safeInvoice),has_more:found.has_more===true,
      next:found.next_page??null};
  }),
  invoice_list_payments:(a,ctx)=>guarded(ctx,async s=>{
    const invoiceId=checkId(a?.invoiceId,'in');
    const invoice=await s.invoices.retrieve(invoiceId);
    if(invoice?.object!=='invoice')throw new TypeError('Invoice not verified');
    return pageResult(await s.invoicePayments.list({
      invoice:invoiceId,...paging(a)
    }),p=>invoicePaymentSafe(p,invoiceId));
  }),
  invoice_preview:(a,ctx)=>guarded(ctx,async s=>{
    const customerId=checkId(a?.customerId,'cus');
    const c=await s.customers.retrieve(customerId);
    if(c?.deleted||!c?.metadata)throw new TypeError('Verified customer required');
    const v=await s.invoices.createPreview({customer:customerId,currency:'usd'});
    positiveTotal(v);
    return invoicePreviewReadSafe(v,customerId);
  })
};
