// Real TEST invoice.payment_failed from one tracked synthetic invoice item,
// an explicit non-auto finalization and a deliberately declined collection.
// Never claim an Event from a card error or a failed response alone.
const fail=x=>{throw new TypeError(x);};
const ref=x=>typeof x==='string'?x:x?.id;
export const invoiceFailureTypes=Object.freeze(['invoice.payment_failed']);
export const isInvoiceFailureEvent=x=>invoiceFailureTypes.includes(x);
export function verifyFailedInvoiceSource(plan,invoice,rows,attempted=false){
  if(!isInvoiceFailureEvent(plan.type))return;
  if(invoice?.object!=='invoice'||invoice.livemode===true||
    invoice.metadata?.rtc_run!==plan.runId||
    ref(invoice.customer)!==rows.get('customer_1')?.object_id||
    invoice.currency!=='usd'||invoice.amount_paid!==0||
    !['draft','open'].includes(invoice.status))
    fail('Stripe TEST invoice identity, amount or lifecycle differs');
  if(attempted&&(
    invoice.status!=='open'||invoice.amount_due!==3600||
    invoice.amount_remaining!==3600||invoice.attempted!==true||
    !Number.isInteger(invoice.attempt_count)||invoice.attempt_count<1))
    fail('Failed TEST invoice payment attempt was not independently verified');
}
export function verifyFailedInvoiceItem(plan,item,rows){
  if(item?.object!=='invoiceitem'||item.livemode===true||
    item.metadata?.rtc_run!==plan.runId||
    ref(item.invoice)!==rows.get('invoice_1')?.object_id||
    ref(item.customer)!==rows.get('customer_1')?.object_id||
    item.currency!=='usd'||item.amount!==3600)
    fail('Stripe TEST invoice line provenance, positive amount or invoice differs');
}
export function matchesInvoiceFailureEvent(plan,object,target){
  if(!isInvoiceFailureEvent(plan.type))return true;
  try{
    verifyFailedInvoiceSource(plan,object,new Map([
      ['customer_1',{object_id:target.customer}]
    ]),true);
    return object.id===target.id;
  }catch{return false;}
}
export async function ensureFailedInvoicePayment(s,plan,rows,rootKey){
  if(!isInvoiceFailureEvent(plan.type))return;
  const invoiceId=rows.get('invoice_1')?.object_id;
  const itemId=rows.get('invoice_item_1')?.object_id;
  if(!invoiceId||!itemId)fail('Recorded TEST invoice and invoice line required');
  const item=await s.invoiceItems.retrieve(itemId);
  verifyFailedInvoiceItem(plan,item,rows);
  let invoice=await s.invoices.retrieve(invoiceId);
  verifyFailedInvoiceSource(plan,invoice,rows);
  if(invoice.status==='draft'){
    const response=await s.invoices.finalizeInvoice(invoiceId,{
      auto_advance:false
    },{idempotencyKey:rootKey+'_failure_invoice_finalize'});
    if(response?.id!==invoiceId||response.object!=='invoice'||
      response.livemode===true)
      fail('Stripe did not acknowledge precise TEST invoice finalization');
    invoice=await s.invoices.retrieve(invoiceId);
    verifyFailedInvoiceSource(plan,invoice,rows);
  }
  if(invoice.status!=='open'||invoice.amount_due!==3600||
    invoice.amount_remaining!==3600||invoice.amount_paid!==0)
    fail('Cannot collect an unexpected TEST invoice total/status');
  if(invoice.attempted!==true||!Number.isInteger(invoice.attempt_count)||
    invoice.attempt_count<1){
    try{
      const result=await s.invoices.pay(invoiceId,{
        payment_method:'pm_card_chargeCustomerFail'
      },{idempotencyKey:rootKey+'_failure_invoice_pay'});
      if(result?.object!=='invoice'||result.id!==invoiceId||
        result.livemode===true)
        fail('Stripe did not acknowledge exact TEST invoice collection attempt');
    }catch(error){
      if(error?.code!=='card_declined')throw error;
    }
  }
  const after=await s.invoices.retrieve(invoiceId);
  verifyFailedInvoiceSource(plan,after,rows,true);
}
