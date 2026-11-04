// CAP-4 D-6 — report, file and Radar READ tools verify every
// returned object against the connection's own mode. At baseline the
// family was TEST-gated in four places (the report-reads wrapper,
// the result-file handler check, the file-read handler ternaries and
// the Radar list/get ternaries), while most projections already
// carried the V2 mode machinery: fileSafe was mode-parameterized
// (V2 Files) but its read callers passed no mode, and the Radar
// projections took an optional mode (V2 Radar) the read handlers
// never supplied. Reports were the least converted: the report-type
// and result-file projections only refused a livemode===true object
// (boolean-present semantics, preserved exactly), while the run
// projections strictly required livemode===false (strict semantics,
// parameterized in place). Recorded honestly: 10 of these 18
// tests fail at the pre-D-6 baseline (every LIVE happy path, the
// boolean-present semantics leg that runs on a LIVE connection,
// the wrong-mode refusals whose baseline outcome was produced by
// a gate before any provider call while the test names the
// post-conversion evidence — the provider call made, the refusal
// text naming the LIVE file — the Radar privacy test's LIVE leg,
// and the descriptions). Eight pass at baseline and after, each
// accounted: the byte-identical TEST report pin (TEST was already
// fully served, scope literal included); invariant 1, whose LIVE
// leg passes vacuously at baseline through the gate refusal and
// after conversion on the success path; the two result-file
// wrong-mode refusals, outcome-identical at baseline (gate on the
// LIVE side, the strict run check and the livemode===true file
// check on the TEST side); the historical no-livemode result file,
// the very fixture shape that forced boolean-present semantics;
// invariant 3, whose bounds refuse after conversion exactly where
// the gate refused before; and the fileSafe / Radar projection
// no-mode contracts, which pin the V2 machinery D-6 did not
// change — it only started passing the mode into it.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {tools as reportTools,handlers as reportHandlers}
  from '../../src/tools/report-reads.js';
import {tools as resultFileTools,handlers as resultFileHandlers}
  from '../../src/tools/report-result-file.js';
import {tools as fileTools,handlers as fileHandlers,fileSafe}
  from '../../src/tools/file-reads.js';
import {tools as radarTools,handlers as radarHandlers,
  warningSafe,reviewSafe,valueListSafe,valueItemSafe}
  from '../../src/tools/radar-reads.js';

const acct='acct_D6FAKE';
const parse=r=>JSON.parse(r.content[0].text);
const now=1695680197;
const SIGNED='https://files.stripe.com/SIGNED_URL_SENTINEL';

const typeBase={id:'balance.summary.1',object:'reporting.report_type',
  data_available_start:1680000000,data_available_end:1690000000,
  default_columns:['category','net_amount'],name:'Balance Summary',
  version:1};
const reportType=livemode=>({...typeBase,livemode});
const runBase={id:'frr_D6FAKE',object:'reporting.report_run',
  created:1680020000,status:'succeeded',report_type:'balance.summary.1',
  parameters:{interval_start:1680000000,interval_end:1680010000},
  result:'file_D6FAKE',error:null,succeeded_at:1680021000};
const reportRun=livemode=>({...runBase,livemode});
const resultFile=livemode=>({object:'file',id:'file_D6FAKE',
  purpose:'finance_report_run',size:1024,created:1680203749,type:'csv',
  filename:'balance.csv',livemode,url:SIGNED,
  links:{data:[{url:'https://secret.invalid/SIGNED_SENTINEL'}]},
  account_number:'SHOULD_NOT_LEAK'});
const fileBase={object:'file',id:'file_D6FAKE',purpose:'dispute_evidence',
  created:1680203749,size:1024,type:'pdf',filename:'evidence.pdf',
  url:SIGNED,links:{data:[{url:'https://secret.invalid/x'}]},
  account_number:'SHOULD_NOT_LEAK'};
const fileObj=livemode=>({...fileBase,livemode});
const warning=livemode=>({id:'issfr_D6FAKE',
  object:'radar.early_fraud_warning',livemode,created:now,
  charge:'ch_D6FAKE',payment_intent:null,actionable:true,
  fraud_type:'misc',ip_address:'SECRET_IP'});
const review=livemode=>({id:'prv_D6FAKE',object:'review',livemode,
  created:now,charge:null,payment_intent:'pi_D6FAKE',open:true,
  reason:'rule',billing_zip:'SECRET_ZIP',ip_address:'SECRET_IP'});
