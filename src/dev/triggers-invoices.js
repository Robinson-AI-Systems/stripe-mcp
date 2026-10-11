// Real TEST invoice events: zero-value draft, explicit finalization or update.
// Never invoice, email or debit a real customer. The run owns every source.
export const invoiceEventTypes=Object.freeze([
  'invoice.created','invoice.updated','invoice.finalized'
]);
export const isInvoiceEvent=x=>invoiceEventTypes.includes(x);
const ref=x=>typeof x==='string'?x:x?.id;
const fail=x=>{throw new TypeError(x);};
function invoiceIdentity(plan,invoice,customer){
  return invoice?.object==='invoice'&&invoice.livemode!==true&&
    invoice.metadata?.rtc_run===plan.runId&&
    ref(invoice.customer)===customer&&invoice.currency==='usd'&&
    invoice.amount_due===0&&invoice.amount_paid===0;
}
export function verifyInvoiceFixture(plan,invoice,byStep){
  if(!invoiceIdentity(plan,invoice,byStep.get('customer_1')?.object_id))
    fail('Stripe TEST zero-value invoice ownership or totals differ');
  if(plan.type==='invoice.created'&&invoice.status!=='draft')
    fail('Only a synthetic draft may generate invoice.created');
  if(plan.type==='invoice.updated'&&invoice.status!=='draft')
    fail('Only an unfinalized synthetic draft may be updated');
  if(plan.type==='invoice.finalized'&&
    !['draft','open','paid'].includes(invoice.status))
    fail('Unexpected TEST invoice finalization state');
}
export function matchesInvoiceEvent(plan,object,target){
  if(!isInvoiceEvent(plan.type))return true;
  if(!invoiceIdentity(plan,object,target.customer))return false;
  switch(plan.type){
    case 'invoice.created':return object.status==='draft';
    case 'invoice.updated':return object.status==='draft'&&
      object.description==='RTC TEST Event Updated Invoice';
    case 'invoice.finalized':return ['open','paid'].includes(object.status);
    default:return false;
  }
}
export async function mutateInvoiceForEvent(s,plan,source,rootKey){
  if(!isInvoiceEvent(plan.type)||plan.type==='invoice.created')return;
  if(!source?.id||source.object!=='invoice'||source.livemode===true||
    source.metadata?.rtc_run!==plan.runId||
    source.amount_due!==0||source.amount_paid!==0)
    fail('Synthetic TEST invoice provenance or zero total not verified');
  const opts={idempotencyKey:rootKey+'_invoice_action'};
  let result;
  if(plan.type==='invoice.updated'){
    if(source.status!=='draft')
      fail('Only a synthetic draft can emit this invoice update');
    if(source.description==='RTC TEST Event Updated Invoice')return;
    result=await s.invoices.update(source.id,{
      description:'RTC TEST Event Updated Invoice'},opts);
  }else{
    if(['open','paid'].includes(source.status))return;
    if(source.status!=='draft')fail('Cannot finalize unexpected invoice state');
    result=await s.invoices.finalizeInvoice(source.id,{
      auto_advance:false},opts);
  }
  if(result?.object!=='invoice'||result.id!==source.id||
    result.livemode===true)
    fail('Stripe did not acknowledge the precise TEST invoice event action');
}
export function ensureInvoiceMutation(plan,invoice){
  if(!isInvoiceEvent(plan.type))return;
  if(plan.type==='invoice.updated'&&
    invoice.description!=='RTC TEST Event Updated Invoice')
    fail('Stripe TEST invoice updated state has not independently verified');
  if(plan.type==='invoice.finalized'&&
    !['open','paid'].includes(invoice.status))
    fail('Stripe TEST invoice did not independently finalize');
}
