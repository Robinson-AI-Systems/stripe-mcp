// V-3a actual guarded MCP handlers, recorded real action and matching event.
import {describe,it,expect} from 'vitest';
import {planTrigger,triggerTypes} from '../../src/dev/triggers.js';
import {makeDevTriggerEventWrite,handlers} from '../../src/tools/dev-events.js';
import {verifyCleanupIdentity} from '../../src/dev/cleanup.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const account='acct_FAKE123',input=(type='customer.created')=>({
  type,requestKey:'trigger-'+type
});
const parse=x=>JSON.parse(x.content[0].text);
function fixture({showEvent=false,foreign=false}={}){
  const db=createFakeDb({accounts:[{id:account,label:'TEST'}]});
  const runs=new Map(),objects=new Map(),byKey=new Map(),ledger=new Map(),calls=[];
  let visible=showEvent,alterTag=foreign;
  const creates=(type,prefix,body,opts)=>{
    if(!opts?.idempotencyKey)throw Error('Missing Stripe idempotency');
    if(byKey.has(opts.idempotencyKey))return byKey.get(opts.idempotencyKey);
    const id=prefix+'_FAKE123',obj={id,object:type,livemode:false,...body};
    if(type==='price')obj.type='one_time';
    if(type==='payment_intent'){
      obj.status='succeeded';obj.amount_received=body.amount;
    }
    if(alterTag)obj.metadata={rtc_run:'run_foreign'};
    calls.push({action:'create',type,id,opts,body});
    objects.set(id,obj);byKey.set(opts.idempotencyKey,obj);
    return obj;
  };
  const get=id=>{
    const o=objects.get(id);if(!o)throw Error('Missing TEST provider object '+id);
    return {...o};
  };
  const sdk={
    products:{create:async(b,o)=>creates('product','prod',b,o),
      retrieve:async id=>get(id)},
    prices:{create:async(b,o)=>creates('price','price',b,o),
      retrieve:async id=>get(id)},
    customers:{create:async(b,o)=>creates('customer','cus',b,o),
      retrieve:async id=>get(id)},
    paymentIntents:{create:async(b,o)=>creates('payment_intent','pi',b,o),
      retrieve:async id=>get(id)},
    events:{
      list:async({type,limit,...other})=>{
        calls.push({action:'events.list',type,limit,other});
        if(!visible)return {data:[],has_more:false};
        const sourceType=type.startsWith('payment_intent')?'payment_intent':
          type.split('.')[0],prefix=sourceType==='customer'?'cus':
          sourceType==='payment_intent'?'pi':
          sourceType==='product'?'prod':sourceType;
        const source=get(prefix+'_FAKE123');
        const event={object:'event',id:'evt_FAKE123',livemode:false,
          type,account,created:1700000000,data:{object:source}};
        return {data:[event],has_more:false};
      },
      retrieve:async id=>{
        calls.push({action:'events.retrieve',id});
        const source=[...objects.values()].at(-1);
        return {object:'event',id:'evt_FAKE123',livemode:false,
          type:calledEvent,account,data:{object:source}};
      }
    }
  };
  let calledEvent='customer.created';
  const realList=sdk.events.list;
  sdk.events.list=async a=>{calledEvent=a.type;return realList(a);};
  db.getDevRun=async({account:a,requestKey})=>
    a===account?runs.get(a+':'+requestKey)??null:null;
  db.ensureDevRun=async({id,account:a,requestKey,scenario,size,
    planDigest,connection})=>{
    const key=a+':'+requestKey;
    if(!runs.has(key))runs.set(key,{id,stripe_account:a,request_key:requestKey,
      scenario,size,plan_digest:planDigest,connection,status:'running',
      created_at:new Date()});
    const run=runs.get(key);
    if(run.plan_digest!==planDigest||run.scenario!==scenario)
      throw Error('Immutable run plan changed');
    return run;
  };
  db.getDevRunObjects=async({account:a,id})=>{
    if(a!==account||![...runs.values()].some(x=>x.id===id))return [];
    return (ledger.get(id)??[]).map(x=>({...x}));
  };
  db.recordDevRunObject=async({account:a,id,stepName,objectType,objectId})=>{
    if(a!==account||![...runs.values()].some(x=>x.id===id&&
      x.status==='running'))return false;
    const existing=ledger.get(id)??[];
    if(existing.some(x=>x.step_name===stepName||x.object_id===objectId))return false;
    existing.push({step_name:stepName,object_type:objectType,
      object_id:objectId,cleaned:false});
    ledger.set(id,existing);return true;
  };
  db.completeDevRun=async({account:a,id,expectedSteps})=>{
    const run=[...runs.values()].find(x=>x.id===id&&x.stripe_account===a);
    if(!run||run.status!=='running'||ledger.get(id)?.length!==expectedSteps)
      return false;
    run.status='completed';return true;
  };
  const ctx={connection:{stripeAccount:account,mode:'test',profile:'full'},
    connectionId:'event-connection',db,
    services:{stripeForConnection:async()=>sdk}};
  return {ctx,sdk,runs,ledger,calls,objects,
    showEvents:()=>{visible=true;},
    foreign:()=>{alterTag=true;}};
}
describe('V-3a real TEST provider event generation',()=>{
  it('lists only implemented triggers and refuses LIVE/unknown args',()=>{
    const f=fixture();
    expect(parse(handlers.dev_list_triggers({},f.ctx)).types.map(x=>x.type))
      .toEqual(triggerTypes);
    expect(triggerTypes).toEqual(['customer.created','product.created',
      'price.created','payment_intent.succeeded']);
    f.ctx.connection.mode='live';
    expect(handlers.dev_list_triggers({},f.ctx).isError).toBe(true);
    expect(handlers.dev_list_triggers({foo:true},f.ctx).isError).toBe(true);
  });
  it('previews actual provider action without writing Stripe or its run ledger',async()=>{
    const f=fixture(),p=input();
    const value=parse(await makeDevTriggerEventWrite().handler({
      ...p,dryRun:true},f.ctx));
    expect(value.preview).toContain('customer.created');
    expect(value.preview).toContain('UNKNOWN');
    expect(f.calls).toHaveLength(0);expect(f.runs.size).toBe(0);
  });
  it('unconfirmed invocation does not create any real TEST records',async()=>{
    const f=fixture();
    const out=parse(await makeDevTriggerEventWrite().handler(input(),f.ctx));
    expect(out.needsConfirmation).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
  it.each(triggerTypes)('%s requires observed matching provider event, with durable retry',async type=>{
    const f=fixture(),op=makeDevTriggerEventWrite(),args=input(type);
    const first=parse(await op.handler({...args,confirm:true},f.ctx));
    expect(first.done).toBe(false);
    const run=[...f.runs.values()][0];
    expect(run.status).toBe('running');
    const steps=planTrigger(args,account).steps;
    expect(f.ledger.get(run.id).map(x=>x.step_name))
      .toEqual(steps.slice(0,-1).map(x=>x.name));
    const creations=f.calls.filter(x=>x.action==='create').length;
    expect(creations).toBe(steps.length-1);
    f.showEvents();
    const completed=parse(await op.handler({...args,confirm:true},f.ctx));
    expect(completed.done).toBe(true);
    expect(f.calls.filter(x=>x.action==='create')).toHaveLength(creations);
    expect(f.calls.filter(x=>x.action==='events.retrieve')).toHaveLength(1);
    expect(f.ledger.get(run.id).at(-1)).toMatchObject({
      step_name:'event_1',object_type:'event',object_id:'evt_FAKE123',
      cleaned:false});
    expect(run.status).toBe('completed');
    expect(parse(await op.handler({...args,confirm:true},f.ctx)).done).toBe(true);
    expect(f.calls.filter(x=>x.action==='create')).toHaveLength(creations);
  });
  it('only payment_intent.succeeded previews synthetic incoming $36, never money-out',async()=>{
    const f=fixture(),a=input('payment_intent.succeeded');
    const v=parse(await makeDevTriggerEventWrite().handler({...a,dryRun:true},f.ctx));
    expect(v.preview).toContain('Money in: $36.00');
    expect(f.calls).toHaveLength(0);
  });
  it('cannot complete if an event belongs to a foreign run even with matching type',async()=>{
    const f=fixture({showEvent:true});
    const before=await makeDevTriggerEventWrite().handler({
      ...input(),confirm:true},f.ctx);
    expect(parse(before).done).toBe(true);
    const another=fixture({foreign:true,showEvent:true});
    const v=parse(await makeDevTriggerEventWrite().handler({
      ...input(),confirm:true},another.ctx));
    expect(v.done).toBe(false);
    expect([...another.runs.values()][0].status).toBe('running');
  });
  it('rejects unknown trigger types and changing immutable retry plan',()=>{
    expect(()=>planTrigger(input('refund.created'),account))
      .toThrow(/Unsupported TEST event/);
    expect(()=>planTrigger({...input(),requestKey:''},account)).toThrow();
    expect(()=>planTrigger({...input(),outsideApp:true},account)).toThrow();
    expect(()=>planTrigger(input(), 'acct_WRONG !')).toThrow();
  });
  it('never emits TEST provider writes through a LIVE or read_only connection',async()=>{
    for(const change of [{mode:'live'},{profile:'read_only'}]){
      const f=fixture();Object.assign(f.ctx.connection,change);
      const r=await handlers.dev_trigger_event({...input(),confirm:true},f.ctx);
      expect(parse(r).done).toBe(false);
      expect(f.calls).toHaveLength(0);
    }
  });
  it('V-2 cleanup verifies TEST event source tag and treats event as immutable',()=>{
    const args=input(),p=planTrigger(args,account),f=fixture();
    const row={step_name:'event_1',object_type:'event',object_id:'evt_FAKE123'};
    const event={object:'event',id:'evt_FAKE123',livemode:false,
      type:'customer.created',data:{object:{object:'customer',
        metadata:{rtc_run:p.runId}}}};
    const run={id:p.runId,stripe_account:account};
    expect(verifyCleanupIdentity(run,row,event)).toBeUndefined();
    expect(()=>verifyCleanupIdentity(run,row,{...event,data:{
      object:{metadata:{rtc_run:'run_foreign'}}}})).toThrow();
    expect(f.runs.size).toBe(0);
  });
});
