// The authenticated connection selects exactly one profile. A caller-supplied
// tool name or tool arguments must never widen the profile's permissions.
export const CONNECTION_PROFILES=Object.freeze(['read_only','everyday','full']);
export function isToolAllowed(tool, profile, {allowWrites=false}={}) {
  return !!tool && typeof tool.name==='string' &&
    CONNECTION_PROFILES.includes(profile) && Array.isArray(tool.profiles) &&
    tool.profiles.includes(profile) && (tool.writes===false ||
      (allowWrites===true && profile!=='read_only' && tool.writes===true));
}
export function visibleTools(registry,profile,options={}) {
  if (!Array.isArray(registry?.tools)) return [];
  return registry.tools.filter(tool=>isToolAllowed(tool,profile,options));
}
export function profileCounts(registry,options={}) {
  return Object.fromEntries(CONNECTION_PROFILES.map(profile=>
    [profile,visibleTools(registry,profile,options).length]));
}
// Existing native TEST writers from these areas all declare the original
// defineWrite contract. Their own provider/owner/app/financial checks remain.
const guardedTestAreas=new Set(['customers','payments','checkout','billing','developer',
  'disputes','risk','identity','money','webhooks','account','branding','catalog','reports',
  // 'invoices' joined under owner-obedience V2 family 4 (Invoices &
  // credit notes): the area was in NEITHER set, so all 14 tools were
  // unreachable through every guarded door in both modes; the family's
  // own card wires the dead family up in TEST as well as LIVE.
  // 'files' joined under owner-obedience V2 family 9 (Files): the
  // area was in NEITHER set, so both file writes were unreachable
  // through every guarded door in both modes; the family's own card
  // wires the dead family up in TEST as well as LIVE.
  'invoices','files']);
// Do not silently mark newly surfaced TEST-only operations as LIVE-ready.
// 'money' joined under owner-obedience V2 family 1 (Money): the payout
// operations and the payout schedule complete the full confirmed-action
// sequence in LIVE; the synthetic top-up fixture does not (see the name
// exclusion in isGuardedLiveWrite).
// 'invoices' joined under owner-obedience V2 family 4: draft, lifecycle
// and credit-note operations complete the full confirmed-action sequence
// in LIVE; the money operations keep rows 20-21 exactly (exact owner
// approval, shared daily cap with its second override).
// 'files' joined under owner-obedience V2 family 9: the evidence import
// and the brand-asset file link complete the full confirmed-action
// sequence in LIVE; the import's public-source, type and size bounds
// and the link's brand-asset scope guard stay exactly as built.
const guardedLiveAreas=new Set(['payments','checkout','billing','developer','disputes','risk','identity','money','invoices','files']);
// Exact original customer lifecycle names whose LIVE provider-mode, app
// ownership and independent readback guards have been reviewed. Monetary
// balance credits/debits are NOT covered by this nonmoney authorization.
const guardedLiveCustomerWrites=new Set([
  'customer_create','customer_update','customer_delete',
  'customer_remove_payment_method','customer_set_default_payment_method',
  'customer_add_tax_id','customer_delete_tax_id','customer_remove_discount'
]);
// These account writes have reviewed LIVE account/balance and result-mode proof;
// other legacy account writes remain TEST-only until separately implemented.
const guardedLiveCatalogWrites=new Set([
  'product_create','product_update','product_archive','product_unarchive',
  'product_delete','price_create','price_update',
  // E-2 writes have selected-owner Stripe mode, app guard and readback proof.
  'coupon_create','coupon_update','coupon_delete','promo_create','promo_update',
  'feature_create','feature_attach_to_product','feature_detach_from_product',
  'taxrate_create','taxrate_update',
  // E-3 uses original owner-mode, credit money, event and provider verification guards.
  'meter_create','meter_update','meter_deactivate','meter_reactivate',
  'meter_record_usage','alert_create','alert_activate','alert_deactivate',
  'alert_archive','credit_create_grant','credit_void_grant',
  'tax_update_settings','tax_add_registration','tax_end_registration',
  'tax_record_transaction','tax_reverse_transaction',
  'quote_create','quote_update','quote_finalize','quote_accept','quote_cancel'
]);
const guardedLiveWebhookWrites=new Set([
  'webhook_create','webhook_add_events','webhook_remove_events',
  'webhook_update','webhook_delete'
]);
const guardedLiveAccountWrites=new Set([
  'account_update_payment_method_settings','account_add_apple_pay_domain'
]);
// The payout schedule decides when money leaves the account, so its
// admission converted with the Money family (owner-obedience V2 family 1,
// coordinator ruling 6) even though this exposure sits in the branding
// area; the rest of the branding area converts with its own family.
const guardedLiveBrandingWrites=new Set([
  'setup_set_payout_schedule'
]);
// An entire workflow can delegate multiple original protected native writes.
// Expose only these audited original whole-job operations to the independently
// authenticated TEST full owner profile through stripe_call; never everyday,
// read_only, LIVE, nested bulk calls or arbitrary future workflow names.
const fullOwnerWorkflowWrites=new Set([
  'workflow_refund_customer','workflow_cancel_customer','workflow_change_plan',
  'workflow_dispute_kit_save','workflow_webhook_health_fix',
  'workflow_month_end_report','workflow_set_up_catalog','workflow_brand_business'
]);
export function isGuardedTestWrite(tool,connection){
  return connection?.mode==='test'&&tool?.writes===true&&
    tool?.writeContract==='defineWrite-v1'&&
    (guardedTestAreas.has(tool.area)||
      (tool.area==='server'&&tool.name==='stripe_undo_change')||
      (tool.area==='workflows'&&connection?.profile==='full'&&
        fullOwnerWorkflowWrites.has(tool.name))||
      (tool.area==='universal'&&connection?.profile==='full'&&tool.name==='api_write'))&&
    isToolAllowed(tool,connection?.profile,{allowWrites:true});
}
// Only the owner's own LIVE-consented OAuth connection, or an
// independently activated LIVE pass with two-step owner write consent,
// may access original native defineWrite operations. Actual money-out
// still needs the one-time exact transaction owner approval in the
// shared atomic SQL guard, and — for a delegated pass — a positive
// owner-selected pass ceiling as well.
export function isGuardedLiveWrite(tool,connection){
  const financial=tool?.money===true||tool?.moneySpec==='provider-derived';
  const funded=Number.isSafeInteger(connection?.moneyLimitCents)&&
    connection.moneyLimitCents>0;
  // Coordinator ruling 1(b) (2026-11-03, owner-obedience V2): on the
  // owner's own OAuth connection the funded term is satisfied by the
  // owner's identity. That connection is the one built from the owner's
  // OAuth token record (src/core/mcp-auth.js and its K-3 mirror) — the
  // only connection kind that carries a resolved grant context, which
  // at LIVE is always 'customer' (developer context is refused for
  // LIVE before a connection exists). Delegated RTC pass connections
  // (src/core/rtc-http.js) carry no context and keep the funded term
  // exactly: a pass with moneyLimitCents 0 still cannot move money.
  // Rows 20-22 are untouched either way: every money-out still needs
  // the exact per-transaction owner approval and counts against the
  // shared daily cap with its second override.
  const ownerOwnConnection=connection?.context==='customer';
  return connection?.mode==='live'&&connection?.rtcLiveOwnerApproved===true&&
    // Original provider-generated synthetic TEST Event recovery has no
    // legitimate LIVE equivalent: never advertise it via the generic door.
    tool?.name!=='dev_reconcile_original_event'&&
    // The top-up tools are a synthetic TEST fixture by design ("never
    // use an unverified real bank"); there is no real-bank LIVE top-up
    // to convert (coordinator ruling 2), so their LIVE admission stays
    // exactly as it was — refused here and at their handler.
    tool?.name!=='money_create_topup'&&tool?.name!=='money_cancel_topup'&&
    tool?.writes===true&&tool?.writeContract==='defineWrite-v1'&&
    (guardedLiveAreas.has(tool.area)||
      (tool.area==='server'&&tool.name==='stripe_undo_change')||
      (tool.area==='customers'&&guardedLiveCustomerWrites.has(tool.name))||
      (tool.area==='account'&&guardedLiveAccountWrites.has(tool.name))||
      (tool.area==='branding'&&guardedLiveBrandingWrites.has(tool.name))||
      (tool.area==='webhooks'&&guardedLiveWebhookWrites.has(tool.name))||
      (tool.area==='catalog'&&guardedLiveCatalogWrites.has(tool.name))||
      (tool.area==='workflows'&&connection?.profile==='full'&&
        fullOwnerWorkflowWrites.has(tool.name))||
      (tool.area==='universal'&&connection?.profile==='full'&&tool.name==='api_write'))&&
    (!financial||funded||ownerOwnConnection)&&
    isToolAllowed(tool,connection?.profile,{allowWrites:true});
}
const compactNames=new Set(['stripe_whoami','stripe_search_tools',
  'stripe_describe_tool','stripe_call','stripe_batch','stripe_get_result']);
