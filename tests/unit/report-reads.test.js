import {describe,it,expect,vi} from 'vitest';
import {tools,handlers} from '../../src/tools/report-reads.js';
import {registry} from '../../src/tools/index.js';
const parse=r=>JSON.parse(r.content[0].text);
const reportType={id:'balance.summary.1',object:'reporting.report_type',
  data_available_start:1680000000,data_available_end:1690000000,
  default_columns:['category','net_amount'],livemode:false,name:'Balance Summary',version:1};
const record={id:'frr_FAKE1234',object:'reporting.report_run',
  livemode:false,created:1680020000,status:'succeeded',
  report_type:'balance.summary.1',parameters:{interval_start:1680000000,
    interval_end:1680010000},result:'file_FAKE1234',error:null,succeeded_at:1680021000};
function fixture(){
  const api={reportTypes:{list:vi.fn(async()=>({object:'list',data:[reportType],has_more:false}))},
    reportRuns:{list:vi.fn(async()=>({object:'list',data:[record],has_more:false})),
      retrieve:vi.fn(async()=>record)}};
  const ctx={connection:{mode:'test',profile:'read_only',stripeAccount:'acct_TEST'},
    services:{stripeForConnection:async()=>({reporting:api})}};
  return {api,ctx,call:(name,args={})=>handlers[name](args,ctx)};
}
describe('G-1d1 provider-verified TEST report reads',()=>{
  it('registers unique read-only tools available to read_only profile',()=>{
    expect(tools.map(x=>x.name)).toEqual([
      'report_list_types','report_list_runs','report_get_run']);
    for(const t of tools){
      expect(t.writes).toBe(false);
      expect(t.profiles).toContain('read_only');
      expect(registry.tools.filter(x=>x.name===t.name)).toHaveLength(1);
    }
  });
  it('returns bounded provider types with coverage and no secrets',async()=>{
    const f=fixture(),result=parse(await f.call('report_list_types',{limit:1}));
    expect(result.data).toMatchObject([{id:'balance.summary.1',
      dataAvailableStart:1680000000,defaultColumns:['category','net_amount']}]);
    expect(result.has_more).toBe(false);
    expect(f.api.reportTypes.list).toHaveBeenCalledOnce();
  });
  it('honors deterministic local paging with explicit cursor and rejects mismatch',async()=>{
    const f=fixture();
    f.api.reportTypes.list.mockResolvedValue({data:[
      reportType,{...reportType,id:'balance.itemized.1'},
      {...reportType,id:'balance.summary.2'}],has_more:false});
    const first=parse(await f.call('report_list_types',{limit:2}));
    expect(first.data.map(x=>x.id)).toEqual(['balance.itemized.1','balance.summary.1']);
    expect(first.has_more).toBe(true);
    const second=parse(await f.call('report_list_types',{
      limit:2,starting_after:first.next}));
    expect(second.data.map(x=>x.id)).toEqual(['balance.summary.2']);
    expect((await f.call('report_list_types',{starting_after:'invalid.id.1'})).isError)
      .toBe(true);
  });
  it('keeps nullable or absent actual provider report columns unverified without hiding the usable type',async()=>{
    const f=fixture();
    f.api.reportTypes.list.mockResolvedValue({data:[
      {...reportType,default_columns:null},
      {...reportType,id:'balance.summary.2',default_columns:undefined}
    ],has_more:false});
    const res=parse(await f.call('report_list_types',{}));
    expect(res.data).toHaveLength(2);
    expect(res.data.every(x=>x.defaultColumns===null&&
      x.defaultColumnsVerified===false)).toBe(true);
    f.api.reportTypes.list.mockResolvedValue({data:[
      {...reportType,default_columns:['unexpected newline\\n']}
    ],has_more:false});
    expect((await f.call('report_list_types',{})).isError).toBe(true);
  });
  it('runs list/retrieve project only file IDs, never a Stripe file URL',async()=>{
    const f=fixture(),res=parse(await f.call('report_list_runs',{limit:2}));
    expect(res.data[0]).toMatchObject({id:record.id,status:'succeeded',
      resultFileId:'file_FAKE1234',downloadUrl:null});
    expect(f.api.reportRuns.list).toHaveBeenCalledWith({limit:2});
    expect(parse(await f.call('report_get_run',{runId:record.id})).resultFileId)
      .toBe('file_FAKE1234');
    expect(JSON.stringify(res)).not.toContain('files.stripe.com');
  });
  it('refuses malformed, LIVE or non-report provider responses',async()=>{
    const f=fixture();
    expect((await f.call('report_get_run',{runId:'notid'})).isError).toBe(true);
    expect((await f.call('report_list_runs',{limit:101})).isError).toBe(true);
    expect((await handlers.report_list_runs({},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    f.api.reportRuns.retrieve.mockResolvedValue({...record,livemode:true});
    expect((await f.call('report_get_run',{runId:record.id})).isError).toBe(true);
    f.api.reportTypes.list.mockResolvedValue({data:[
      {...reportType,data_available_start:'bad'}],has_more:false});
    expect((await f.call('report_list_types',{})).isError).toBe(true);
  });
});