const valueList=livemode=>({id:'rsl_D6FAKE',object:'radar.value_list',
  livemode,created:now,alias:'fraud_test',item_type:'email',
  name:'Fraud test',list_items:{total_count:1}});
const valueItem=livemode=>({id:'rsli_D6FAKE',
  object:'radar.value_list_item',livemode,created:now,
  value_list:'rsl_D6FAKE',value:'SECRET_EMAIL'});

const liveSdkParts={accounts:{retrieve:async()=>({id:acct,
    object:'account',livemode:true})},
  balance:{retrieve:async()=>({object:'balance',livemode:true})}};
function sdk({type=reportType(false),run=reportRun(false),
  file=fileObj(false),warn=warning(false),rev=review(false),
  vlist=valueList(false),vitem=valueItem(false)}={}) {
  return {...liveSdkParts,
    reporting:{
      reportTypes:{list:vi.fn(async()=>({object:'list',data:[type],
        has_more:false}))},
      reportRuns:{list:vi.fn(async()=>({object:'list',data:[run],
        has_more:false})),retrieve:vi.fn(async()=>run)}},
    files:{list:vi.fn(async()=>({data:[file],has_more:false})),
      retrieve:vi.fn(async()=>file)},
    radar:{
      earlyFraudWarnings:{list:vi.fn(async()=>({data:[warn],
        has_more:false})),retrieve:vi.fn(async()=>warn)},
      valueLists:{list:vi.fn(async()=>({data:[vlist],has_more:false})),
        retrieve:vi.fn(async()=>vlist)},
      valueListItems:{list:vi.fn(async()=>({data:[vitem],
        has_more:false}))}},
    reviews:{list:vi.fn(async()=>({data:[rev],has_more:false})),
      retrieve:vi.fn(async()=>rev)}};
}
function testCtx(s){
  return {connection:{stripeAccount:acct,mode:'test',profile:'full'},
    services:{stripeForConnection:async()=>s}};
}
async function liveCtx(s){
  vi.stubEnv('VERCEL_ENV','production');
  const db=createFakeDb({accounts:[{id:acct,live_enabled:true,
    live_connected:true,money_limit_cents:0}]});
  return {db,connection:{stripeAccount:acct,mode:'live',profile:'full'},
    services:{stripeForConnection:async()=>s}};
}
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});

describe('CAP-4 D-6 report reads verify the connection mode',()=>{
  it('serves verified LIVE report types, runs and run gets',async()=>{
    const s=sdk({type:reportType(true),run:reportRun(true)}),
      ctx=await liveCtx(s);
    const types=parse(await reportHandlers.report_list_types({},ctx));
    expect(types.data[0]).toMatchObject({id:'balance.summary.1',
      defaultColumns:['category','net_amount']});
    expect(types.scope)
      .toBe('complete_LIVE_report_type_catalog_sorted_by_id');
    const runs=parse(await reportHandlers.report_list_runs(
      {limit:2},ctx));
    expect(s.reporting.reportRuns.list).toHaveBeenCalledWith({limit:2});
    expect(runs.data[0]).toMatchObject({id:'frr_D6FAKE',
      status:'succeeded',resultFileId:'file_D6FAKE',
      downloadUrl:null,downloadUrlAvailable:false});
    expect(parse(await reportHandlers.report_get_run(
      {runId:'frr_D6FAKE'},ctx)).resultFileId).toBe('file_D6FAKE');
  });
  it('keeps TEST report outputs byte-identical, scope literal included',
    async()=>{
    const s=sdk(),ctx=testCtx(s);
    const types=parse(await reportHandlers.report_list_types({},ctx));
    expect(types.scope)
      .toBe('complete_TEST_report_type_catalog_sorted_by_id');
    const runs=parse(await reportHandlers.report_list_runs({},ctx));
    expect(runs.data[0]).toEqual({id:'frr_D6FAKE',
      reportType:'balance.summary.1',status:'succeeded',
      createdAt:runs.data[0].createdAt,createdUnix:1680020000,
      intervalStart:1680000000,intervalEnd:1680010000,
      succeededAt:runs.data[0].succeededAt,resultFileId:'file_D6FAKE',
      downloadUrl:null,downloadUrlAvailable:false,errorCode:null,
      errorType:null,
      evidence:'Stripe reporting result file ID only; no unverified signed URL'});
  });
  it('refuses wrong-mode report runs on both connection modes',async()=>{
    const sTest=sdk({run:reportRun(true)}),ctxTest=testCtx(sTest);
    expect((await reportHandlers.report_list_runs({},ctxTest)).isError)
      .toBe(true);
    expect(sTest.reporting.reportRuns.list).toHaveBeenCalled();
    const sLive=sdk({run:reportRun(false)}),ctxLive=await liveCtx(sLive);
    expect((await reportHandlers.report_get_run(
      {runId:'frr_D6FAKE'},ctxLive)).isError).toBe(true);
    expect(sLive.reporting.reportRuns.retrieve)
      .toHaveBeenCalledWith('frr_D6FAKE');
  });
  it('preserves the boolean-present report-type semantics exactly',
    async()=>{
    const noModeType={...typeBase};
    const sTest=sdk({type:noModeType}),ctxTest=testCtx(sTest);
    expect(parse(await reportHandlers.report_list_types({},ctxTest))
      .data).toHaveLength(1);
    const sLive=sdk({type:noModeType}),ctxLive=await liveCtx(sLive);
    expect(parse(await reportHandlers.report_list_types({},ctxLive))
      .data).toHaveLength(1);
    const sWrong=sdk({type:reportType(true)}),ctxWrong=testCtx(sWrong);
    expect((await reportHandlers.report_list_types({},ctxWrong))
      .isError).toBe(true);
  });
  it('never exposes a signed report URL in either mode (invariant 1)',
    async()=>{
    const urlRun=livemode=>({...reportRun(livemode),url:SIGNED,
      result:{id:'file_D6FAKE',object:'file',url:SIGNED}});
    for(const makeCtx of [async s=>testCtx(s),liveCtx]){
      const livemode=makeCtx===liveCtx;
      const s=sdk({run:urlRun(livemode),file:resultFile(livemode)}),
        ctx=await makeCtx(s);
      const serialized=JSON.stringify([
        await reportHandlers.report_list_runs({},ctx),
        await reportHandlers.report_get_run({runId:'frr_D6FAKE'},ctx),
        await resultFileHandlers.report_get_result_file(
          {runId:'frr_D6FAKE'},ctx)]);
      expect(serialized).not.toContain('files.stripe.com');
      expect(serialized).not.toContain('SIGNED');
      expect(serialized).not.toContain('secret.invalid');
    }
  });
});

