// Only simple, explicitly controlled, unfinalized invoice accounting can be
// projected additively. Tax/credit/discount systems need provider-side previews.
import {ref} from './billing-shared.js';
const safeAmount=(n)=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const empty=x=>x===undefined||x===null||x===false||
  (Array.isArray(x)&&x.length===0);
const hasMoney=n=>n!==undefined&&n!==null&&n!==0;
export function assertManualDraftAccounting(invoice){
  if(invoice.status!=='draft'||invoice.auto_advance!==false)
    throw new TypeError('Only owner-controlled unfinalized invoice accounting is editable');
  if(invoice.automatic_tax?.enabled===true)
    throw new TypeError('Automatic tax changes require the Stripe Dashboard');
  if(!empty(invoice.discounts)||!empty(invoice.total_discount_amounts)||
    !empty(invoice.total_tax_amounts)||!empty(invoice.default_tax_rates))
    throw new TypeError('Discounts and taxes require full Stripe invoice recalculation');
  if(hasMoney(invoice.tax)||hasMoney(invoice.tax_exempt)||hasMoney(invoice.starting_balance)||
    hasMoney(invoice.ending_balance)||hasMoney(invoice.pre_payment_credit_notes_amount)||
    hasMoney(invoice.post_payment_credit_notes_amount))
    throw new TypeError('Prior customer balances or credits require provider adjustment');
  if(invoice.shipping_cost&&hasMoney(invoice.shipping_cost.amount_total))
    throw new TypeError('Shipping fees require provider tax and total recalculation');
  if(invoice.application_fee_amount||invoice.transfer_data||invoice.on_behalf_of||
    invoice.account_tax_ids?.length)
    throw new TypeError('Connect and custom tax invoices are not simple drafts');
  if(!safeAmount(invoice.amount_due)||!safeAmount(invoice.total)||
    invoice.total!==invoice.amount_due||
    (invoice.subtotal!==undefined&&invoice.subtotal!==invoice.total))
    throw new TypeError('Provider invoice total cannot be safely projected');
  if(invoice.lines?.has_more===true)
    throw new TypeError('Unknown additional invoice lines; reopen in Stripe Dashboard');
  for(const line of invoice.lines?.data??[]){
    if(line.proration||line.discount_amounts?.length||line.tax_amounts?.length||
      line.tax_rates?.length||line.discounts?.length||line.subscription||
      (line.parent?.subscription_item_details!=null))
      throw new TypeError('Invoice contains subscription or adjusted lines');
    if(line.currency&&line.currency!=='usd')
      throw new TypeError('Only USD invoice lines are supported');
    if(!safeAmount(line.amount))
      throw new TypeError('Negative or unverified draft credits are unsupported');
  }
  return invoice;
}
export function validateItemFamily(item,invoice){
  if(item.invoice&&ref(item.invoice)!==invoice.id)
    throw new TypeError('Invoice item belongs to another draft');
  if(item.discountable===true&&invoice.discounts?.length)
    throw new TypeError('Discountable invoice item requires recalculated provider total');
  if(item.tax_rates?.length||item.discounts?.length||
    item.period?.end<item.period?.start)
    throw new TypeError('Invoice item has unsupported tax, discount or service period');
  if(item.price&&item.price.currency&&item.price.currency!=='usd')
    throw new TypeError('Invoice item price currency disagrees with invoice');
  if(item.amount_decimal!==undefined&&
    (!Number.isFinite(Number(item.amount_decimal))||
      Number(item.amount_decimal)!==item.amount))
    throw new TypeError('Fractional cents cannot be safely projected');
  return item;
}
export function validateDraftMutation(current,proposed){
  if(!safeAmount(current)||!safeAmount(proposed))
    throw new TypeError('Invalid USD draft arithmetic');
  const variation=proposed-current;
  if(!Number.isSafeInteger(variation)||Math.abs(variation)>100000000)
    throw new TypeError('Draft mutation is outside safe monetary bounds');
  return {variationCents:variation,previousCents:current,proposedCents:proposed,
    charged:false,finalized:false,ownerCreditRequired:false};
}
export function assertReadbackItemCustomer(item,invoice){
  if(!item||ref(item.customer)!==ref(invoice.customer)||
    ref(item.invoice)!==invoice.id)
    throw new TypeError('Invoice item is not bound to the verified customer');
  if(item.currency!=='usd'||!safeAmount(item.amount))
    throw new TypeError('Provider item amount could not be read back');
  return true;
}
