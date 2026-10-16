// W-9 month-end financial close and bounded universal TEST find.
// Only original wrapped native reads; a report CSV is NEVER a public URL.
import {createHash} from 'node:crypto';
import {reply,fail} from './billing-shared.js';
import {verifyContext,nativeRead,collect,deadline,expired,dateWindow} from './workflow-read-common.js';
import {writable,nativeWrite,readyStep} from './workflow-customer-actions.js';
const month={type:'string',pattern:'^20[0-9]{2}-(0[1-9]|1[0-2])$'};
const reportType={type:'string',pattern:'^[a-z0-9_.-]{3,100}$'};
const runId={type:'string',pattern:'^frr_[A-Za-z0-9]{2,100}$'};
const types=['customer','invoice','payment','charge','product','price'];
const query={type:'string',minLength:1,maxLength:220};
const f=(name,desc,props,required=[],write=false)=>({
  name,description:desc,area:'workflows',
  profiles:write?['full']:allProfiles,writes:write,
  ...(write?{writeContract:'defineWrite-v1',safety:'P',moneySpec:null}:{
    annotations:{readOnlyHint:true}}),
  inputSchema:{type:'object',properties:props,required,additionalProperties:false}
});
export const tools=[
  f('workflow_month_end_close','Close one Colorado TEST month per currency; inspect private report run status.',{month,runId},['month']),
  f('workflow_month_end_report','Preview and request one guarded TEST financial report for an exact Colorado month.',
    {month,reportType,confirm:{type:'boolean'},dryRun:{type:'boolean'},
      requestKey:{type:'string',minLength:1,maxLength:100},
      previewToken:{type:'string',pattern:'^[a-f0-9]{64}$'}},
    ['month','reportType'],true),
  f('workflow_find','Search selected TEST customer, invoice, payment, charge, product or price with safe pagination.',
    {type:{type:'string',enum:types},query,limit:{type:'integer',minimum:1,maximum:100},
      maxPages:{type:'integer',minimum:1,maximum:5}},['type','query'])
];
const monthRe=/^20\d{2}-(0[1-9]|1[0-2])$/;
function windowOf(v){
  if(typeof v!=='string'||!monthRe.test(v))throw new TypeError('Exact Colorado YYYY-MM month required');
  const [year,mon]=v.split('-').map(Number),last=new Date(Date.UTC(year,mon,0))
    .toISOString().slice(0,10),first=v+'-01';
  return {month:v,fromDate:first,toDate:last,...dateWindow(first,last)};
}
function validate(o,keys){
  if(!o||typeof o!=='object'||Array.isArray(o)||
    Object.keys(o).some(k=>!keys.includes(k)))
    throw new TypeError('Only documented original TEST workflow fields permitted');
}
async function close(a,ctx){
  verifyContext(ctx);validate(a,['month','runId']);
  const win=windowOf(a.month),snap=await nativeRead('workflow_money_snapshot',
    {fromDate:win.fromDate,toDate:win.toDate},ctx);
  if(snap.account!==ctx.connection.stripeAccount||snap.mode!=='test'||
    snap.window?.from!==win.from||snap.window?.until!==win.until||
    !snap.moneyFlowsByCurrency||typeof snap.moneyFlowsByCurrency!=='object')
    throw new TypeError('Provider-verified Colorado money snapshot unavailable');
  let report=null;
  if(a.runId!==undefined){
    if(!/^frr_[A-Za-z0-9]{2,100}$/.test(a.runId))
      throw new TypeError('Exact TEST report-run ID required');
    const run=await nativeRead('report_get_run',{runId:a.runId},ctx);
    if(run.id!==a.runId||run.intervalStart!==win.from||run.intervalEnd!==win.until)
      throw new TypeError('Selected report has a different verified month');
    const file=await nativeRead('report_get_result_file',{runId:a.runId},ctx);
    if(file.runId!==a.runId||file.runStatus!==run.status)
      throw new TypeError('Authenticated original report result does not match run');
    report={id:a.runId,type:run.reportType,status:run.status,
      resultFileId:file.available===true?file.fileId:null,
      privateExport:{available:file.available===true,
        delivery:'owner_authenticated_Stripe_Dashboard_or_protected_owner_browser_only',
        downloadUrl:null,publicUrlAvailable:false},
      pending:run.status==='pending',failed:run.status==='failed'};
  }
  return {kind:'month_end_close',account:ctx.connection.stripeAccount,mode:'test',
    calendar:'America/Denver',month:a.month,window:{from:win.from,until:win.until},
    complete:snap.complete===true,
    moneyFlowsComplete:snap.moneyFlowsComplete===true,
    flowsByCurrency:snap.moneyFlowsByCurrency,
    noCurrencyConversion:true,transactionCount:snap.balanceTransactionCount,
    recurringAtReportTime:snap.recurring,
    mrrComplete:snap.mrrComplete===true,gaps:snap.gaps??[],
    report,reportReady:report?.privateExport.available===true,
    nextAction:!snap.complete?'Resolve original provider pagination/permissions before close':
      !report?'Optionally request exact native TEST report type after confirming available period':
      report.status==='pending'?'Recheck report_get_run later':
      report.status==='failed'?'Investigate original Stripe report failure':
      'Download report in authenticated owner browser; file content URL is never shared by this tool',
    note:'No signed URL, CSV bytes, report job or payment write was created by this read-only close.'};
}
const digest=(a,ctx,report,preview)=>createHash('sha256')
  .update(JSON.stringify({account:ctx.connection.stripeAccount,kind:'month-end-report',
    month:a.month,report,preview})).digest('hex');
