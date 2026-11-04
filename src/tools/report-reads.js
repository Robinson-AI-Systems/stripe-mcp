// G-1d1 financial-report type/run reads in the connection's own mode;
// never expose file URLs/tokens.
import {allProfiles,guarded,local,pageResult,paging,ref}
  from './billing-shared.js';
const invalid=msg=>{throw new TypeError(msg);};
const reportId=s=>typeof s==='string'&&/^frr_[A-Za-z0-9]{2,100}$/.test(s);
const typeId=s=>typeof s==='string'&&/^[a-z0-9_.-]{3,100}$/.test(s);
const stamp=t=>Number.isSafeInteger(t)&&t>=946684800&&t<=4102444800;
const names=s=>typeof s==='string'&&s.length<101?s:null;
function validate(a,allowed,required=[]){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!allowed.includes(k))||
    required.some(k=>a[k]===undefined))
    invalid('Exact report-read arguments required');
}
function reportType(v,mode){
  // The baseline check refused only a livemode===true type. With a
  // connection mode supplied, a present boolean livemode must equal
  // that mode (the fileSafe semantics, V2 Files family): the baseline
  // TEST read set is unchanged exactly, and a LIVE connection refuses
  // TEST types while verifying its own. No-mode callers keep the
  // historical check exactly. Signed report URLs are never projected
  // here (or anywhere in this family), in either mode.
  const wrongMode=['test','live'].includes(mode)
    ? (typeof v?.livemode==='boolean'&&v.livemode!==(mode==='live'))
    : v?.livemode===true;
  if(v?.object!=='reporting.report_type'||!typeId(v.id)||wrongMode||
    !stamp(v.data_available_start)||!stamp(v.data_available_end)||
    v.data_available_start>v.data_available_end)
    invalid('Stripe TEST report type metadata invalid');
  // Stripe report types may omit or null their optional default_columns.
  // This is missing schema metadata, not an invalid financial report type;
  // keep an explicit uncertainty marker rather than inventing zero columns.
  const cols=v.default_columns;
  if(cols!==undefined&&cols!==null&&(!Array.isArray(cols)||
    cols.length>200||cols.some(c=>!/^[_a-z0-9]{1,100}$/.test(c))))
    invalid('Invalid report type columns');
  return {id:v.id,name:names(v.name),version:v.version??null,
    dataAvailableStart:v.data_available_start,
    dataAvailableEnd:v.data_available_end,
    defaultColumns:Array.isArray(cols)?cols:null,
    defaultColumnsVerified:Array.isArray(cols),
    dataStartLocal:local(v.data_available_start),
    dataEndLocal:local(v.data_available_end)};
}
function run(v,mode){
  // The baseline check strictly required livemode===false; the
  // parameterized form keeps that exact set for TEST (and any
  // no-mode caller) and requires livemode===true for LIVE, so a
  // wrong-mode run refuses the whole read in both directions.
  if(v?.object!=='reporting.report_run'||!reportId(v.id)||
    v.livemode!==(mode==='live')||!typeId(v.report_type)||
    !['pending','succeeded','failed'].includes(v.status)||
    !stamp(v.created))
    invalid('Stripe TEST report run identity or status invalid');
  const parameters=v.parameters??{},start=parameters.interval_start;
  const end=parameters.interval_end;
  if((start!=null&&!stamp(start))||(end!=null&&!stamp(end))||
    (start!=null&&end!=null&&start>=end))
    invalid('Report period invalid');
  const file=ref(v.result);
  if(file!==null&&!/^file_[A-Za-z0-9]{2,100}$/.test(file))
    invalid('Unexpected report-result file identity');
  return {id:v.id,reportType:v.report_type,status:v.status,
    createdAt:local(v.created),createdUnix:v.created,
    intervalStart:start??null,intervalEnd:end??null,
    succeededAt:local(v.succeeded_at),resultFileId:file,
    downloadUrl:null,downloadUrlAvailable:false,
    errorCode:names(v.error?.code),errorType:names(v.error?.type),
    evidence:'Stripe reporting result file ID only; no unverified signed URL'};
}
const def=(name,description,properties={},required=[])=>({
  name,description,area:'reports',profiles:allProfiles,writes:false,
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties,required,additionalProperties:false}
});
const limit={type:'integer',minimum:1,maximum:30};
const cursor={type:'string',pattern:'^[a-z0-9_.-]{3,100}$'};
const runsCursor={type:'string',pattern:'^frr_[A-Za-z0-9]{2,100}$'};
export const tools=[
  def('report_list_types','List TEST or LIVE report types and exact covered periods.',{
    limit,starting_after:cursor}),
  def('report_list_runs','List TEST or LIVE report runs; no signed links.',{
    limit:{type:'integer',minimum:1,maximum:100},starting_after:runsCursor}),
  def('report_get_run','Read TEST or LIVE run status, file ID; no signed URL.',{
    runId:{type:'string',pattern:'^frr_[A-Za-z0-9]{2,100}$'}},['runId'])
];
export const handlers={
  report_list_types:(a,ctx)=>guarded(ctx,async s=>{
    validate(a,['limit','starting_after']);
    const lim=a.limit??20;
    if(!Number.isInteger(lim)||lim<1||lim>30||
      (a.starting_after&&!typeId(a.starting_after)))invalid('Invalid report type paging');
    const mode=ctx?.connection?.mode;
    const raw=await s.reporting.reportTypes.list();
    if(!Array.isArray(raw?.data)||raw.data.length>2000||
      raw.has_more===true)invalid('Provider report type list incomplete');
    const types=raw.data.map(v=>reportType(v,mode)).sort((x,y)=>x.id.localeCompare(y.id));
    if(new Set(types.map(x=>x.id)).size!==types.length)
      invalid('Duplicate report types from provider');
    const start=a.starting_after===undefined?0:
      types.findIndex(x=>x.id===a.starting_after)+1;
    if(start===0&&a.starting_after)invalid('Unknown report type cursor');
    const data=types.slice(start,start+lim);
    const hasMore=start+lim<types.length;
    return {data,has_more:hasMore,next:hasMore?data.at(-1)?.id:null,
      scope:'complete_'+(mode==='live'?'LIVE':'TEST')+
        '_report_type_catalog_sorted_by_id'};
  }),
  report_list_runs:(a,ctx)=>guarded(ctx,async s=>{
    validate(a,['limit','starting_after']);
    if(a.starting_after!==undefined&&!reportId(a.starting_after))
      invalid('Exact report run cursor required');
    const opts=paging(a);
    const mode=ctx?.connection?.mode;
    return pageResult(await s.reporting.reportRuns.list(opts),v=>run(v,mode));
  }),
  report_get_run:(a,ctx)=>guarded(ctx,async s=>{
    validate(a,['runId'],['runId']);
    if(!reportId(a.runId))invalid('Exact report run ID required');
    return run(await s.reporting.reportRuns.retrieve(a.runId),
      ctx?.connection?.mode);
  })
};
