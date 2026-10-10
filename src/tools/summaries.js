// Compact, type-aware views of already redacted Stripe objects.
// Never copy an unlisted object property into the default summary.
const FIELDS=Object.freeze({
  customer:['id','object','name','email','phone','balance','balance_display',
    'currency','created','created_local','metadata','description',
    'defaultPaymentMethod','defaultPaymentMethodSummary','address','appRecord'],
  payment_method:['id','object','type','customer','brand','last4','expires','bankName'],
  'checkout.session':['id','object','mode','status','paymentStatus','customer',
    'paymentIntent','subscription','amountTotal','currency','url',
    'expiresAt','created_local'],
  payment_link:['id','object','active','url','created_local','metadata'],
  'billing_portal.configuration':['id','object','name','active','isDefault',
    'defaultReturnUrl','features'],
  item:['id','object','description','amountSubtotal','amountTotal','currency',
    'quantity','price'],
  tax_id:['id','object','type','value','verification'],
  customer_balance_transaction:['id','object','amount','currency','type',
    'description','created_local'],
  charge:['id','object','amount','amount_display','currency','status','paid',
    'refunded','amount_refunded','description','outcome','failureCode',
    'disputed','paymentIntent','created_local','customer','appRecord'],
  payment_intent:['id','object','amount','amount_display','currency','status',
    'customer','amount_received','latestCharge','paymentMethod','description',
    'receiptEmail','canceledAt','created_local','appRecord'],
  refund:['id','object','amount','amount_display','currency','status',
    'charge','paymentIntent','reason','created_local','metadata','appRecord'],
  setup_intent:['id','object','status','customer','paymentMethod','usage',
    'cancellationReason','created_local','metadata'],
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
