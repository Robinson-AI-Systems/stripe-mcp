// D-5b native TEST invoice lifecycle invariants, all from Stripe read-back.
import {ref,checkId} from './billing-shared.js';
import {verifiedDraft} from './invoice-draft-shared.js';

const statuses=new Set(['draft','open','paid','void','uncollectible']);
const methods=new Set(['send_invoice','charge_automatically']);
const cents=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;

export function verifiedLifecycleInvoice(i) {
  if(!i||i.object!=='invoice'||i.deleted||
    !/^in_[A-Za-z0-9]{2,100}$/.test(i.id??'')||
    !/^cus_[A-Za-z0-9]{2,100}$/.test(ref(i.customer)??'')||
    !statuses.has(i.status)||!methods.has(i.collection_method)||
    i.currency!=='usd'||i.auto_advance!==false||
    !cents(i.total)||!cents(i.amount_due)||!cents(i.amount_remaining)||
    !cents(i.amount_paid??0))
    throw new TypeError('Complete manual TEST USD invoice required; automatic collection must be off');
  if(i.subscription||i.subscription_details||i.parent?.subscription_details)
    throw new TypeError('Application subscription invoice must be handled by its owner');
  if(i.amount_remaining>i.total||i.amount_paid>i.total)
    throw new TypeError('Inconsistent Stripe invoice balances');
  return i;
}

export function verifyLifecycleTransition(name,b,after,receipt) {
  if(name==='invoice_delete_draft')
    return after?.missing===true&&after.id===b.id&&
      receipt?.object==='invoice'&&receipt.id===b.id&&receipt.deleted===true;
  if(!after||after.object!=='invoice'||after.id!==b.id||
    ref(after.customer)!==ref(b.customer)||after.currency!=='usd')return false;
  switch(name){
    case 'invoice_finalize':
      return after.status==='open'&&after.auto_advance===false&&
        after.total===b.total&&after.amount_due===b.amount_due&&
        Number.isSafeInteger(after.status_transitions?.finalized_at);
    case 'invoice_send':
      // TEST mode generates invoice.sent but sends no email. Provider acceptance
      // plus independent read verifies request, not real-world delivery.
      return receipt?.object==='invoice'&&receipt.id===b.id&&
        receipt.status==='open'&&after.status==='open'&&
        after.auto_advance===false;
    case 'invoice_charge_now':
      return after.status==='paid'&&after.paid===true&&
        after.amount_remaining===0&&after.amount_paid>=b.amount_remaining;
    case 'invoice_mark_paid_outside_stripe':
      return after.status==='paid'&&after.paid_out_of_band===true&&
        after.amount_remaining===0&&after.amount_paid>=b.amount_remaining;
    case 'invoice_void':
      return after.status==='void'&&
        Number.isSafeInteger(after.status_transitions?.voided_at);
    case 'invoice_mark_uncollectible':
      return after.status==='uncollectible'&&
        Number.isSafeInteger(after.status_transitions?.marked_uncollectible_at);
    default: return false;
  }
}

export async function lifecyclePreflight(name,a,s) {
  const b=verifiedLifecycleInvoice(await s.invoices.retrieve(checkId(a.invoiceId,'in')));
  const draft=name==='invoice_delete_draft'||name==='invoice_finalize';
  if(draft&&b.status!=='draft')
    throw new TypeError('Only a manual draft invoice can be deleted or finalized');
  if(!draft&&b.status!=='open')
    throw new TypeError('Only an open invoice can be sent, paid, voided or written off');
  if(draft)verifiedDraft(b); // verifies additive accounting, no hidden credits
  if(name==='invoice_send') {
    if(b.collection_method!=='send_invoice'||!b.hosted_invoice_url)
      throw new TypeError('Send requires a finalized manual email-payment invoice');
    const customer=await s.customers.retrieve(ref(b.customer));
    if(customer?.deleted||!customer?.metadata||
      typeof customer.email!=='string'||!customer.email.includes('@'))
      throw new TypeError('Verified invoice customer email required');
  }
  if(name==='invoice_charge_now'){
    if(b.collection_method!=='charge_automatically'||b.amount_remaining<1)
      throw new TypeError('Charge requires a positive, open automatic-collection invoice');
    const customer=await s.customers.retrieve(ref(b.customer));
    if(customer?.deleted||!customer?.metadata)
      throw new TypeError('Verified invoice customer required');
    const method=ref(b.default_payment_method)||
      ref(customer.invoice_settings?.default_payment_method);
    if(!method)throw new TypeError('A saved default customer payment method is required');
    const payment=await s.paymentMethods.retrieve(checkId(method,'pm'));
    if(ref(payment.customer)!==customer.id)
      throw new TypeError('Invoice method ownership cannot be verified');
    b._paymentMethod=method;
  }
  if(name==='invoice_mark_paid_outside_stripe'&&b.amount_remaining<1)
    throw new TypeError('A positive unpaid balance is required for external payment');
  if(['invoice_void','invoice_mark_uncollectible'].includes(name)&&
    (b.amount_paid!==0||b.post_payment_credit_notes_amount>0))
    throw new TypeError('Invoices with partial payments or credits require manual accounting review');
  if(name==='invoice_finalize'&&b.collection_method==='charge_automatically'&&
    b.amount_due===0)
    throw new TypeError('Automatic-collection draft without payable balance needs review');
  return b;
}
export function lifecyclePreview(name,b) {
  const amount=b.amount_remaining;
  const verb={
    invoice_delete_draft:'Permanently delete unfinalized draft',
    invoice_finalize:'Finalize but explicitly disable automatic collection',
    invoice_send:'Ask Stripe to issue invoice.sent (TEST mode sends no email)',
    invoice_charge_now:'Try a one-time saved-method incoming charge of',
    invoice_mark_paid_outside_stripe:'Record externally received money without a Stripe charge of',
    invoice_void:'Void unpaid open invoice',
    invoice_mark_uncollectible:'Write off unpaid open invoice'
  }[name];
  return 'TEST MODE. '+verb+' invoice '+b.id+
    '; total $'+(b.total/100).toFixed(2)+' USD, remaining $'+(amount/100).toFixed(2)+
    ' USD; customer '+ref(b.customer)+
    '. Confirmation, stable provider idempotency and independent read-back required.'+
    (name==='invoice_send'?' This does NOT deliver a real email in TEST mode.':'');
}