describe('CAP-4 D-6 result-file read verifies run and file modes',()=>{
  it('serves a verified LIVE run and file with metadata only',async()=>{
    const s=sdk({run:reportRun(true),file:resultFile(true)}),
      ctx=await liveCtx(s);
    const res=parse(await resultFileHandlers.report_get_result_file(
      {runId:'frr_D6FAKE'},ctx));
    expect(res).toMatchObject({available:true,runId:'frr_D6FAKE',
      fileId:'file_D6FAKE',purpose:'finance_report_run',
      sizeBytes:1024,filename:'balance.csv',downloadUrl:null,
      downloadUrlAvailable:false});
    expect(s.files.retrieve).toHaveBeenCalledWith('file_D6FAKE');
    expect(JSON.stringify(res)).not.toContain('SHOULD_NOT_LEAK');
  });
  it('refuses a wrong-mode run before any file read, both directions',
    async()=>{
    const sLive=sdk({run:reportRun(false)}),ctxLive=await liveCtx(sLive);
    expect((await resultFileHandlers.report_get_result_file(
      {runId:'frr_D6FAKE'},ctxLive)).isError).toBe(true);
    expect(sLive.files.retrieve).not.toHaveBeenCalled();
    const sTest=sdk({run:reportRun(true)}),ctxTest=testCtx(sTest);
    expect((await resultFileHandlers.report_get_result_file(
      {runId:'frr_D6FAKE'},ctxTest)).isError).toBe(true);
    expect(sTest.files.retrieve).not.toHaveBeenCalled();
  });
  it('refuses a wrong-mode result file on both connection modes',
    async()=>{
    const sLive=sdk({run:reportRun(true),file:resultFile(false)}),
      ctxLive=await liveCtx(sLive);
    expect((await resultFileHandlers.report_get_result_file(
      {runId:'frr_D6FAKE'},ctxLive)).isError).toBe(true);
    const sTest=sdk({file:resultFile(true)}),ctxTest=testCtx(sTest);
    expect((await resultFileHandlers.report_get_result_file(
      {runId:'frr_D6FAKE'},ctxTest)).isError).toBe(true);
  });
  it('still projects the historical no-livemode file on TEST',async()=>{
    const bare={...resultFile(false)};delete bare.livemode;
    const s=sdk({file:bare}),ctx=testCtx(s);
    const res=parse(await resultFileHandlers.report_get_result_file(
      {runId:'frr_D6FAKE'},ctx));
    expect(res).toMatchObject({available:true,fileId:'file_D6FAKE',
      sizeBytes:1024});
  });
});

