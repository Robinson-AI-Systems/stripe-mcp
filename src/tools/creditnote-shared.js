// D-5c Stripe credit notes: provider-verified USD preview and allocation.
import {ref,checkId} from './billing-shared.js';
const reasons=['duplicate','fraudulent','order_change','product_unsatisfactory'];
export const creditReasons={type:'string',enum:reasons};
export const creditAllocation={type:'string',
  enum:['reduce_unpaid','refund','credit_balance']};
export const creditAmount={type:'integer',minimum:1,maximum:100000000};
export const creditMemo={type:'string',minLength:1,maxLength:500};
const cents=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
export const validCreditId=id=>/^cn_[A-Za-z0-9]{2,100}$/.test(id??'');
export function safeCredit(v) {
  if(!v||v.object!=='credit_note'||!validCreditId(v.id)||
    v.currency!=='usd'||!cents(v.amount)||
    !/^in_[A-Za-z0-9]{2,100}$/.test(ref(v.invoice)??'')||
    !/^cus_[A-Za-z0-9]{2,100}$/.test(ref(v.customer)??''))
    throw new TypeError('Verified USD credit note unavailable');
  return {id:v.id,invoice:ref(v.invoice),customer:ref(v.customer),
    currency:'usd',amountCents:v.amount,status:v.status??null,
    number:v.number??null,reason:v.reason??null,
    refundAmountCents:cents(v.refund_amount)?v.refund_amount:null,
    creditAmountCents:cents(v.credit_amount)?v.credit_amount:null,
    outOfBandCents:cents(v.out_of_band_amount)?v.out_of_band_amount:null,
    created:v.created??null,memo:v.memo??null};
}
const allocationAmount=(type,amount)=>({
  ...(type==='refund'?{refund_amount:amount}:{}),
  ...(type==='credit_balance'?{credit_amount:amount}:{})
});
export function creditParams(a){
  if(!reasons.includes(a.reason)||!creditAllocation.enum.includes(a.allocation)||
    !cents(a.amountCents)||a.amountCents===0||
    (a.memo!==undefined&&(typeof a.memo!=='string'||a.memo.length>500||
      !a.memo.length)))throw new TypeError('Invalid credit note reason, allocation or USD cents');
  return {invoice:checkId(a.invoiceId,'in'),amount:a.amountCents,
    reason:a.reason,...allocationAmount(a.allocation,a.amountCents),
    email_type:'none',...(a.memo?{memo:a.memo}:{})};
}
export async function creditPreflight(a,s){
  const i=await s.invoices.retrieve(checkId(a.invoiceId,'in'));
  if(!i||i.object!=='invoice'||i.currency!=='usd'||
    !['open','paid'].includes(i.status)||
    !/^cus_[A-Za-z0-9]{2,100}$/.test(ref(i.customer)??'')||
    !cents(i.total)||!cents(i.amount_remaining)||!cents(i.amount_paid??0)||
    i.subscription||i.subscription_details||i.parent?.subscription_details)
    throw new TypeError('A verified standalone open or paid USD invoice is required');
  if(a.allocation==='reduce_unpaid'){
    if(i.status!=='open'||a.amountCents>i.amount_remaining)
      throw new TypeError('Unpaid invoice credit cannot exceed current unpaid balance');
  }else{
    const earlier=(i.pre_payment_credit_notes_amount??0)+
      (i.post_payment_credit_notes_amount??0);
    if(i.status!=='paid'||!cents(earlier)||a.amountCents>i.amount_paid-earlier)
      throw new TypeError('Refund or customer credit exceeds verified paid remainder');
  }
  const params=creditParams(a);
  // Pinned Stripe SDK method calls GET /v1/credit_notes/preview with these params.
  const preview=await s.creditNotes.preview(params);
  const p=safeCredit(preview);
  if(p.invoice!==i.id||p.customer!==ref(i.customer)||
    p.amountCents!==a.amountCents)
    throw new TypeError('Provider credit note preview changed the amount or target');
  if(p.refundAmountCents===null||p.creditAmountCents===null||
    p.outOfBandCents===null)
    throw new TypeError('Complete Stripe credit allocation is required');
  const refund=a.allocation==='refund'?a.amountCents:0;
  const balance=a.allocation==='credit_balance'?a.amountCents:0;
  if(p.refundAmountCents!==refund||p.creditAmountCents!==balance||
    p.outOfBandCents!==0)
    throw new TypeError('Stripe preview allocation differs from requested credit');
  return {...i,_creditPreview:p,_creditParams:params};
}
export function creditSummary(b,a){
  return 'TEST MODE. Issue a USD '+a.allocation+' credit note for invoice '+b.id+
    ', customer '+ref(b.customer)+', exactly $'+(a.amountCents/100).toFixed(2)+
    '. No customer email. The independent owner must approve this exact credit'+
    ' before Stripe receives a write. Above the shared $500/account/Denver-day'+
    ' limit requires a second separate owner override.';
}
export function creditVerifyIssued(b,after,a,createdId){
  return after?.object==='credit_note'&&after.id===createdId&&
    ref(after.invoice)===b.id&&ref(after.customer)===ref(b.customer)&&
    after.currency==='usd'&&after.status==='issued'&&
    after.amount===a.amountCents&&
    after.refund_amount===b._creditPreview.refundAmountCents&&
    after.credit_amount===b._creditPreview.creditAmountCents&&
    after.out_of_band_amount===0;
}
