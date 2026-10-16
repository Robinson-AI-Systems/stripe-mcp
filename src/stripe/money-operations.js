// Financial policy is fail-closed, not a name-only permission list.
// Curated money tools have provider-derived independent daily owner approval.
const actions=/(?:^|[_\s.-])(pay|paying|paid|refund|payout|transfer|capture|confirm|credit|topup|top_up|reversal|send|issue|redeem|authorize|authorization|fund|disburse|settle|collect|balance|treasury|issu)(?:[_\s.-]|$)/i;
const paths=/(?:\/|_)(?:payment_intents|charges|refunds|payouts|transfers|topups|credit_notes|credit_grants|issuing|treasury|financial_connections|outbound_payments|cash_balance|customer_balance|test_helpers)(?:\/|_|$)/i;
const monetaryFields=new Set(['amount','amount_cents','amount_minor','amount_total',
  'currency','source','destination','capture_method','balance','credit_amount',
  'application_fee_amount','unit_amount','tax_amount','amount_off','refund',
  'invoice','payment_intent','charge','payout','payment_method']);
export function financialDecision(r,body={}){
  if(r.method==='GET')return {financial:false};
  if(paths.test(r.path)||actions.test(String(r.summary)+' '+r.id+' '+r.path)||
    Object.keys(body).some(k=>monetaryFields.has(k)))
    return {financial:true,reason:'Financial or unknown money-like Stripe operation requires a curated, independently approved native tool with provider-derived limits'};
  // Conservative fallback: all creates, transfers, sends, deletes and
  // authorizations are money-like until a separately approved classification.
  if(/create|confirm|capture|pay|send|transfer|delete|void|post|finalize|close|issue|cancel|detach|attach/i.test(String(r.summary)+' '+r.id))
    return {financial:true,reason:'Unreviewed irreversible or new Stripe operation classified as money-like'};
  return {financial:false};
}
export function isSafeMetadataUpdate(r,body){
  if(r.method!=='POST'||Object.keys(body).length!==1||
    !Object.hasOwn(body,'metadata'))return false;
  if(!body.metadata||typeof body.metadata!=='object'||Array.isArray(body.metadata)||
    Object.keys(body.metadata).length>20)return false;
  return Object.entries(body.metadata).every(([k,v])=>
    /^[A-Za-z0-9_-]{1,40}$/.test(k)&&!['agreementId','rentalLineId',
      'firstDeliveredOn','__proto__','prototype','constructor'].includes(k)&&
    typeof v==='string'&&v.length<=200);
}
