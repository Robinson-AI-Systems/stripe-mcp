// G-1d2 TEST-only guarded report-run request. Creating != report completion.
import {defineWrite,gone} from './write.js';
import {client,fullProfiles,validateFields} from './billing-shared.js';
const props={
  reportType:{type:'string',pattern:'^[a-z0-9_.-]{3,100}$'},
  intervalStart:{type:'integer',minimum:946684800,maximum:4102444800},
  intervalEnd:{type:'integer',minimum:946684800,maximum:4102444800},
  outsideApp:{type:'boolean'}
};
const required=['reportType','intervalStart','intervalEnd'];
const supportedType=/^(?:balance\.summary\.|balance_change_from_activity\.|payout_reconciliation\.|fees\.)[a-z0-9_.-]{1,80}$/;
function invalid(message){throw new TypeError(message);}
function stamp(v){return Number.isSafeInteger(v)&&v>=946684800&&v<=4102444800;}
async function reportDefinition(a,ctx){
  validateFields(a,props,required);
  if(!supportedType.test(a.reportType))invalid(
    'Only standard balance, payout reconciliation and fee report types are enabled');
  if(a.intervalStart>=a.intervalEnd||
    a.intervalEnd-a.intervalStart>366*86400)
    invalid('Report interval must be positive and at most 366 days');
  const stripe=await client(ctx);
  const type=await stripe.reporting.reportTypes.retrieve(a.reportType);
  if(type?.object!=='reporting.report_type'||type.id!==a.reportType||
    type.livemode!==false||!stamp(type.data_available_start)||
    !stamp(type.data_available_end)||
    a.intervalStart<type.data_available_start||
    a.intervalEnd>type.data_available_end)
    invalid('Selected TEST report type or available period cannot be verified');
  return {...type,metadata:type.metadata??{},
    _request:{intervalStart:a.intervalStart,intervalEnd:a.intervalEnd}};
}
function make(){
  let createdId=null,seen=null;
  const op=defineWrite({
    name:'report_run',read:reportDefinition,
    summarize:(before,a)=>'TEST MODE. Request asynchronous Stripe report '+
      before.id+' for UTC interval ['+a.intervalStart+', '+a.intervalEnd+
      '). This confirms only that a report job was created, not that CSV data is ready. '+
      'Actual output file ID and status must be inspected separately.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const stripe=await client(ctx);
      const result=await stripe.reporting.reportRuns.create({
        report_type:a.reportType,
        parameters:{interval_start:a.intervalStart,interval_end:a.intervalEnd}
      },{idempotencyKey});
      if(result?.object!=='reporting.report_run'||
        !/^frr_[A-Za-z0-9]{2,100}$/.test(result.id))
        invalid('Provider did not acknowledge report-run identity');
      createdId=result.id;
    },
    readAfter:async(_a,ctx)=>{
      if(!createdId)return null;
      seen=await (await client(ctx)).reporting.reportRuns.retrieve(createdId);
      return seen;
    },
    verify:(before,after,a)=>after?.object==='reporting.report_run'&&
      after.id===createdId&&after.livemode===false&&
      after.report_type===before.id&&
      after.parameters?.interval_start===a.intervalStart&&
      after.parameters?.interval_end===a.intervalEnd&&
      ['pending','succeeded'].includes(after.status)
  });
  return {...op,async handler(a,ctx){
    const result=await op.handler(a,ctx);
    if(result?.isError||!createdId||!seen)return result;
    const parsed=JSON.parse(result.content[0].text);
    if(parsed.confirmed!==true)return result;
    return {...result,content:[{type:'text',text:JSON.stringify({
      ...parsed,runId:createdId,reportStatus:seen.status,
      reportCompleted:seen.status==='succeeded',
      downloadUrl:null,
      guidance:'Use report_get_run for the provider result file ID. No signed file URL is exposed.'
    })}]};
  }};
}
const operation=make();
export const tools=[{...operation.tool,area:'reports',profiles:fullProfiles,
  description:'Request a curated TEST financial report; asynchronous and requires confirmation.',
  inputSchema:{type:'object',properties:{...props,dryRun:{type:'boolean'},
    confirm:{type:'boolean'},requestKey:{type:'string',minLength:1,maxLength:128}},
    required,additionalProperties:false}}];
export const handlers={report_run:(a,ctx)=>ctx?.connection?.mode!=='test'?
  gone('Report generation requires TEST mode'):make().handler(a,ctx)};
export const makeReportRunWrite=make;
