import {describe,it,expect,vi} from 'vitest';
import {makeAdvanceWrite,inspectSimulation}
  from '../../src/tools/dev-simulation-advance.js';
const account='acct_SIMADVANCE',runId='run_'+'f'.repeat(24);
const args={action:'advance',runId,cycle:1,requestKey:'month-one'};
const frozen=1760000000,target=frozen+86400+60;
function fixture(ready=true){
  const rows=[],calls={sent:0};
  const ids={test_clock:'clock_FAKE',product:'prod_FAKE',price:'price_FAKE',
    customer:'cus_FAKE',subscription:'sub_FAKE'};
  const db={
    recordChange:async()=>{},
    getDevRunById:async({account:a})=>a===account?{
      id:runId,stripe_account:account,status:'completed',
      scenario:'subscription-simulation',size:3}:null,
    getDevRunObjects:async()=>Object.entries(ids).map(([type,object_id])=>({
      step_name:(type==='test_clock'?'clock':type)+'_1',
      object_type:type,object_id,cleaned:false})),
    getDevSimulationCycles:async()=>rows.map(x=>({...x})),
    reserveDevSimulationCycle:async a=>{
      if(rows.some(x=>x.cycle===a.cycle))return {cycle:a.cycle,newlyReserved:false};
      rows.push({cycle:a.cycle,requestKey:a.requestKey,
        targetFrozenTime:a.targetFrozenTime,state:'reserved'});
      return {cycle:a.cycle,newlyReserved:true};
    },
    beginDevSimulationCycle:async a=>{
      const found=rows.find(x=>x.cycle===a.cycle);
      if(found.state!=='reserved')return false;
      found.state='uncertain';return true;
    }
  };
  const s={testHelpers:{testClocks:{
    retrieve:vi.fn(async()=>({id:ids.test_clock,object:'test_helpers.test_clock',
      name:'RTC DEV RUN '+runId+' 1',livemode:false,status:ready?'ready':'advancing',
      frozen_time:frozen})),
    advance:vi.fn(async(_id,options,key)=>{
      expect(options).toEqual({frozen_time:target});
      expect(key.idempotencyKey).toMatch(/^rmcp_/);
      calls.sent++;return {id:ids.test_clock,status:'advancing',livemode:false};
    })
  }},subscriptions:{retrieve:vi.fn(async()=>({
    id:ids.subscription,object:'subscription',livemode:false,
    metadata:{rtc_run:runId},customer:ids.customer,test_clock:ids.test_clock,
    trial_end:frozen+86400,items:{has_more:false,data:[{
      price:ids.price,current_period_end:frozen+86400}]}
  }))}};
  const ctx={connection:{mode:'test',profile:'full',stripeAccount:account},
    db,services:{stripeForConnection:async()=>s}};
  return {ctx,calls,rows};
}
const parse=r=>JSON.parse(r.content[0].text);
describe('V-5c2 at-most-once TEST clock advance',()=>{
  it('shows preview, then records durable uncertainty before advancing',async()=>{
    const f=fixture(),op=makeAdvanceWrite();
    expect(parse(await op.handler({...args,dryRun:true},f.ctx)).preview)
      .toContain(String(target));
    expect(parse(await op.handler(args,f.ctx)).needsConfirmation).toBe(true);
    expect(f.calls.sent).toBe(0);
    const result=parse(await op.handler({...args,confirm:true},f.ctx));
    expect(result.done).toBe(false);
    expect(result.monthlyReceipt).toMatchObject({cycle:1,
      state:'uncertain',targetFrozenTime:target});
    expect(result.providerAcknowledged).toBe('advancing');
    expect(f.calls.sent).toBe(1);
  });
  it('cannot POST another clock move on confirmed retry',async()=>{
    const f=fixture(),op=makeAdvanceWrite();
    await op.handler({...args,confirm:true},f.ctx);
    const repeated=parse(await op.handler({...args,confirm:true},f.ctx));
    expect(repeated.monthlyReceipt.state).toBe('uncertain');
    expect(f.calls.sent).toBe(1);
    expect(f.rows).toHaveLength(1);
  });
  it('reads the ledger but does not infer invoice success from ready clock',async()=>{
    const f=fixture(),op=makeAdvanceWrite();
    await op.handler({...args,confirm:true},f.ctx);
    const status=parse(await inspectSimulation({action:'inspect',runId},f.ctx));
    expect(status.cycles[0].state).toBe('uncertain');
    expect(status.clock.status).toBe('ready');
    expect(status.note).toMatch(/does not prove/);
  });
  it('rejects early cycle, LIVE, foreign account, advancing clock',async()=>{
    const f=fixture();
    await expect(makeAdvanceWrite().handler({...args,cycle:2,
      requestKey:'second',confirm:true},f.ctx)).rejects.toThrow(/Previous/);
    expect((await makeAdvanceWrite().handler({...args,confirm:true},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    await expect(makeAdvanceWrite().handler({...args,confirm:true},{
      ...f.ctx,connection:{...f.ctx.connection,stripeAccount:'acct_OTHER'}}))
      .rejects.toThrow(/Completed/);
    await expect(makeAdvanceWrite().handler({...args,confirm:true},
      fixture(false).ctx)).rejects.toThrow(/TEST clock/);
    expect(f.calls.sent).toBe(0);
  });
});
