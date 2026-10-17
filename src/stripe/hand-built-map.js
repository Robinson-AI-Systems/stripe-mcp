// The preferred original native guarded writes ALWAYS win. No universal
// entry point may weaken money-out, customer/app guard, or native readback.
const exact=[
  [/^POST \/v1\/refunds$/, 'payment_create_refund'],
  [/^POST \/v1\/payouts$/, 'money_create_payout'],
  [/^POST \/v1\/transfers$/, 'money_create_transfer'],
  [/^POST \/v1\/payment_intents\/\{[^}]+\}\/capture$/, 'payment_capture'],
  [/^POST \/v1\/payment_intents\/\{[^}]+\}\/confirm$/, 'payment_confirm'],
  [/^POST \/v1\/invoices\/\{[^}]+\}\/pay$/, 'invoice_pay'],
  [/^POST \/v1\/invoices\/\{[^}]+\}\/void$/, 'invoice_void'],
  [/^POST \/v1\/products$/, 'product_create'],
  [/^POST \/v1\/products\/\{[^}]+\}$/, 'product_update'],
  [/^POST \/v1\/prices$/, 'price_create'],
  [/^POST \/v1\/prices\/\{[^}]+\}$/, 'price_update'],
  [/^POST \/v1\/customers$/, 'customer_create'],
  [/^POST \/v1\/customers\/\{[^}]+\}$/, 'customer_update'],
  [/^POST \/v1\/subscriptions\/\{[^}]+\}$/, 'billing_change_plan'],
  [/^POST \/v1\/billing_portal\/configurations\/\{[^}]+\}$/, 'portal_update_configuration'],
  [/^POST \/v1\/checkout\/sessions$/, 'checkout_create_payment_link_for_customer'],
  [/^POST \/v1\/payment_links$/, 'paylink_create'],
  [/^POST \/v1\/webhook_endpoints\/\{[^}]+\}$/, 'webhook_add_events'],
  [/^POST \/v1\/reporting\/report_runs$/, 'report_run']
];
export function preferredNative(record){
  const key=record.method+' '+record.path;
  for(const [pattern,name] of exact)if(pattern.test(key))return name;
  return null;
}
