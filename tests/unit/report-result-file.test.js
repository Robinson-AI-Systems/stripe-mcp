import {describe,it,expect,vi} from 'vitest';
import {tools,handlers} from '../../src/tools/report-result-file.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const runId='frr_FAKE1234',fileId='file_FAKE1234';
const parse=response=>JSON.parse(response.content[0].text);
const run={object:'reporting.report_run',id:runId,livemode:false,
  status:'succeeded',report_type:'balance.summary.1',
  result:{id:fileId,object:'file',url:'https://files.stripe.com/never-copy'}};
const file={object:'file',id:fileId,purpose:'finance_report_run',
  size:1024,created:1680203749,type:'csv',filename:'balance.csv',
  url:'https://files.stripe.com/v1/private-token/contents',
  links:{data:[{url:'https://secret.invalid/private-signed-link'}]},
  account_number:'SHOULD_NOT_LEAK'};
function fixture(){
  const api={
    reporting:{reportRuns:{retrieve:vi.fn(async()=>run)}},
    files:{retrieve:vi.fn(async()=>file)}
  };
  const ctx={connection:{stripeAccount:'acct_TESTREPORT',mode:'test',profile:'read_only'},
    services:{stripeForConnection:async()=>api}};
  return {api,ctx,call:(args={runId},context=ctx)=>
    handlers.report_get_result_file(args,context)};
}
describe('G-1f secure verified report-file metadata',()=>{
  it('registers a read-only, non-money result tool exactly once',()=>{
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({name:'report_get_result_file',writes:false});
    expect(tools[0].profiles).toContain('read_only');
    expect(registry.tools.filter(x=>x.name===tools[0].name)).toHaveLength(1);
  });
  it('retrieves only the exact completed report result and projects safe metadata',async()=>{
    const f=fixture();
    const result=parse(await f.call());
    expect(result).toMatchObject({available:true,runId,fileId,
      purpose:'finance_report_run',sizeBytes:1024,filename:'balance.csv',
      downloadUrl:null,downloadUrlAvailable:false});
    expect(f.api.reporting.reportRuns.retrieve).toHaveBeenCalledWith(runId);
    expect(f.api.files.retrieve).toHaveBeenCalledWith(fileId);
    const text=JSON.stringify(result);
    for(const secret of ['files.stripe.com','secret.invalid','SHOULD_NOT_LEAK',
      'private-token','account_number'])expect(text).not.toContain(secret);
  });
  it('refuses a forged file ID and a file with a different purpose',async()=>{
    const f=fixture();
    f.api.files.retrieve.mockResolvedValueOnce({...file,id:'file_OTHER123'});
    expect((await f.call()).isError).toBe(true);
    f.api.files.retrieve.mockResolvedValueOnce({...file,purpose:'identity_document'});
    expect((await f.call()).isError).toBe(true);
    expect(f.api.files.retrieve).toHaveBeenCalledTimes(2);
  });
  it('never downloads pending, failed, mismatched or LIVE report results',async()=>{
    for(const status of ['pending','failed']){
      const f=fixture();
      f.api.reporting.reportRuns.retrieve.mockResolvedValue({...run,status,result:null});
      const result=parse(await f.call());
      expect(result).toMatchObject({available:false,runStatus:status,downloadUrl:null});
      expect(f.api.files.retrieve).not.toHaveBeenCalled();
    }
    const foreign=fixture();
    foreign.api.reporting.reportRuns.retrieve.mockResolvedValue({...run,id:'frr_OTHER123'});
    expect((await foreign.call()).isError).toBe(true);
    expect(foreign.api.files.retrieve).not.toHaveBeenCalled();
    const live=fixture();
    expect((await live.call({runId},{...live.ctx,
      connection:{...live.ctx.connection,mode:'live'}})).isError).toBe(true);
    expect(live.api.reporting.reportRuns.retrieve).not.toHaveBeenCalled();
  });
  it('rejects unexpected input and incomplete succeeded report files',async()=>{
    const f=fixture();
    expect((await f.call({runId,fileId})).isError).toBe(true);
    expect((await f.call({runId:'bad'})).isError).toBe(true);
    f.api.reporting.reportRuns.retrieve.mockResolvedValue({...run,result:null});
    expect((await f.call()).isError).toBe(true);
    expect(f.api.files.retrieve).not.toHaveBeenCalled();
  });
  it('is reachable through the standard read-only dispatch, not a privileged bypass',async()=>{
    const f=fixture(),response=await dispatchReadOnlyTool({
      registry,name:'report_get_result_file',args:{runId},
      connection:f.ctx.connection,services:f.ctx.services,db:{}});
    expect(response.isError).toBeUndefined();
    expect(parse(response)).toMatchObject({fileId,downloadUrl:null});
  });
});
