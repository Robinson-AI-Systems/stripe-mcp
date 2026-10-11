// G-1d1 TEST-only financial-report type/run reads; never expose file URLs/tokens.
import {allProfiles,client,guarded,fail,local,pageResult,paging,ref}
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
function reportType(v){
  if(v?.object!=='reporting.report_type'||!typeId(v.id)||v.livemode===true||
    !stamp(v.data_available_start)||!stamp(v.data_available_end)||
    v.data_available_start>v.data_available_end)
    invalid('Stripe TEST report type metadata invalid');
  const cols=v.default_columns;
  if(!Array.isArray(cols)||cols.length>100||
    cols.some(c=>!/^[_a-z0-9]{1,80}$/.test(c)))
    invalid('Invalid report type columns');
  return {id:v.id,name:names(v.name),version:v.version??null,
    dataAvailableStart:v.data_available_start,
    dataAvailableEnd:v.data_available_end,
    defaultColumns:cols,dataStartLocal:local(v.data_available_start),
    dataEndLocal:local(v.data_available_end)};
}
function run(v){
  if(v?.object!=='reporting.report_run'||!reportId(v.id)||
    v.livemode!==false||!typeId(v.report_type)||
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
  def('report_list_types','List provider-available TEST report types and exact covered periods.',{
    limit,starting_after:cursor}),
  def('report_list_runs','List TEST financial report runs without exposing signed file links.',{
    limit:{type:'integer',minimum:1,maximum:100},starting_after:runsCursor}),
  def('report_get_run','Read TEST run status and result file ID, never unverified URL.',{
    runId:{type:'string',pattern:'^frr_[A-Za-z0-9]{2,100}$'}},['runId'])
];
export const handlers={
  report_list_types:(a,ctx)=>guarded(ctx,async s=>{
    validate(a,['limit','starting_after']);
    const lim=a.limit??20;
    if(!Number.isInteger(lim)||lim<1||lim>30||
      (a.starting_after&&!typeId(a.starting_after)))invalid('Invalid report type paging');
    const raw=await s.reporting.reportTypes.list();
    if(!Array.isArray(raw?.data)||raw.data.length>2000||
      raw.has_more===true)invalid('Provider report type list incomplete');
    const types=raw.data.map(reportType).sort((x,y)=>x.id.localeCompare(y.id));
    if(new Set(types.map(x=>x.id)).size!==types.length)
      invalid('Duplicate report types from provider');
    const start=a.starting_after===undefined?0:
      types.findIndex(x=>x.id===a.starting_after)+1;
    if(start===0&&a.starting_after)invalid('Unknown report type cursor');
    const data=types.slice(start,start+lim);
    const hasMore=start+lim<types.length;
    return {data,has_more:hasMore,next:hasMore?data.at(-1)?.id:null,
      scope:'complete_TEST_report_type_catalog_sorted_by_id'};
  }),
  report_list_runs:(a,ctx)=>guarded(ctx,async s=>{
    validate(a,['limit','starting_after']);
    if(a.starting_after!==undefined&&!reportId(a.starting_after))
      invalid('Exact report run cursor required');
    const opts=paging(a);
    return pageResult(await s.reporting.reportRuns.list(opts),run);
  }),
  report_get_run:(a,ctx)=>guarded(ctx,async s=>{
    validate(a,['runId'],['runId']);
    if(!reportId(a.runId))invalid('Exact report run ID required');
    return run(await s.reporting.reportRuns.retrieve(a.runId));
  })
};
for(const [name,handler] of Object.entries(handlers)){
  handlers[name]=(a,ctx)=>ctx?.connection?.mode!=='test'?
    fail('Report reads require TEST mode'):handler(a,ctx);
}