export function listingForConnection(registry,connection,override){
  // Listing cannot change the account, profile or read/write eligibility.
  const mode=['compact','catalog'].includes(override)?override:connection?.listing;
  const available=visibleTools(registry,connection?.profile,
    {allowWrites:connection?.mode==='test'||
      connection?.rtcLiveOwnerApproved===true}).filter(t=>t.writes===false||
      isGuardedTestWrite(t,connection)||isGuardedLiveWrite(t,connection));
  return mode==='compact'?available.filter(t=>compactNames.has(t.name)||
    t.name==='api_search'||t.name.startsWith('workflow_')):available;
}
export function publicToolInfo(tool) {
  const {writes:_writes,profiles:_profiles,area:_area,
    detailFieldsSupported:_detailFieldsSupported,...rest}=tool;
  const schema=rest.inputSchema||{type:'object',properties:{},additionalProperties:false};
  const properties={...schema.properties};
  // Keep legacy specialist shapes unchanged. Generic read tools gain the
  // standard detail and dotted-field controls without hand-editing each tool.
  // Workflow readers intentionally have strict, task-specific inputs.
  // Do not advertise phantom detail/fields arguments that their original
  // validator rejects; keep universal controls on native readers only.
  if(tool.writes===false&&tool.detailFieldsSupported!==false&&
    !tool.name.startsWith('workflow_')&&
    !tool.name.startsWith('api_')){
    if(!Object.hasOwn(properties,'detail'))properties.detail={
      type:'string',enum:['summary','full']};
    if(!Object.hasOwn(properties,'fields'))properties.fields={
      type:'string',maxLength:600};
  }
  return {...rest,inputSchema:{...schema,properties},
    annotations:{...rest.annotations,readOnlyHint:tool.writes===false,
      destructiveHint:tool.writes===true ? rest.annotations?.destructiveHint!==false : false,
      idempotentHint:tool.writes===false}};
}
