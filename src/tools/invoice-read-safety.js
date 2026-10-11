// Native invoice read projections never echo raw Stripe provider objects.
import {ref,local} from './billing-shared.js';
function validCents(n){return Number.isSafeInteger(n)&&Math.abs(n)<=100000000;}
export function invoicePaymentSafe(payment,invoiceId){
  const inv=ref(payment?.invoice);
  if(!payment||payment.object!=='invoice_payment'||inv!==invoiceId)
    throw new TypeError('Provider payment is not allocated to the requested invoice');
  if(!validCents(payment.amount_paid)||payment.amount_paid<0||
    !validCents(payment.amount_requested)||payment.amount_requested<0)
    throw new TypeError('Allocated invoice payment amount unavailable');
  if(!['paid','open','canceled'].includes(payment.status))
    throw new TypeError('Unrecognized invoice payment status');
  return {id:payment.id,object:'invoice_payment',invoice:inv,
    amount_paid:payment.amount_paid,amount_requested:payment.amount_requested,
    status:payment.status,paymentIntent:ref(payment.payment?.payment_intent),
    charge:ref(payment.payment?.charge),created_local:local(payment.created)};
}
export function invoicePreviewReadSafe(invoice,customerId){
  if(invoice?.object!=='invoice'||invoice.currency!=='usd'||
    !validCents(invoice.total)||!validCents(invoice.amount_due))
    throw new TypeError('Stripe TEST USD preview unavailable');
  const lines=invoice.lines?.data;
  if(!Array.isArray(lines)||invoice.lines?.has_more===undefined)
    throw new TypeError('Stripe invoice preview lines are incomplete');
  if(lines.some(l=>!validCents(l.amount)||l.currency&&l.currency!=='usd'))
    throw new TypeError('Stripe preview line amount/currency invalid');
  return {customer:customerId,currency:'usd',
    invoiceTotalCents:invoice.total,amountDueCents:invoice.amount_due,
    subtotalCents:validCents(invoice.subtotal)?invoice.subtotal:null,
    totalTaxCents:validCents(invoice.total_taxes?.reduce((n,t)=>n+t.amount,0))?
      invoice.total_taxes.reduce((n,t)=>n+t.amount,0):null,
    lines:lines.slice(0,20).map(l=>({
      id:l.id??null,amountCents:l.amount,description:l.description??null,
      proration:l.parent?.subscription_item_details?.proration===true
    })),hasMore:invoice.lines.has_more||lines.length>20,
    pendingInvoiceItemCount:invoice.pending_invoice_items_count??null,
    status:invoice.status??null,collectionMethod:invoice.collection_method??null};
}
