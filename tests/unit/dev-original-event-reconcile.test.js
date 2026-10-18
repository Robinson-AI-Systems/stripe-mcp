import {describe,it,expect} from 'vitest';
import {planTrigger} from '../../src/dev/triggers.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {handlers,tools} from '../../src/tools/dev-original-event-reconcile.js';
import {registry} from '../../src/tools/index.js';
const account='acct_RECONCILE123',key='original-confirmed-event',eventId='evt_ORIGINAL123';
const parse=r=>JSON.parse(r.content[0].text);
function fixture({mode='test',profile='full',missingEvent=false,foreign=false,
  missingSource=false,finished=false,cleaned=true,unknownAfter=false}={}){
  const plan=planTrigger({type:'customer.created',requestKey:key},account);
  const run={id:plan.runId,stripe_account:foreign?'acct_FOREIGN':account,
    request_key:key,scenario:plan.scenario,plan_digest:plan.planDigest,
    status:finished?'completed':'running',size:1};
  const rows=missingSource?[]:[{step_name:'customer_1',object_type:'customer',
    object_id:'cus_ORIGINAL123',cleaned}];
  const customer={id:'cus_ORIGINAL123',object:'customer',livemode:false,
    metadata:{rtc_run:plan.runId}};
  const event={id:eventId,object:'event',type:'customer.created',
    livemode:false,data:{object:{...customer}}};
  const calls={list:0,get:0,write:0,events:0};
  const sdk={events:{
    list:async()=>{calls.list++;return {data:missingEvent?[]:[event],has_more:false};},
    retrieve:async id=>{calls.get++;if(unknownAfter&&run.status==='completed')
      return {...event,id:'evt_DIFFERENT'};
      expect(id).toBe(eventId);return event;}
  }};
  const db=createFakeDb({accounts:[{id:account,label:'Original TEST account'}]});
  db.getDevRunById=async({account:a,id})=>a===account&&id===run.id?{...run}:null;
  db.getDevRunObjects=async({account:a,id})=>a===account&&id===run.id?
    rows.map(x=>({...x})):null;
  db.reconcileVerifiedTriggerEvent=async({account:a,id,scenario,
    planDigest,expectedSteps,eventId:received})=>{
    calls.write++;
    if(a!==account||id!==run.id||run.stripe_account!==account||
      scenario!==run.scenario||planDigest!==run.plan_digest||
      expectedSteps!==plan.expectedSteps||run.status!=='running'||
      rows.length!==expectedSteps-1)return false;
    rows.push({step_name:'event_1',object_type:'event',
      object_id:received,cleaned:false});
    run.status='completed';return true;
  };
  const ctx={connection:{stripeAccount:account,mode,profile},
    connectionId:'synthetic-TEST',db,services:{stripeForConnection:async()=>{
      calls.events++;return sdk;}}};
  const args={runId:plan.runId,requestKey:'reconcile_'+plan.runId};
  return {plan,run,rows,args,ctx,calls,sdk,db,
    invoke:(a=args)=>handlers.dev_reconcile_original_event(a,ctx)};
}
describe('V-3 original Stripe Event ledger recovery (never a Stripe writer)',()=>{
  it('is an original native guarded TEST writer, not a bypass through direct dispatch',()=>{
    expect(tools[0].name).toBe('dev_reconcile_original_event');
    expect(tools[0].writeContract).toBe('defineWrite-v1');
    expect(tools[0].profiles).toEqual(['everyday','full']);
    expect(registry.tools.find(x=>x.name===tools[0].name)?.writes).toBe(true);
  });
  it('previews without SQL/Stripe mutations and explicitly confirms only actual Event',async()=>{
    const f=fixture();
    const preview=parse(await f.invoke());
    expect(preview).toMatchObject({done:false,needsConfirmation:true,mode:'test'});
    expect(preview.preview).toContain('Only the selected TEST evidence ledger changes');
    expect(f.calls.write).toBe(0);
    const done=parse(await f.invoke({...f.args,confirm:true}));
    expect(done).toMatchObject({done:true,confirmed:true,
      resourceId:f.plan.runId,mode:'test'});
    expect(f.calls.write).toBe(1);
    expect(f.rows.map(x=>x.step_name)).toEqual(['customer_1','event_1']);
    expect(f.rows[0].cleaned).toBe(true); // no cleanup ledger rollback
    expect(f.calls.list).toBe(2); // preview and confirmation independent
    expect(f.calls.get).toBeGreaterThan(0);
    const repeated=await f.invoke({...f.args,confirm:true})
      .catch(()=>({isError:true}));
    expect(repeated.isError===true||parse(repeated).done===false).toBe(true);
    expect(f.calls.write).toBe(1);
  });
  it('refuses missing/unverified Event, incomplete source, foreign owner and completed run',async()=>{
    for(const opts of [{missingEvent:true},{missingSource:true},
      {foreign:true},{finished:true}]){
      const f=fixture(opts);
      const result=await f.invoke({...f.args,confirm:true}).catch(()=>({isError:true}));
      expect(result.isError===true||parse(result).done===false).toBe(true);
      expect(f.calls.write).toBe(0);
    }
  });
  it('refuses LIVE, read_only and malformed retry/extra arguments before mutations',async()=>{
    for(const x of [{mode:'live'},{profile:'read_only'}]){
      const f=fixture(x);
      const out=await f.invoke({...f.args,confirm:true});
      expect(out.isError).toBe(true);
      expect(f.calls.write).toBe(0);
    }
    for(const args of [
      {runId:'run_FORGED',requestKey:'attempt',confirm:true},
      {runId:'run_'+'f'.repeat(24),requestKey:'not-original',confirm:true},
      {...fixture().args,secret:'unpermitted',confirm:true}
    ]){
      const f=fixture(),out=await f.invoke(args).catch(()=>({isError:true}));
      expect(out.isError===true||parse(out).done===false).toBe(true);
      expect(f.calls.write).toBe(0);
    }
  });
  it('never marks a changed original Event provider readback as confirmed',async()=>{
    const f=fixture({unknownAfter:true});
    const r=parse(await f.invoke({...f.args,confirm:true}));
    expect(r).toMatchObject({done:false,confirmed:false});
    expect(r.warning).toMatch(/uncertain|Read-back/i);
    expect(f.calls.write).toBe(1);
    // The ledger is updated, but no false proof was issued after changed Event.
    expect(f.run.status).toBe('completed');
  });
});
