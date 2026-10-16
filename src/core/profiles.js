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
const guardedTestAreas=new Set(['customers','payments','checkout','billing','developer','disputes','risk','identity']);
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
        fullOwnerWorkflowWrites.has(tool.name)))&&
    isToolAllowed(tool,connection?.profile,{allowWrites:true});
}
const compactNames=new Set(['stripe_whoami','stripe_search_tools',
  'stripe_describe_tool','stripe_call','stripe_batch','stripe_get_result']);
export function listingForConnection(registry,connection,override){
  // Listing cannot change the account, profile or read/write eligibility.
  const mode=['compact','catalog'].includes(override)?override:connection?.listing;
  const available=visibleTools(registry,connection?.profile,
    {allowWrites:connection?.mode==='test'}).filter(t=>t.writes===false||
      isGuardedTestWrite(t,connection));
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
  if(tool.writes===false&&!tool.name.startsWith('workflow_')){
    if(!Object.hasOwn(properties,'detail'))properties.detail={
      type:'string',enum:['summary','full'],description:'Summary by default; full retains all safe fields'};
    if(!Object.hasOwn(properties,'fields'))properties.fields={
      type:'string',maxLength:600,description:'Up to 12 comma-separated dotted field paths'};
  }
  return {...rest,inputSchema:{...schema,properties},
    annotations:{...rest.annotations,readOnlyHint:tool.writes===false,
      destructiveHint:tool.writes===true ? rest.annotations?.destructiveHint!==false : false,
      idempotentHint:tool.writes===false,
      openWorldHint:true}};
}
