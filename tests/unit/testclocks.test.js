import {describe,it,expect} from 'vitest';
import {handlers,makeTestClockWrite} from '../../src/tools/testclocks.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const parse=x=>JSON.parse(x.content[0].text);
const frozenTime=1700000000,clockId='clock_FAKE123';
function fixture(opts={}){
  const db=createFakeDb({accounts:[{id:'acct_safefixture',label:'Test'}]});
  const calls=[],map=new Map(),idempotency=new Map();
  const clock={id:clockId,object:'test_helpers.test_clock',
    name:'RTC DEV Subscription Simulation',frozen_time:frozenTime,
    status:'ready',livemode:false,deletes_after:frozenTime+200000};
  map.set(clockId,clock);
  const sdk={testHelpers:{testClocks:{
    create:async(p,o)=>{
      if(!o?.idempotencyKey)throw Error('idempotency required');
      calls.push(['create',p,o.idempotencyKey]);
      if(idempotency.has(o.idempotencyKey))return idempotency.get(o.idempotencyKey);
      const value={...clock,name:p.name,frozen_time:p.frozen_time,
        ...opts.created};
      map.set(clockId,value);idempotency.set(o.idempotencyKey,value);return value;
    },
    retrieve:async id=>{
      calls.push(['retrieve',id]);return {...(map.get(id)??clock),...opts.read,
        ...(opts.readAfter&&calls.some(x=>x[0]==='advance')?opts.readAfter:{})};
    },
    advance:async(id,p,o)=>{
      if(!o?.idempotencyKey)throw Error('idempotency required');
      calls.push(['advance',id,p,o.idempotencyKey]);
      const after={...map.get(id),status:'advancing',
        status_details:{advancing:{target_frozen_time:p.frozen_time}}};
      map.set(id,after);return after;
    },
    list:async a=>{calls.push(['list',a]);return {data:[map.get(clockId)],
      has_more:false};}
  }}};
  const ctx={connection:{mode:'test',stripeAccount:'acct_safefixture',profile:'full'},
    connectionId:'clock-connection',db,services:{stripeForConnection:async()=>sdk}};
  return {ctx,map,calls,db,sdk};
}
describe('V-1b4c guarded TEST clock dependency',()=>{
  it('lists provider status and allows an exact clock lookup',async()=>{
    const f=fixture();
    expect(parse(await handlers.testclock_list({},f.ctx)).data[0]).toMatchObject({
      id:clockId,status:'ready',frozenTime});
    expect(parse(await handlers.testclock_list({clockId},f.ctx)).clock.id).toBe(clockId);
  });
  it('dryRun and unconfirmed create never invoke provider writes',async()=>{
    const f=fixture(),op=makeTestClockWrite('create');
    expect(parse(await op.handler({frozenTime,dryRun:true},f.ctx)).preview).toContain('TEST MODE');
    expect(parse(await op.handler({frozenTime},f.ctx)).needsConfirmation).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
  it('confirmed creation uses provider idempotency and independently verifies frozen time',async()=>{
    const f=fixture(),op=makeTestClockWrite('create');
    const answer=parse(await op.handler({frozenTime,confirm:true,requestKey:'first'},f.ctx));
    expect(answer.done).toBe(true);
    expect(f.calls.map(x=>x[0])).toEqual(['create','retrieve']);
    expect(f.calls[0][2]).toMatch(/^rmcp_/);
    expect((await f.db.listAuditForTest()).length).toBeGreaterThanOrEqual(2);
  });
  it('read-back mismatch cannot declare clock creation complete',async()=>{
    const f=fixture({read:{frozen_time:frozenTime+100}});
    const result=parse(await makeTestClockWrite('create').handler({
      frozenTime,confirm:true,requestKey:'bad'},f.ctx));
    expect(result.done).toBe(false);
  });
  it('advance previews current clock and does not write without confirmation',async()=>{
    const f=fixture(),a={clockId,frozenTime:frozenTime+86400};
    expect(parse(await makeTestClockWrite('advance').handler({...a,dryRun:true},f.ctx))
      .preview).toContain('Stripe may advance asynchronously');
    expect(f.calls.every(x=>x[0]==='retrieve')).toBe(true);
  });
  it('advancing state never falsely reports that time travel has finished',async()=>{
    const f=fixture(),a={clockId,frozenTime:frozenTime+86400,confirm:true};
    const result=parse(await makeTestClockWrite('advance').handler(a,f.ctx));
    expect(result.done).toBe(false);
    expect(f.calls.map(x=>x[0])).toEqual(['retrieve','advance','retrieve']);
    const actual=parse(await handlers.testclock_list({clockId},f.ctx));
    expect(actual.clock).toMatchObject({status:'advancing',
      targetFrozenTime:frozenTime+86400,frozenTime});
  });
  it('confirms completion only if Stripe independently reports ready at target',async()=>{
    const f=fixture({readAfter:{status:'ready',frozen_time:frozenTime+86400}});
    const result=parse(await makeTestClockWrite('advance').handler({
      clockId,frozenTime:frozenTime+86400,confirm:true},f.ctx));
    expect(result.done).toBe(true);
  });
  it('rejects other TEST clock ownership, advancing/inconsistent time and invalid input',async()=>{
    for(const change of [
      {name:'Some application clock'},
      {status:'advancing'},
      {frozen_time:1700100000}
    ]){
      const f=fixture({read:change});
      await expect(makeTestClockWrite('advance').handler({
        clockId,frozenTime:1700086400,confirm:true},f.ctx)).rejects.toThrow();
      expect(f.calls.every(x=>x[0]==='retrieve')).toBe(true);
    }
    const f=fixture();
    await expect(makeTestClockWrite('create').handler({
      frozenTime,name:'???',confirm:true},f.ctx)).rejects.toThrow();
    expect(f.calls).toHaveLength(0);
  });
  it('refuses LIVE before touching the provider for every clock tool',async()=>{
    for(const name of ['testclock_create','testclock_advance','testclock_list']){
      const f=fixture();f.ctx.connection.mode='live';
      expect((await handlers[name]({clockId,frozenTime,confirm:true},f.ctx)).isError).toBe(true);
      expect(f.calls).toHaveLength(0);
    }
  });
  it('read_only profile cannot use any clock write',async()=>{
    const f=fixture();f.ctx.connection.profile='read_only';
    const result=parse(await makeTestClockWrite('create').handler({
      frozenTime,confirm:true},f.ctx));
    expect(result.done).toBe(false);
    expect(f.calls).toHaveLength(0);
  });
  it('fails closed when audit store is unavailable',async()=>{
    const f=fixture();f.ctx.db={};
    const result=parse(await makeTestClockWrite('create').handler({
      frozenTime,confirm:true},f.ctx));
    expect(result.done).toBe(false);
    expect(f.calls).toHaveLength(0);
  });
});
