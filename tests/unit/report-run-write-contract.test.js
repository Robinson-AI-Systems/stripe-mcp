import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makeReportRunWrite,tools,handlers} from '../../src/tools/report-run-write.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
const id='balance.summary.1',parse=r=>JSON.parse(r.content[0].text);
const args={reportType:id,intervalStart:1680000000,intervalEnd:1680010000};
function fixture({appOwned=false,readBackMatches=true,limitCents=10000}={}){
  const db=createFakeDb({accounts:[{id:'acct_safefixture',
    label:'Fixture',money_limit_cents:limitCents}]});
  const provider={writes:[],afterCalls:0};
  let type={id,object:'reporting.report_type',livemode:false,
    data_available_start:1670000000,data_available_end:1690000000,
    metadata:appOwned?{agreementId:'ag_FAKE'}:{}};
  let created=null;
  const reporting={
    reportTypes:{retrieve:async()=>({...type})},
    reportRuns:{
      async create(p,opts){
        provider.writes.push({idempotencyKey:opts?.idempotencyKey,params:p});
        created={id:'frr_NEW1234',object:'reporting.report_run',
          report_type:p.report_type,status:'pending',livemode:false,
          parameters:p.parameters};
        return {...created};
      },
      async retrieve(){
        provider.afterCalls++;
        return readBackMatches?{...created}:{...created,report_type:'other.1'};
      }
    }
  };
  const ctx={db,connection:{stripeAccount:'acct_safefixture',mode:'test',profile:'full'},
    connectionId:'report-job-fixture',services:{stripeForConnection:async()=>({reporting})}};
  return {provider,db,ctx,setType:x=>{type={...type,...x};}};
}
describe('G-1d2 guarded report creation real-handler contract',()=>{
  runWriteContract({withMoney:false,strictArgs:true,args,
    tool:makeReportRunWrite,fixtures:fixture});
});
it('registers exactly one full-profile guarded report generation operation',()=>{
  expect(tools).toHaveLength(1);
  expect(tools[0]).toMatchObject({name:'report_run',writes:true,
    profiles:['full'],writeContract:'defineWrite-v1'});
  expect(registry.tools.filter(x=>x.name==='report_run')).toHaveLength(1);
});
it('reports pending creation truthfully, includes verified runId but never file URL',async()=>{
  const f=fixture();
  const res=parse(await handlers.report_run({...args,confirm:true,requestKey:'ok'},f.ctx));
  expect(res.confirmed).toBe(true);
  expect(res.reportCompleted).toBe(false);
  expect(res.reportStatus).toBe('pending');
  expect(res.runId).toBe('frr_NEW1234');
  expect(res.downloadUrl).toBeNull();
  expect(f.provider.writes).toHaveLength(1);
});
it('refuses unavailable interval or unsupported premium type before any write',async()=>{
  const f=fixture();
  await expect(handlers.report_run({...args,
    reportType:'identity.private.1',confirm:true},f.ctx)).rejects.toThrow();
  f.setType({data_available_end:1679999999});
  await expect(handlers.report_run({...args,confirm:true},f.ctx)).rejects.toThrow();
  expect(f.provider.writes).toHaveLength(0);
});
it('LIVE refused, invalid period and caller-controlled type prohibited',async()=>{
  const f=fixture();
  expect((await handlers.report_run(args,{
    ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
  await expect(handlers.report_run({...args,intervalEnd:args.intervalStart},f.ctx))
    .rejects.toThrow();
  expect(f.provider.writes).toHaveLength(0);
});