describe('CAP-4 D-6 file reads verify the connection mode',()=>{
  it('serves verified LIVE files in list and get',async()=>{
    const s=sdk({file:fileObj(true)}),ctx=await liveCtx(s);
    const list=parse(await fileHandlers.file_list(
      {purpose:'dispute_evidence',limit:5},ctx));
    expect(s.files.list).toHaveBeenCalledWith(
      {purpose:'dispute_evidence',limit:5});
    expect(list.data[0]).toMatchObject({id:'file_D6FAKE',
      purpose:'dispute_evidence',sizeBytes:1024,contentsUrl:null,
      publicUrl:null,bytesIncluded:false});
    expect(parse(await fileHandlers.file_get({fileId:'file_D6FAKE'},
      ctx)).id).toBe('file_D6FAKE');
    expect(JSON.stringify(list)).not.toContain('SHOULD_NOT_LEAK');
  });
  it('refuses wrong-mode files on both connection modes',async()=>{
    const sTest=sdk({file:fileObj(true)}),ctxTest=testCtx(sTest);
    const refused=await fileHandlers.file_get({fileId:'file_D6FAKE'},
      ctxTest);
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text)
      .toContain('Verified TEST file metadata');
    const sLive=sdk({file:fileObj(false)}),ctxLive=await liveCtx(sLive);
    const refusedLive=await fileHandlers.file_get(
      {fileId:'file_D6FAKE'},ctxLive);
    expect(refusedLive.isError).toBe(true);
    expect(refusedLive.content[0].text)
      .toContain('Verified LIVE file metadata');
    expect((await fileHandlers.file_list(
      {purpose:'dispute_evidence'},ctxLive)).isError).toBe(true);
  });
  it('does not relax the purpose bounds in LIVE (invariant 3)',
    async()=>{
    const s=sdk({file:{...fileObj(true),purpose:'identity_document'}}),
      ctx=await liveCtx(s);
    expect((await fileHandlers.file_list(
      {purpose:'identity_document'},ctx)).isError).toBe(true);
    expect((await fileHandlers.file_get({fileId:'file_D6FAKE'},ctx))
      .isError).toBe(true);
    expect((await fileHandlers.file_list(
      {purpose:'dispute_evidence'},ctx)).isError).toBe(true);
  });
  it('keeps the fileSafe no-mode contract byte-identical',()=>{
    expect(fileSafe(fileObj(false))).toMatchObject({id:'file_D6FAKE',
      contentsUrl:null,publicUrl:null});
    expect(()=>fileSafe(fileObj(true))).toThrow(
      'Verified TEST file metadata or permitted purpose unavailable');
    expect(()=>fileSafe(fileObj(true),null,'test')).toThrow(
      'Verified TEST file metadata or permitted purpose unavailable');
    expect(fileSafe(fileObj(true),null,'live'))
      .toMatchObject({id:'file_D6FAKE'});
    expect(()=>fileSafe(fileObj(false),null,'live')).toThrow(
      'Verified LIVE file metadata or permitted purpose unavailable');
  });
});