async function report(a,ctx){
  writable(ctx);validate(a,['month','reportType','confirm','dryRun','requestKey','previewToken']);
  if(!/^(balance\.summary\.|balance_change_from_activity\.|payout_reconciliation\.|fees\.)[a-z0-9_.-]{1,80}$/.test(a.reportType??''))
    throw new TypeError('Select one supported original TEST financial report type');
  const win=windowOf(a.month),end=deadline();
  const available=await collect('report_list_types',{limit:30},ctx,{end});
  if(!available.complete)throw new TypeError('Complete original Stripe report type catalog not readable');
  const item=available.data.find(t=>t.id===a.reportType);
  if(!item||!Number.isSafeInteger(item.dataAvailableStart)||
    !Number.isSafeInteger(item.dataAvailableEnd)||win.from<item.dataAvailableStart||
    win.until>item.dataAvailableEnd)
    throw new TypeError('Report type has no provider-verifiable coverage for the chosen month');
  const args={reportType:a.reportType,intervalStart:win.from,intervalEnd:win.until};
  const native=await readyStep('report_run',args,ctx);
  const token=digest(a,ctx,{type:item.id,range:[item.dataAvailableStart,
    item.dataAvailableEnd],window:[win.from,win.until]},native.preview);
  const result={kind:'month_end_report',account:ctx.connection.stripeAccount,
    month:a.month,mode:'test',reportType:a.reportType,
    intervalStart:win.from,intervalEnd:win.until,
    previewToken:token,nativePreview:native.preview,
    done:false,needsConfirmation:true,
    reportCompletion:'not_requested',
    privateOwnerHandoff:'Only owner-authenticated Stripe Dashboard or protected owner browser; no public CSV link'};
  if(a.confirm!==true)return result;
  if(a.previewToken!==token||!a.requestKey||a.dryRun===true)
    throw new TypeError('Fresh report type/period preview and stable requestKey required');
  try{
    const written=await nativeWrite('report_run',
      {...args,confirm:true,requestKey:a.requestKey+':report'},ctx);
    if(written.isError||written.value.done!==true||written.value.confirmed!==true||
      !/^frr_[A-Za-z0-9]{2,100}$/.test(written.value.runId??''))
      return {...result,done:false,needsConfirmation:false,
        warning:'Report request denied or outcome uncertain; inspect original audit before any retry'};
    const run=await nativeRead('report_get_run',{runId:written.value.runId},ctx);
    if(run.intervalStart!==win.from||run.intervalEnd!==win.until||
      run.reportType!==a.reportType)
      throw new TypeError('Confirmed report is not for originally approved month');
    return {...result,done:true,confirmed:true,needsConfirmation:false,
      runId:run.id,reportCompletion:run.status,publicDownloadUrl:null,
      nextAction:'Read report_get_result_file only after succeeded and use authenticated owner browser'};
  }catch{return {...result,done:false,confirmed:false,needsConfirmation:false,
    warning:'Report request may have succeeded; use the original audit key to reconcile; never automatically retry'};}
}
const matchQuery=v=>typeof v==='string'&&v.trim()&&v.length<=220&&
  /^[a-zA-Z0-9_@\-\s.\[\]:'"~+*]+$/.test(v);
const search={customer:'customer_search',invoice:'invoice_search',
  payment:'payment_search',charge:'charge_search',product:'product_search',price:'price_search'};
async function find(a,ctx){
  verifyContext(ctx);validate(a,['type','query','limit','maxPages']);
  if(!Object.hasOwn(search,a.type)||!matchQuery(a.query)||
    a.limit!==undefined&&(!Number.isSafeInteger(a.limit)||a.limit<1||a.limit>100)||
    a.maxPages!==undefined&&(!Number.isSafeInteger(a.maxPages)||a.maxPages<1||a.maxPages>5))
    throw new TypeError('Choose exact provider search type, bounded query and page limits');
  const end=deadline(),perPage=Math.min(a.limit??20,100),pages=a.maxPages??3;
  let cursor=null,reason=null,pageCount=0,complete=false;
  const results=[],seenIds=new Set(),seenCursors=new Set();
  while(pageCount<pages&&results.length<250){
    if(expired(end)){reason='time_budget';break;}
    let data;
    try{data=await nativeRead(search[a.type],
      {query:a.query,limit:perPage,...(cursor?{page:cursor}:{})},ctx);}
    catch{reason='provider_search_unavailable';break;}
    if(!Array.isArray(data.data)||data.data.length>perPage||
      typeof data.has_more!=='boolean') {reason='invalid_provider_page';break;}
    pageCount++;
    for(const v of data.data){
      if(typeof v.id!=='string'||seenIds.has(v.id))
        {reason='duplicate_or_unverified_record';break;}
      seenIds.add(v.id);
      results.push(v);
    }
    if(reason)break;
    if(!data.has_more){complete=true;break;}
    if(typeof data.next!=='string'||!data.next||seenCursors.has(data.next)||
      data.next===cursor){reason='nonadvancing_search_cursor';break;}
    seenCursors.add(data.next);cursor=data.next;
  }
  if(!complete&&!reason)reason='page_or_row_limit';
  return {kind:'find',account:ctx.connection.stripeAccount,mode:'test',
    type:a.type,query:a.query,results:results.slice(0,250),
    resultCount:results.length,complete,reason,
    pages:pageCount,nextPage:complete?null:cursor,
    note:'Provider-safe projections only. Incomplete scans are not absence proofs.'};
}
export const handlers={
  async workflow_month_end_close(a,ctx){
    try{return reply(await close(a,ctx));}catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  },
  async workflow_month_end_report(a,ctx){
    try{return reply(await report(a,ctx));}catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  },
  async workflow_find(a,ctx){
    try{return reply(await find(a,ctx));}catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
