// A real registered read-only TEST tool gives exact run/cleanup linkage.
// The ledger is not a substitute for independent Stripe provider readback.
import {describe,it,expect} from 'vitest';
import {handlers,tools} from '../../src/tools/dev-seed.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const id='run_'+'a'.repeat(24),account='acct_RUNOWNER123';
const parse=r=>JSON.parse(r.content[0].text);
function fixture(){
  const seen=[];
  const run={id,stripe_account:account,scenario:'event-customer-created',
    status:'completed',size:1};
  const rows=[
    {step_name:'customer_1',object_type:'customer',object_id:'cus_RECORD123',cleaned:true},
    {step_name:'event_1',object_type:'event',object_id:'evt_RECORD123',cleaned:false}
  ];
  const db={
    async getDevRunById(query){seen.push(['run',query]);return query.account===account?run:null;},
    async getDevRunObjects(query){seen.push(['objects',query]);return query.account===account?rows:[];}
  };
  const connection={stripeAccount:account,mode:'test',profile:'read_only',listing:'catalog',
    resultScope:'11111111-1111-4111-8111-111111111111'};
  return {ctx:{connection,db},seen,db,connection,rows};
}
describe('V-3 developer run handoff and truthful ledger observability',()=>{
  it('registers an exact TEST read for all profiles but no new write authority',()=>{
    const tool=tools.find(t=>t.name==='dev_get_run');
    expect(tool).toMatchObject({writes:false,profiles:['read_only','everyday','full']});
    expect(registry.tools.filter(t=>t.name==='dev_get_run')).toHaveLength(1);
  });
  it('shows a safe tracked event and independently cleaned customer without guessing IDs',async()=>{
    const f=fixture();
    const reply=await handlers.dev_get_run({runId:id},f.ctx);
    expect(reply.isError).toBeUndefined();
    const report=parse(reply);
    expect(report).toMatchObject({runId:id,mode:'test',status:'completed',
      objectCount:2,cleanedCount:1,remainingCount:1,trackedObjects:[
        {step:'customer_1',resourceId:'cus_RECORD123',cleaned:true},
        {step:'event_1',resourceId:'evt_RECORD123',cleaned:false}
      ]});
    expect(report.evidence).toMatch(/independently verify/);
    expect(f.seen).toEqual([['run',{account,id}],['objects',{account,id}]]);
    expect(JSON.stringify(reply)).not.toMatch(/private|token|secret/i);
  });
  it('uses the real dispatcher on read_only but refuses foreign accounts and LIVE',async()=>{
    const f=fixture();
    const permitted=await dispatchReadOnlyTool({registry,name:'dev_get_run',
      args:{runId:id},...f.ctx,services:{}});
    expect(permitted.isError).toBeUndefined();
    expect(parse(permitted).remainingCount).toBe(1);
    const foreign=await handlers.dev_get_run({runId:id},{
      ...f.ctx,connection:{...f.connection,stripeAccount:'acct_FOREIGN123'}});
    expect(foreign.isError).toBe(true);
    const live=await handlers.dev_get_run({runId:id},{
      ...f.ctx,connection:{...f.connection,mode:'live'}});
    expect(live.isError).toBe(true);
  });
  it('rejects invalid/unknown IDs, untrusted ledger objects and absent database',async()=>{
    const f=fixture();
    for(const query of [{},{runId:'run_FOREIGN'},{runId:id,secret:true}])
      expect((await handlers.dev_get_run(query,f.ctx)).isError).toBe(true);
    expect((await handlers.dev_get_run({runId:id},{
      ...f.ctx,db:{}})).isError).toBe(true);
    f.rows[1].object_id='sk_test_do_not_return';
    const denied=await handlers.dev_get_run({runId:id},f.ctx);
    expect(denied.isError).toBe(true);
    expect(JSON.stringify(denied)).not.toContain('sk_test_do_not_return');
  });
});