describe('CAP-4 D-6 Radar reads verify the connection mode',()=>{
  it('serves verified LIVE warnings, reviews, lists and items',
    async()=>{
    const s=sdk({warn:warning(true),rev:review(true),
      vlist:valueList(true),vitem:valueItem(true)}),
      ctx=await liveCtx(s);
    const warnings=parse(await radarHandlers
      .radar_list_fraud_warnings({limit:10},ctx));
    expect(warnings.data[0]).toMatchObject({id:'issfr_D6FAKE',
      charge:'ch_D6FAKE',actionable:true});
    expect(parse(await radarHandlers.radar_get_fraud_warning(
      {warningId:'issfr_D6FAKE'},ctx)).id).toBe('issfr_D6FAKE');
    const reviews=parse(await radarHandlers.radar_list_reviews(
      {},ctx));
    expect(reviews.data[0]).toMatchObject({id:'prv_D6FAKE',open:true,
      paymentIntent:'pi_D6FAKE'});
    expect(parse(await radarHandlers.radar_get_review(
      {reviewId:'prv_D6FAKE'},ctx)).open).toBe(true);
    const lists=parse(await radarHandlers.radar_list_value_lists(
      {},ctx));
    expect(lists.data[0]).toMatchObject({id:'rsl_D6FAKE',
      itemType:'email',itemCount:1});
    const items=parse(await radarHandlers.radar_list_list_items(
      {valueListId:'rsl_D6FAKE',limit:4},ctx));
    expect(s.radar.valueListItems.list).toHaveBeenCalledWith(
      {limit:4,value_list:'rsl_D6FAKE'});
    expect(items.data[0]).toMatchObject({id:'rsli_D6FAKE',
      valueListId:'rsl_D6FAKE',hasValue:true});
  });
  it('never exposes raw Radar values in either mode (invariant 2)',
    async()=>{
    for(const makeCtx of [async s=>testCtx(s),liveCtx]){
      const livemode=makeCtx===liveCtx;
      const s=sdk({warn:warning(livemode),rev:review(livemode),
        vlist:valueList(livemode),vitem:valueItem(livemode)}),
        ctx=await makeCtx(s);
      const serialized=JSON.stringify([
        await radarHandlers.radar_list_fraud_warnings({},ctx),
        await radarHandlers.radar_get_fraud_warning(
          {warningId:'issfr_D6FAKE'},ctx),
        await radarHandlers.radar_list_reviews({},ctx),
        await radarHandlers.radar_get_review(
          {reviewId:'prv_D6FAKE'},ctx),
        await radarHandlers.radar_list_value_lists({},ctx),
        await radarHandlers.radar_list_list_items(
          {valueListId:'rsl_D6FAKE'},ctx)]);
      expect(serialized).not.toMatch(/SECRET_/);
      const items=parse(await radarHandlers.radar_list_list_items(
        {valueListId:'rsl_D6FAKE'},ctx));
      expect(items.data[0]).not.toHaveProperty('value');
      expect(Object.keys(items.data[0]).sort()).toEqual(
        ['createdAt','hasValue','id','valueListId']);
    }
  });
  it('refuses wrong-mode Radar records on both connection modes',
    async()=>{
    const sLive=sdk({rev:review(false)}),ctxLive=await liveCtx(sLive);
    expect((await radarHandlers.radar_list_reviews({},ctxLive))
      .isError).toBe(true);
    expect(sLive.reviews.list).toHaveBeenCalled();
    const sTest=sdk({warn:warning(true)}),ctxTest=testCtx(sTest);
    expect((await radarHandlers.radar_get_fraud_warning(
      {warningId:'issfr_D6FAKE'},ctxTest)).isError).toBe(true);
    expect(sTest.radar.earlyFraudWarnings.retrieve)
      .toHaveBeenCalledWith('issfr_D6FAKE');
    const sItems=sdk({vitem:valueItem(true)}),ctxItems=testCtx(sItems);
    expect((await radarHandlers.radar_list_list_items(
      {valueListId:'rsl_D6FAKE'},ctxItems)).isError).toBe(true);
  });
  it('keeps the Radar projection no-mode contract byte-identical',()=>{
    expect(reviewSafe(review(false))).toMatchObject({id:'prv_D6FAKE',
      open:true});
    expect(()=>reviewSafe(review(true))).toThrow(
      'Cannot verify exact TEST Radar record');
    expect(reviewSafe(review(true),'live'))
      .toMatchObject({id:'prv_D6FAKE'});
    expect(()=>warningSafe(warning(false),'live')).toThrow(
      'Cannot verify exact LIVE Radar record');
    expect(valueListSafe(valueList(false)))
      .toMatchObject({itemCount:1});
    expect(valueItemSafe(valueItem(false)))
      .toMatchObject({hasValue:true});
  });
});

describe('CAP-4 D-6 family registration and descriptions',()=>{
  it('registers the twelve read tools once, all naming both modes',
    ()=>{
    const all=[...reportTools,...resultFileTools,...fileTools,
      ...radarTools];
    expect(all.map(t=>t.name)).toEqual([
      'report_list_types','report_list_runs','report_get_run',
      'report_get_result_file','file_list','file_get',
      'radar_list_fraud_warnings','radar_get_fraud_warning',
      'radar_list_reviews','radar_get_review',
      'radar_list_value_lists','radar_list_list_items']);
    for(const t of all){
      expect(t.writes).toBe(false);
      expect(t.description).toContain('TEST');
      expect(t.description).toContain('LIVE');
      expect(registry.tools.filter(x=>x.name===t.name))
        .toHaveLength(1);
    }
  });
});
