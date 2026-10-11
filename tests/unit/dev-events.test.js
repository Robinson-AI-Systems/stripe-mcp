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
    if(type==='price')obj.type=body.recurring?'recurring':'one_time';
    if(type==='payment_intent'){
      obj.status=body.confirm===false?'requires_confirmation':'succeeded';
      obj.amount_received=body.confirm===false?0:body.amount;
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
  const mutate=(type,id,fields,opts)=>{
    if(!opts?.idempotencyKey)throw Error('Missing mutation idempotency');
    if(byKey.has(opts.idempotencyKey))return byKey.get(opts.idempotencyKey);
    const before=get(id);
    if(before.object!==type)throw Error('Wrong provider type for TEST mutation');
    const changed={...before,...fields};
    objects.set(id,changed);byKey.set(opts.idempotencyKey,changed);
    calls.push({action:'mutate',type,id,fields,opts});return changed;
  };
  const sdk={
    products:{create:async(b,o)=>creates('product','prod',b,o),
      retrieve:async id=>get(id),
      update:async(id,b,o)=>mutate('product',id,b,o)},
    prices:{create:async(b,o)=>creates('price','price',b,o),
      retrieve:async id=>get(id),
      update:async(id,b,o)=>mutate('price',id,b,o)},
    customers:{create:async(b,o)=>creates('customer','cus',b,o),
      retrieve:async id=>get(id),
      update:async(id,b,o)=>mutate('customer',id,b,o)},
    paymentIntents:{create:async(b,o)=>{
      const pi=creates('payment_intent','pi',b,o);
      if(b.payment_method==='pm_card_createDispute'&&!pi.latest_charge){
        const ch=creates('charge','ch',{payment_intent:pi.id,
          customer:b.customer,amount:b.amount,currency:'usd',
          paid:true,status:'succeeded',disputed:false},
          {idempotencyKey:o.idempotencyKey+'_provider_charge'});
        const linked={...pi,latest_charge:ch.id};
        objects.set(pi.id,linked);return linked;
      }
      return get(pi.id);
    },
      retrieve:async id=>get(id),
      cancel:async(id,_params,o)=>mutate('payment_intent',id,{status:'canceled'},o),
      confirm:async(id,p,o)=>{
        if(p.payment_method!=='pm_card_chargeCustomerFail')
          throw Error('Wrong synthetic TEST declined card');
        await mutate('payment_intent',id,{status:'requires_payment_method',
          last_payment_error:{code:'card_declined',type:'card_error'}},o);
        throw Object.assign(new Error('TEST card declined'),{code:'card_declined'});
      }},
    checkout:{sessions:{
      create:async(b,o)=>creates('checkout.session','cs_test',{...b,
        status:'open',payment_status:'unpaid',amount_total:3600,
        currency:'usd',payment_intent:null,
        url:'https://checkout.stripe.com/c/pay/cs_test_FAKE123'},o),
      retrieve:async id=>get(id),
      expire:async(id,_p,o)=>mutate('checkout.session',id,
        {status:'expired',url:null},o)
    }},
    charges:{retrieve:async id=>get(id)},
    disputes:{retrieve:async id=>get(id),
      list:async({charge,limit})=>{
        calls.push({action:'disputes.list',charge,limit});
        return {data:[...objects.values()].filter(x=>
          x.object==='dispute'&&x.charge===charge),has_more:false};
      }},
    subscriptions:{
      create:async(b,o)=>{
        const invoice=creates('invoice','in',{status:'paid',amount_paid:0,
          currency:'usd',customer:b.customer,metadata:{}},
          {idempotencyKey:o.idempotencyKey+'_autoinvoice'});
        return creates('subscription','sub',{...b,status:'trialing',
          latest_invoice:invoice.id,items:{data:[{price:b.items[0].price}]}},o);
      },
      retrieve:async id=>get(id),
      cancel:async(id,_params,o)=>mutate('subscription',id,{status:'canceled'},o)
    },
    invoiceItems:{
      create:async(b,o)=>{
        const item=creates('invoiceitem','ii',b,o);
        const inv=get(b.invoice);
        objects.set(inv.id,{...inv,amount_due:3600,amount_remaining:3600});
        return item;
      },
      retrieve:async id=>get(id)
    },
    invoices:{
      create:async(b,o)=>creates('invoice','in',{...b,status:'draft',
        amount_due:0,amount_remaining:0,amount_paid:0,
        attempted:false,attempt_count:0},o),
      retrieve:async id=>get(id),
      update:async(id,b,o)=>mutate('invoice',id,b,o),
      finalizeInvoice:async(id,_params,o)=>mutate('invoice',id,
        {status:get(id).amount_due===3600?'open':'paid',auto_advance:false},o),
      pay:async(id,p,o)=>{
        if(p.payment_method!=='pm_card_chargeCustomerFail')
          throw Error('Unexpected TEST failed-invoice payment method');
        await mutate('invoice',id,{status:'open',attempted:true,
          attempt_count:1,amount_due:3600,amount_remaining:3600,
          amount_paid:0},o);
        throw Object.assign(new Error('TEST invoice decline'),{code:'card_declined'});
      }
    },
    events:{
      list:async({type,limit,...other})=>{
        calls.push({action:'events.list',type,limit,other});
        if(!visible)return {data:[],has_more:false};
        const sourceType=type.startsWith('checkout.session.')?
          'checkout.session':type.startsWith('charge.dispute.')?'dispute':
          type.startsWith('customer.subscription.')?
          'subscription':type.startsWith('payment_intent')?'payment_intent':
          type.split('.')[0],prefix=sourceType==='subscription'?'sub':
          sourceType==='customer'?'cus':
          sourceType==='payment_intent'?'pi':
          sourceType==='product'?'prod':
          sourceType==='invoice'?'in':sourceType==='dispute'?'du':
          sourceType==='checkout.session'?'cs_test':sourceType;
        const source=get(prefix+'_FAKE123');
        const event={object:'event',id:'evt_FAKE123',livemode:false,
          type,account,created:1700000000,data:{object:source}};
        return {data:[event],has_more:false};
      },
      retrieve:async id=>{
        calls.push({action:'events.retrieve',id});
        const sourceType=calledEvent.startsWith('checkout.session.')?
          'cs_test':calledEvent.startsWith('charge.dispute.')?'du':
          calledEvent.startsWith('invoice.')?'in':
          calledEvent.startsWith('customer.subscription.')?
          'sub':calledEvent.startsWith('payment_intent.')?'pi':
          calledEvent.startsWith('product.')?'prod':
          calledEvent.startsWith('price.')?'price':'cus';
        const source=get(sourceType+'_FAKE123');
        return {object:'event',id:'evt_FAKE123',livemode:false,
          type:calledEvent,account,data:{object:source}};
      }
    }
  };
  let calledEvent='customer.created';
  const realList=sdk.events.list;
  sdk.events.list=async a=>{calledEvent=a.type;return realList(a);};
  db.getDevRunById=async({account:a,id})=>
    a===account?[...runs.values()].find(x=>x.id===id)??null:null;
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
    showEvents:()=>{
      visible=true;
      const charge=objects.get('ch_FAKE123');
      if(charge&&!objects.has('du_FAKE123')){
        objects.set(charge.id,{...charge,disputed:true});
        creates('dispute','du',{charge:charge.id,
          payment_intent:'pi_FAKE123',amount:3600,currency:'usd',metadata:{}},
          {idempotencyKey:'stripe_async_dispute_fixture'});
      }
    },
    completeCheckout:()=>{
      const session=objects.get('cs_test_FAKE123');
      if(!session)throw Error('Cannot pay without TEST Checkout Session');
      const paid=creates('payment_intent','pi',{
        customer:session.customer,amount:3600,currency:'usd',
        confirm:true,payment_method:'pm_card_visa',
        metadata:{rtc_run:session.client_reference_id}
      },{idempotencyKey:'stripe_hosted_checkout_payment'});
      objects.set(session.id,{...session,status:'complete',
        payment_status:'paid',payment_intent:paid.id,url:null});
    },
    foreign:()=>{alterTag=true;}};
}
describe('V-3a real TEST provider event generation',()=>{
  it('lists only implemented triggers and refuses LIVE/unknown args',()=>{
    const f=fixture();
    expect(parse(handlers.dev_list_triggers({},f.ctx)).types.map(x=>x.type))
      .toEqual(triggerTypes);
    expect(triggerTypes).toEqual(['customer.created','product.created',
      'price.created','payment_intent.succeeded','customer.updated',
      'product.updated','price.updated','payment_intent.canceled',
      'customer.subscription.created','customer.subscription.deleted',
      'invoice.created','invoice.updated','invoice.finalized',
      'payment_intent.payment_failed','charge.dispute.created',
      'invoice.payment_failed','checkout.session.completed']);
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
  it.each(triggerTypes.filter(t=>
    t!=='charge.dispute.created'&&t!=='checkout.session.completed'))(
    '%s requires observed matching provider event, with durable retry',async type=>{
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
  it.each(['customer.updated','product.updated','price.updated',
    'payment_intent.canceled'])('runs %s as actual idempotent TEST mutation',async type=>{
    const f=fixture(),a=input(type),op=makeDevTriggerEventWrite();
    const first=parse(await op.handler({...a,confirm:true},f.ctx));
    expect(first.done).toBe(false);
    expect(f.calls.filter(c=>c.action==='mutate')).toHaveLength(1);
    const source=f.calls.filter(c=>c.action==='mutate')[0];
    expect(source.opts.idempotencyKey).toMatch(/^rmcp_/);
    if(type==='payment_intent.canceled'){
      expect(f.objects.get('pi_FAKE123')).toMatchObject({status:'canceled',
        amount_received:0});
      expect(f.calls.some(c=>c.action==='mutate'&&c.type==='payment_intent'))
        .toBe(true);
    }
    const saved=f.calls.filter(c=>c.action==='create').length;
    f.showEvents();
    expect(parse(await op.handler({...a,confirm:true},f.ctx)).done).toBe(true);
    expect(f.calls.filter(c=>c.action==='create')).toHaveLength(saved);
    expect(f.calls.filter(c=>c.action==='mutate')).toHaveLength(1);
  });
  it.each(['customer.subscription.created','customer.subscription.deleted'])(
    'records real TEST trial invoice and verifies %s from provider',async type=>{
      const f=fixture(),a=input(type),op=makeDevTriggerEventWrite();
      expect(parse(await op.handler({...a,confirm:true},f.ctx)).done).toBe(false);
      const run=[...f.runs.values()][0];
      expect(run.status).toBe('running');
      expect(f.ledger.get(run.id).map(x=>x.object_type)).toEqual([
        'product','price','customer','subscription','invoice']);
      expect(f.objects.get('in_FAKE123')).toMatchObject({
        status:'paid',amount_paid:0,metadata:{rtc_run:run.id}});
      expect(f.objects.get('sub_FAKE123')).toMatchObject({
        status:type.endsWith('.deleted')?'canceled':'trialing',
        metadata:{rtc_run:run.id}});
      if(type.endsWith('.deleted')){
        expect(f.calls.filter(x=>x.action==='mutate'&&
          x.type==='subscription')).toHaveLength(1);
      }else expect(f.calls.filter(x=>x.action==='mutate'&&
        x.type==='subscription')).toHaveLength(0);
      const created=f.calls.filter(x=>x.action==='create').length;
      f.showEvents();
      const finished=parse(await op.handler({...a,confirm:true},f.ctx));
      expect(finished.done).toBe(true);
      expect(f.calls.filter(x=>x.action==='create')).toHaveLength(created);
      expect(f.ledger.get(run.id).at(-1)).toMatchObject({
        object_type:'event',object_id:'evt_FAKE123'});
      expect(parse(await op.handler({...a,confirm:true},f.ctx)).done).toBe(true);
    });
  it('cannot create a subscription event when Stripe does not supply a trial invoice',async()=>{
    const f=fixture();
    const create=f.sdk.subscriptions.create;
    f.sdk.subscriptions.create=async(b,o)=>{
      const sub=await create(b,o);
      const without={...sub,latest_invoice:null};
      f.objects.set(sub.id,without);return without;
    };
    const out=parse(await makeDevTriggerEventWrite().handler({
      ...input('customer.subscription.created'),confirm:true},f.ctx));
    expect(out.done).toBe(false);
    expect([...f.runs.values()][0].status).toBe('running');
    const rows=[...f.ledger.values()][0];
    expect(rows.some(x=>x.object_type==='invoice')).toBe(false);
    expect(rows.some(x=>x.object_type==='subscription')).toBe(true);
  });
  it.each(['invoice.created','invoice.updated','invoice.finalized'])(
    'produces genuine zero-value %s event with no charges',async type=>{
      const f=fixture(),op=makeDevTriggerEventWrite(),a=input(type);
      const first=parse(await op.handler({...a,confirm:true},f.ctx));
      expect(first.done).toBe(false);
      const run=[...f.runs.values()][0];
      expect(run.status).toBe('running');
      const invoice=f.objects.get('in_FAKE123');
      expect(invoice).toMatchObject({amount_due:0,amount_paid:0,
        currency:'usd',metadata:{rtc_run:run.id}});
      expect(invoice.status).toBe(type==='invoice.finalized'?'paid':'draft');
      if(type==='invoice.updated')
        expect(invoice.description).toBe('RTC TEST Event Updated Invoice');
      expect(f.ledger.get(run.id).map(x=>x.object_type))
        .toEqual(['customer','invoice']);
      const mutations=f.calls.filter(c=>c.action==='mutate'&&c.type==='invoice');
      expect(mutations).toHaveLength(type==='invoice.created'?0:1);
      const numCreates=f.calls.filter(c=>c.action==='create').length;
      f.showEvents();
      expect(parse(await op.handler({...a,confirm:true},f.ctx)).done).toBe(true);
      expect(f.calls.filter(c=>c.action==='create')).toHaveLength(numCreates);
      expect(f.calls.filter(c=>c.action==='mutate'&&c.type==='invoice'))
        .toHaveLength(mutations.length);
      expect(f.calls.some(c=>c.type==='payment_intent')).toBe(false);
    });
  it('cannot claim a verified event when a zero-value draft invoice has a foreign run tag',async()=>{
    const f=fixture({foreign:true,showEvent:true});
    const a=input('invoice.created');
    const denied=parse(await makeDevTriggerEventWrite().handler({
      ...a,confirm:true},f.ctx));
    expect(denied.done).toBe(false);
    expect([...f.runs.values()][0].status).toBe('running');
    expect(f.ledger.size).toBe(0);
  });
  it('verifies real declined TEST attempt, exact event and safe idempotent retry',async()=>{
    const f=fixture(),a=input('payment_intent.payment_failed');
    const op=makeDevTriggerEventWrite();
    const preview=parse(await op.handler({...a,dryRun:true},f.ctx));
    expect(preview.preview).not.toContain('Money in: $36.00');
    const first=parse(await op.handler({...a,confirm:true},f.ctx));
    expect(first.done).toBe(false);
    expect(f.objects.get('pi_FAKE123')).toMatchObject({
      status:'requires_payment_method',amount_received:0,
      last_payment_error:{code:'card_declined'}});
    expect(f.ledger.get([...f.runs.values()][0].id)
      .map(x=>x.object_type)).toEqual(['customer','payment_intent']);
    expect(f.calls.filter(x=>x.action==='mutate'&&
      x.type==='payment_intent')).toHaveLength(1);
    expect(f.calls.filter(x=>x.action==='create'&&
      x.type==='payment_intent')[0].body).not.toHaveProperty('payment_method');
    f.showEvents();
    expect(parse(await op.handler({...a,confirm:true},f.ctx)).done).toBe(true);
    expect(f.calls.filter(x=>x.action==='mutate'&&
      x.type==='payment_intent')).toHaveLength(1);
    expect(f.ledger.get([...f.runs.values()][0].id).at(-1).object_type)
      .toBe('event');
  });
  it('does not verify a payment failure on unexpected provider error',async()=>{
    const f=fixture({showEvent:true}),a=input('payment_intent.payment_failed');
    f.sdk.paymentIntents.confirm=async()=>{throw Error('Stripe network unavailable');};
    const result=parse(await makeDevTriggerEventWrite().handler({
      ...a,confirm:true},f.ctx));
    expect(result.done).toBe(false);
    expect([...f.runs.values()][0].status).toBe('running');
    expect(f.ledger.get([...f.runs.values()][0].id)
      .some(x=>x.object_type==='event')).toBe(false);
  });
  it('cannot verify a fabricated payment failure without Stripe decline',async()=>{
    const f=fixture({showEvent:true}),a=input('payment_intent.payment_failed');
    f.sdk.paymentIntents.confirm=async(id,_p,o)=>
      f.sdk.paymentIntents.cancel(id,{},o);
    const result=parse(await makeDevTriggerEventWrite().handler({
      ...a,confirm:true},f.ctx));
    expect(result.done).toBe(false);
    expect([...f.runs.values()][0].status).toBe('running');
  });
  it('observes provider-native TEST dispute only after independent charge and event evidence',async()=>{
    const f=fixture(),a=input('charge.dispute.created'),op=makeDevTriggerEventWrite();
    const first=parse(await op.handler({...a,confirm:true},f.ctx));
    expect(first.done).toBe(false);
    const run=[...f.runs.values()][0];
    expect(run.status).toBe('running');
    expect(f.ledger.get(run.id).map(x=>x.object_type))
      .toEqual(['customer','payment_intent','charge']);
    expect(f.objects.get('pi_FAKE123')).toMatchObject({status:'succeeded',
      amount_received:3600,latest_charge:'ch_FAKE123'});
    expect(f.objects.get('ch_FAKE123')).toMatchObject({
      disputed:false,payment_intent:'pi_FAKE123'});
    expect(f.calls.filter(x=>x.action==='create'&&
      x.type==='payment_intent')[0].body.payment_method)
      .toBe('pm_card_createDispute');
    const createsBefore=f.calls.filter(x=>x.action==='create'&&
      x.type==='payment_intent').length;
    f.showEvents();
    const second=parse(await op.handler({...a,confirm:true},f.ctx));
    expect(second.done).toBe(true);
    expect(f.ledger.get(run.id).map(x=>x.object_type))
      .toEqual(['customer','payment_intent','charge','dispute','event']);
    expect(f.calls.filter(x=>x.action==='create'&&
      x.type==='payment_intent')).toHaveLength(createsBefore);
    expect(f.calls.filter(x=>x.action==='events.retrieve')).toHaveLength(1);
    expect(run.status).toBe('completed');
  });
  it('rejects a foreign TEST dispute charge before ever recording the dispute',async()=>{
    const f=fixture(),a=input('charge.dispute.created'),op=makeDevTriggerEventWrite();
    expect(parse(await op.handler({...a,confirm:true},f.ctx)).done).toBe(false);
    f.showEvents();
    f.objects.set('ch_FAKE123',{...f.objects.get('ch_FAKE123'),
      payment_intent:'pi_FOREIGN'});
    const result=parse(await op.handler({...a,confirm:true},f.ctx));
    expect(result.done).toBe(false);
    expect([...f.ledger.values()][0].some(x=>x.object_type==='dispute'))
      .toBe(false);
  });
  it('creates one TEST $36 invoice item and positively observes native invoice failure',async()=>{
    const f=fixture(),a=input('invoice.payment_failed'),op=makeDevTriggerEventWrite();
    const preview=parse(await op.handler({...a,dryRun:true},f.ctx));
    expect(preview.preview).not.toContain('Money in: $36.00');
    const first=parse(await op.handler({...a,confirm:true},f.ctx));
    expect(first.done).toBe(false);
    const run=[...f.runs.values()][0];
    expect(run.status).toBe('running');
    expect(f.ledger.get(run.id).map(x=>x.object_type))
      .toEqual(['customer','invoice','invoice_item']);
    expect(f.objects.get('ii_FAKE123')).toMatchObject({
      invoice:'in_FAKE123',customer:'cus_FAKE123',amount:3600,
      metadata:{rtc_run:run.id}});
    expect(f.objects.get('in_FAKE123')).toMatchObject({
      status:'open',amount_due:3600,amount_remaining:3600,amount_paid:0,
      attempted:true,attempt_count:1,metadata:{rtc_run:run.id}});
    expect(f.calls.filter(x=>x.action==='mutate'&&x.type==='invoice'))
      .toHaveLength(2);
    const created=f.calls.filter(x=>x.action==='create').length;
    f.showEvents();
    expect(parse(await op.handler({...a,confirm:true},f.ctx)).done).toBe(true);
    expect(f.calls.filter(x=>x.action==='create')).toHaveLength(created);
    expect(f.calls.filter(x=>x.action==='mutate'&&x.type==='invoice'))
      .toHaveLength(2);
    expect(f.ledger.get(run.id).at(-1).object_type).toBe('event');
  });
  it('refuses successful/foreign attempted TEST invoice state as payment failure',async()=>{
    const f=fixture({showEvent:true}),a=input('invoice.payment_failed');
    const original=f.sdk.invoices.pay;
    f.sdk.invoices.pay=async(id,_b,o)=>{
      await original(id,{payment_method:'pm_card_chargeCustomerFail'},o)
        .catch(()=>{});
      f.objects.set(id,{...f.objects.get(id),status:'paid',
        amount_paid:3600,amount_remaining:0});
      return f.objects.get(id);
    };
    const r=parse(await makeDevTriggerEventWrite().handler({...a,confirm:true},f.ctx));
    expect(r.done).toBe(false);
    expect(f.ledger.get([...f.runs.values()][0].id)
      .some(x=>x.object_type==='event')).toBe(false);
  });
  it('keeps hosted TEST Checkout pending until real session and PI are paid and Event observed',async()=>{
    const f=fixture(),a=input('checkout.session.completed');
    const op=makeDevTriggerEventWrite();
    const first=parse(await op.handler({...a,confirm:true},f.ctx));
    expect(first.done).toBe(false);
    const run=[...f.runs.values()][0];
    expect(run.status).toBe('running');
    expect(f.ledger.get(run.id).map(x=>x.object_type))
      .toEqual(['product','price','customer','checkout_session']);
    expect(f.objects.get('cs_test_FAKE123')).toMatchObject({
      object:'checkout.session',status:'open',payment_status:'unpaid',
      customer:'cus_FAKE123',amount_total:3600,
      client_reference_id:run.id,metadata:{rtc_run:run.id}});
    expect(f.calls.filter(x=>x.action==='create'&&
      x.type==='payment_intent')).toHaveLength(0);
    const count=f.calls.filter(x=>x.action==='create').length;
    f.completeCheckout();
    expect(f.objects.get('pi_FAKE123')).toMatchObject({
      status:'succeeded',amount_received:3600,
      metadata:{rtc_run:run.id}});
    expect(parse(await op.handler({...a,confirm:true},f.ctx)).done)
      .toBe(false); // full payment still cannot prove Stripe Event
    expect(f.ledger.get(run.id).at(-1).object_type).toBe('payment_intent');
    f.showEvents();
    expect(parse(await op.handler({...a,confirm:true},f.ctx)).done).toBe(true);
    expect(f.calls.filter(x=>x.action==='create')).toHaveLength(count+1);
    expect(f.ledger.get(run.id).at(-1).object_type).toBe('event');
    expect(run.status).toBe('completed');
  });
  it('refuses unpaid Checkout even when an Event appears in provider listing',async()=>{
    const f=fixture({showEvent:true}),a=input('checkout.session.completed');
    const r=parse(await makeDevTriggerEventWrite().handler({...a,confirm:true},f.ctx));
    expect(r.done).toBe(false);
    expect([...f.ledger.values()][0].some(x=>x.object_type==='event'))
      .toBe(false);
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
