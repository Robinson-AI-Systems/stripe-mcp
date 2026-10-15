// W-2: read-only TEST receivables and customer operations in plain language.
// No money write, retry scheduling, hosted-page creation or ownership override.
import {allProfiles,reply,fail} from './billing-shared.js';
import {collect,nativeRead,verifyContext,validCustomer,deadline,
  partial,str,integer} from './workflow-read-common.js';

const customerId={type:'string',pattern:'^cus_[A-Za-z0-9]{2,100}$'};
const definition=(name,description,properties={},required=[])=>({
  name,description,area:'workflows',profiles:allProfiles,writes:false,
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties,required,additionalProperties:false}
});
export const tools=[
  definition('workflow_failed_payments',
    'Find unpaid TEST invoices and failed payments with verified retry facts.',
    {customerId}),
  definition('workflow_customer_overview',
    'Show one TEST customer and verified billing, payment and app record links.',
    {customerId},['customerId'])
];
const reasons={
  card_declined:'The card was declined',insufficient_funds:'Insufficient funds',
  expired_card:'The card has expired',incorrect_cvc:'Incorrect card security code',
  authentication_required:'Customer authentication is required',
  processing_error:'The processor could not complete the payment',
  do_not_honor:'The issuer declined the payment',generic_decline:'The card was declined',
  lost_card:'The reported card cannot be charged',
  stolen_card:'The reported card cannot be charged',
  payment_intent_authentication_failure:'Authentication failed'
};
export function declineReason(payment){
  const code=payment.declineCode??payment.failureCode;
  return code?reasons[code]??'Stripe reported a decline; check the payment in your TEST Dashboard':
    'Payment requires attention; Stripe did not provide a verified decline code';
}
function scope(a,required=false){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>k!=='customerId')||
    (required&&!validCustomer(a.customerId))||
    (a.customerId!==undefined&&!validCustomer(a.customerId)))
    throw new TypeError('Supply only an exact TEST customerId when required');
}
function failure(payment){
  return payment.status==='requires_payment_method'||(
    payment.status==='canceled'&&
    (payment.failureCode!==null&&payment.failureCode!==undefined));
}
function summaryPayment(p){
  return {id:p.id,status:p.status,customer:p.customer??null,amountMinor:p.amount,
    currency:p.currency,description:str(p.description,120),
    reason:declineReason(p),failureCode:str(p.failureCode,60),
    createdAt:p.created_local??null,
    appRecord:p.appRecord??p.appRecordLink??p.recordLink??null};
}
function summaryInvoice(inv){
  return {id:inv.id,status:inv.status,customer:inv.customer,
    amountRemainingMinor:inv.amount_remaining,currency:inv.currency,
    attempts:inv.attemptCount,nextRetryAt:inv.nextPaymentAttemptLocal??null,
    nextRetryUnix:inv.nextPaymentAttemptUnix??null,
    hostedInvoiceUrl:inv.hosted_invoice_url??null,
    appRecord:inv.appRecord??inv.appRecordLink??inv.recordLink??null,
    note:inv.nextPaymentAttemptUnix===null||inv.nextPaymentAttemptUnix===undefined?
      'No provider-confirmed next retry; do not promise an automatic retry':
      'Next retry is the explicit provider scheduled time'};
}
function secureInvoices(invoices){
  return invoices.filter(x=>x.status==='open'&&integer(x.amount_remaining)&&
    x.amount_remaining>0&&integer(x.attemptCount)&&x.attemptCount>0);
}
export async function failedPayments(a,ctx){
  verifyContext(ctx);scope(a);
  const end=deadline(),args={limit:100,...(a.customerId?{customerId:a.customerId}:{})};
  const invoicePages=await collect('invoice_list',args,ctx,{end});
  const paymentPages=await collect('payment_list',
    {limit:100,...(a.customerId?{customer:a.customerId}:{})},ctx,{end});
  const invoices=secureInvoices(invoicePages.data);
  const payments=paymentPages.data.filter(failure);
  const verified=invoices.every(x=>Number.isSafeInteger(x.attemptCount)&&
    (x.nextPaymentAttemptUnix===null||x.nextPaymentAttemptUnix===undefined||
      Number.isSafeInteger(x.nextPaymentAttemptUnix)));
  const complete=invoicePages.complete&&paymentPages.complete&&verified;
  const snapshot=partial([
    {name:'invoices',complete:invoicePages.complete&&verified,
      reason:verified?invoicePages.reason:'invoice_retry_state_unverified'},
    {name:'payments',complete:paymentPages.complete,reason:paymentPages.reason}
  ],end);
  return {kind:'failed_payments',account:ctx.connection.stripeAccount,
    customerId:a.customerId??null,mode:'test',
    complete:complete&&snapshot.complete,
    counts:{unpaidAttemptedInvoices:invoices.length,failedPaymentIntents:payments.length},
    invoices:invoices.slice(0,25).map(summaryInvoice),
    failedPayments:payments.slice(0,25).map(summaryPayment),
    displayTruncated:invoices.length>25||payments.length>25,
    gaps:snapshot.gaps,continuation:snapshot.continuation,
    explanation:'Only attempted, still-open invoices and verified unsuccessful payment intent states are shown. No payment retries or invoice emails are triggered.'};
}
function compactSubscription(v){
  return {id:v.id,status:v.status,currency:v.currency,collectionMethod:v.collectionMethod,
    cancelAtPeriodEnd:v.cancelAtPeriodEnd,
    itemsCount:v.items?.length??null,moreItems:v.moreItems,
    appRecord:v.appRecord??v.recordLink??null};
}
function compactInvoice(v){
  return {id:v.id,status:v.status,currency:v.currency,
    amountDueMinor:v.amount_due,amountRemainingMinor:v.amount_remaining,
    hostedInvoiceUrl:v.hosted_invoice_url??null,
    nextRetryAt:v.nextPaymentAttemptLocal??null};
}
function compactPayment(v){
  return {id:v.id,status:v.status,currency:v.currency,amountMinor:v.amount,
    amountReceivedMinor:v.amount_received,
    failureReason:failure(v)?declineReason(v):null};
}
export async function customerOverview(a,ctx){
  verifyContext(ctx);scope(a,true);
  const end=deadline(),customer=await nativeRead('customer_get',{customerId:a.customerId},ctx);
  if(customer.deleted||customer.id!==a.customerId)
    throw new TypeError('Verified, existing TEST customer required');
  const invoices=await collect('invoice_list',
    {customerId:a.customerId,limit:100},ctx,{end});
  const subscriptions=await collect('billing_list_subscriptions',
    {customer:a.customerId,status:'all',limit:100},ctx,{end});
  const payments=await collect('payment_list',
    {customer:a.customerId,limit:100},ctx,{end});
  const snapshot=partial([
    {name:'customer_invoices',complete:invoices.complete,reason:invoices.reason},
    {name:'customer_subscriptions',complete:subscriptions.complete,reason:subscriptions.reason},
    {name:'customer_payments',complete:payments.complete,reason:payments.reason}
  ],end);
  // The guarded native customer projection contains the already-authorized
  // profile record link. Do not re-derive links from untrusted metadata.
  return {kind:'customer_overview',mode:'test',
    account:ctx.connection.stripeAccount,customer,complete:snapshot.complete,
    counts:{invoices:invoices.data.length,subscriptions:subscriptions.data.length,
      payments:payments.data.length},
    invoices:invoices.data.slice(0,20).map(compactInvoice),
    subscriptions:subscriptions.data.slice(0,20).map(compactSubscription),
    payments:payments.data.slice(0,20).map(compactPayment),
    displayTruncated:[invoices,subscriptions,payments].some(x=>x.data.length>20),
    gaps:snapshot.gaps,continuation:snapshot.continuation,
    explanation:'TEST customer-owned billing records are read-only. App links are copied solely from the guarded existing customer projection; no application catalog or payment state is changed.'};
}
export const handlers={
  workflow_failed_payments:async(a,ctx)=>{
    try{return reply(await failedPayments(a,ctx));}
    catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  },
  workflow_customer_overview:async(a,ctx)=>{
    try{return reply(await customerOverview(a,ctx));}
    catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
