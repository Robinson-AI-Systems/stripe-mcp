// D-5 TEST invoice draft invariants. Never take provider write authority from caller data.
import {APP_METADATA_KEYS} from './app-guard.js';
import {ref,checkId,positiveTotal} from './billing-shared.js';
const methods=new Set(['charge_automatically','send_invoice']);
const allStatus=new Set(['draft','open','paid','void','uncollectible']);
export const invoiceText=max=>({type:'string',minLength:1,maxLength:max});
export const invoiceCents={type:'integer',minimum:1,maximum:100000000};
export const daysDue={type:'integer',minimum:1,maximum:90};
export const invoiceMethod={type:'string',enum:[...methods]};
export function verifiedCustomer(c){
  if(!c||c.deleted||!/^cus_[A-Za-z0-9]{2,100}$/.test(c.id??'')||
    !c.metadata||typeof c.metadata!=='object')
    throw new TypeError('Complete TEST customer metadata required');
  return c;
}
export function verifiedDraft(i){
  if(!i||i.deleted||i.object!=='invoice'||!allStatus.has(i.status)||
    i.status!=='draft'||i.currency!=='usd'||!methods.has(i.collection_method)||
    !/^in_[A-Za-z0-9]{2,100}$/.test(i.id??'')||
    !/^cus_[A-Za-z0-9]{2,100}$/.test(ref(i.customer)??''))
    throw new TypeError('Complete editable USD draft invoice required');
  if(i.auto_advance!==false)
    throw new TypeError('Automated invoice advancement must be turned off');
  if(i.subscription||i.subscription_details||i.parent?.subscription_details)
    throw new TypeError('Subscription-owned invoices must be edited in their application');
  if(!Number.isSafeInteger(i.total)||i.total<0||i.total>100000000||
    !Number.isSafeInteger(i.amount_due)||i.amount_due<0||i.amount_due>100000000)
    throw new TypeError('Draft amounts must be verified positive USD cents');
  if(i.lines?.has_more===true)
    throw new TypeError('Draft has unverified additional line items');
  return i;
}
export function verifiedInvoiceItem(item,invoice){
  if(!item||item.deleted||item.object!=='invoiceitem'||
    !/^ii_[A-Za-z0-9]{2,100}$/.test(item.id??'')||
    ref(item.invoice)!==invoice.id||ref(item.customer)!==ref(invoice.customer)||
    item.currency!=='usd'||!Number.isSafeInteger(item.amount)||item.amount<=0)
    throw new TypeError('Only verified positive USD draft invoice items may be changed');
  if(item.subscription||item.proration||
    Object.keys(item.metadata??{}).some(k=>APP_METADATA_KEYS.includes(k)))
    throw new TypeError('Subscription or app-owned invoice items cannot be changed');
  return item;
}
export function verifyInvoiceResult(b,after,a,name){
  if(!after||after.object!=='invoice')return false;
  if(name==='invoice_create_draft')
    return after.id===b._createdId&&after.status==='draft'&&
      ref(after.customer)===b.id&&after.currency==='usd'&&
      after.collection_method===a.collectionMethod&&after.auto_advance===false&&
      after.total===0;
  if(after.id!==b.id||after.status!=='draft'||after.currency!=='usd'||
    after.auto_advance!==false)return false;
  if(name==='invoice_update_draft')
    return (a.description===undefined||after.description===a.description)&&
      (a.footer===undefined||after.footer===a.footer)&&
      (a.metadata===undefined||Object.entries(a.metadata).every(([k,v])=>
        after.metadata?.[k]===v));
  return false;
}
export function verifyInvoiceLineResult(b,after,a,name){
  if(name==='invoice_remove_line')return Array.isArray(after?.data)&&
    after.has_more===false&&after.data.every(x=>x.id!==a.lineItemId);
  if(!after||after.object!=='invoiceitem'||after.currency!=='usd'||
    ref(after.invoice)!==b.id||ref(after.customer)!==ref(b.customer))
    return false;
  if(name==='invoice_add_line')return after.id===b._createdId&&
    after.amount===a.amountCents&&after.description===a.description;
  if(name==='invoice_update_line')return after.id===a.lineItemId&&
    (a.amountCents===undefined||after.amount===a.amountCents)&&
    (a.description===undefined||after.description===a.description);
  return false;
}
export function draftPreview(b,a,name){
  const old=positiveTotal({...b,total:b.total??0,currency:'usd'});
  if(name==='invoice_create_draft')return {beforeCents:0,afterCents:0,
    explanation:'New empty manual draft; no payment is attempted'};
  if(name==='invoice_update_draft')return {beforeCents:old,afterCents:old,
    explanation:'Non-financial draft text/metadata update; no payment'};
  const delta=name==='invoice_add_line'?a.amountCents:
    name==='invoice_remove_line'?-b._item.amount:
      a.amountCents===undefined?0:a.amountCents-b._item.amount;
  if(!Number.isSafeInteger(delta)||old+delta<0||old+delta>100000000)
    throw new TypeError('Draft total would be invalid USD cents');
  return {beforeCents:old,afterCents:old+delta,
    explanation:'Proposed TEST draft amount, not a finalized or charged invoice'};
}
