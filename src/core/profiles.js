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
  'disputes','risk','identity','money','webhooks','account','branding','catalog','reports']);
// Do not silently mark newly surfaced TEST-only operations as LIVE-ready.
const guardedLiveAreas=new Set(['customers','payments','checkout','billing','developer','disputes','risk','identity']);
// These account writes have reviewed LIVE account/balance and result-mode proof;
// other legacy account writes remain TEST-only until separately implemented.
const guardedLiveAccountWrites=new Set([
  'account_update_payment_method_settings','account_add_apple_pay_domain'
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
      (tool.area==='workflows'&&connection?.profile==='full'&&
        fullOwnerWorkflowWrites.has(tool.name))||
      (tool.area==='universal'&&connection?.profile==='full'&&tool.name==='api_write'))&&
    isToolAllowed(tool,connection?.profile,{allowWrites:true});
}
// Only an independently activated LIVE pass with two-step owner write
// consent may access original native defineWrite operations. Actual money-out
// still needs positive owner-selected pass ceiling AND another one-time exact
// transaction owner approval in the shared atomic SQL guard.
export function isGuardedLiveWrite(tool,connection){
  const financial=tool?.money===true||tool?.moneySpec==='provider-derived';
  const funded=Number.isSafeInteger(connection?.moneyLimitCents)&&
    connection.moneyLimitCents>0;
  return connection?.mode==='live'&&connection?.rtcLiveOwnerApproved===true&&
    tool?.writes===true&&tool?.writeContract==='defineWrite-v1'&&
    (guardedLiveAreas.has(tool.area)||
      (tool.area==='account'&&guardedLiveAccountWrites.has(tool.name))||
      (tool.area==='workflows'&&connection?.profile==='full'&&
        fullOwnerWorkflowWrites.has(tool.name))||
      (tool.area==='universal'&&connection?.profile==='full'&&tool.name==='api_write'))&&
    (!financial||funded)&&
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
  const {writes:_writes,profiles:_profiles,area:_area,...rest}=tool;
  const schema=rest.inputSchema||{type:'object',properties:{},additionalProperties:false};
  const properties={...schema.properties};
  // Keep legacy specialist shapes unchanged. Generic read tools gain the
  // standard detail and dotted-field controls without hand-editing each tool.
  // Workflow readers intentionally have strict, task-specific inputs.
  // Do not advertise phantom detail/fields arguments that their original
  // validator rejects; keep universal controls on native readers only.
  if(tool.writes===false&&!tool.name.startsWith('workflow_')&&
    !tool.name.startsWith('api_')){
    if(!Object.hasOwn(properties,'detail'))properties.detail={
      type:'string',enum:['summary','full'],description:'Safe summary or full'};
    if(!Object.hasOwn(properties,'fields'))properties.fields={
      type:'string',maxLength:600,description:'Max 12 dotted paths'};
  }
  return {...rest,inputSchema:{...schema,properties},
    annotations:{...rest.annotations,readOnlyHint:tool.writes===false,
      destructiveHint:tool.writes===true ? rest.annotations?.destructiveHint!==false : false,
      idempotentHint:tool.writes===false,
      openWorldHint:true}};
}
