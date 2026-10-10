// Compact, type-aware views of already redacted Stripe objects.
// Never copy an unlisted object property into the default summary.
const FIELDS=Object.freeze({
  customer:['id','object','name','email','phone','balance','balance_display',
    'currency','created','created_local','metadata','appRecord'],
  charge:['id','object','amount','amount_display','currency','status','paid',
    'refunded','created_local','customer','payment_method_details','appRecord'],
  payment_intent:['id','object','amount','amount_display','currency','status',
    'customer','latest_charge','created_local','appRecord'],
  refund:['id','object','amount','amount_display','currency','status',
    'charge','payment_intent','created_local','appRecord'],
  invoice:['id','object','number','customer','status','amount_due',
    'amount_due_display','amount_paid','amount_paid_display','currency',
    'due_date_local','hosted_invoice_url','created_local','appRecord'],
  subscription:['id','object','customer','status','current_period_end_local',
    'cancel_at_period_end','latest_invoice','created_local','appRecord'],
  payout:['id','object','amount','amount_display','currency','status',
    'arrival_date_local','destination','created_local','appRecord'],
  balance_transaction:['id','object','amount','amount_display','currency',
    'net','net_display','fee','fee_display','type','created_local']
});
const FALLBACK=['id','object','status','currency','amount','amount_display',
  'customer','created_local','appRecord'];
function one(obj){
  if(!obj||typeof obj!=='object'||Array.isArray(obj))return obj;
  if(typeof obj.object!=='string')return obj; // existing small owner/status tools
  const keys=FIELDS[obj.object]||FALLBACK;
  return Object.fromEntries(keys.filter(k=>Object.hasOwn(obj,k)).map(k=>[k,obj[k]]));
}
export function summarizeProvider(value){
  if(Array.isArray(value))return value.map(one);
  if(!value||typeof value!=='object')return value;
  if(Array.isArray(value.data))return {...value,data:value.data.map(one)};
  return one(value);
}
