// No-charge TEST invoice terminal events from recorded positive, never-paid invoices.
// The exact invoice item and original draft are durably owned before finalization.
export const invoiceTerminalEventTypes=Object.freeze([
  'invoice.voided','invoice.marked_uncollectible'
]);
export const isInvoiceTerminalEvent=x=>invoiceTerminalEventTypes.includes(x);
const ref=x=>typeof x==='string'?x:x?.id;
const fail=x=>{throw new TypeError(x);};
export function verifyTerminalInvoice(plan,invoice,rows,{final=false}={}){
  if(!isInvoiceTerminalEvent(plan.type))return;
  const item=rows.get('invoice_item_1');
  if(invoice?.object!=='invoice'||invoice.livemode!==false||
    invoice.metadata?.rtc_run!==plan.runId||
    ref(invoice.customer)!==rows.get('customer_1')?.object_id||
    invoice.currency!=='usd'||invoice.collection_method!=='send_invoice'||
    invoice.amount_paid!==0||
    !['draft','open','void','uncollectible'].includes(invoice.status)||
    (item?invoice.amount_due!==3600:
      ![0,3600].includes(invoice.amount_due)))
    fail('Recorded positive TEST invoice ownership or unpaid amount differs');
  const expected=plan.type==='invoice.voided'?'void':'uncollectible';
  if(final&&(invoice.status!==expected||invoice.amount_due!==3600))
    fail('Original TEST invoice terminal status not independently confirmed');
}
export function verifyTerminalItem(plan,item,rows){
  if(!isInvoiceTerminalEvent(plan.type))return;
  if(item?.object!=='invoiceitem'||item.livemode!==false||
    item.metadata?.rtc_run!==plan.runId||
    ref(item.customer)!==rows.get('customer_1')?.object_id||
    ref(item.invoice)!==rows.get('invoice_1')?.object_id||
    item.amount!==3600||item.currency!=='usd')
    fail('Foreign or incorrect TEST invoice line cannot be finalized');
}
export function matchesTerminalInvoiceEvent(plan,invoice,target){
  if(!isInvoiceTerminalEvent(plan.type))return true;
  try{
    verifyTerminalInvoice(plan,invoice,new Map([
      ['customer_1',{object_id:target.customer}],
      ['invoice_item_1',{object_id:target.invoiceItem??'ii_recorded'}]
    ]),{final:true});
    return invoice.id===target.id;
  }catch{return false;}
}
export async function ensureTerminalInvoiceEvent(s,plan,rows,key){
  if(!isInvoiceTerminalEvent(plan.type))return;
  const invoiceId=rows.get('invoice_1')?.object_id;
  const itemId=rows.get('invoice_item_1')?.object_id;
  if(typeof invoiceId!=='string'||!/^in_[A-Za-z0-9]{2,100}$/.test(invoiceId)||
    typeof itemId!=='string'||!/^ii_[A-Za-z0-9]{2,100}$/.test(itemId))
    fail('Exactly recorded invoice and invoice item required');
  const item=await s.invoiceItems.retrieve(itemId);
  verifyTerminalItem(plan,item,rows);
  let invoice=await s.invoices.retrieve(invoiceId);
  verifyTerminalInvoice(plan,invoice,rows);
  const expected=plan.type==='invoice.voided'?'void':'uncollectible';
  if(invoice.status===expected)return verifyTerminalInvoice(plan,invoice,rows,{final:true});
  if(invoice.status==='draft'){
    const ack=await s.invoices.finalizeInvoice(invoiceId,{auto_advance:false},{
      idempotencyKey:key+'_terminal_finalize'});
    if(ack?.id!==invoiceId||ack.object!=='invoice'||ack.livemode!==false)
      fail('Stripe did not acknowledge exact TEST invoice finalization');
    invoice=await s.invoices.retrieve(invoiceId);
    verifyTerminalInvoice(plan,invoice,rows);
  }
  if(invoice.status!=='open')fail('Cannot replay conflicting TEST invoice state');
  const opts={idempotencyKey:key+'_terminal_state'};
  const ack=plan.type==='invoice.voided'?
    await s.invoices.voidInvoice(invoiceId,{},opts):
    await s.invoices.markUncollectible(invoiceId,{},opts);
  if(ack?.id!==invoiceId||ack.object!=='invoice'||ack.livemode!==false)
    fail('Stripe did not acknowledge exact TEST invoice terminal state');
  verifyTerminalInvoice(plan,await s.invoices.retrieve(invoiceId),rows,
    {final:true});
}
