// Durable TEST cleanup: never guess IDs, initiate refunds, or infer deletions.
import {APP_METADATA_KEYS} from '../tools/app-guard.js';
import {cleanupTestConnectSeller,cleanupTestClock,gone,exactMissing} from './dependent-cleanup.js';
import {verifyRecordedTriggerRun} from './triggers.js';
const prefixes={product:'prod',price:'price',customer:'cus',subscription:'sub',
  invoice:'in',payment_intent:'pi',refund:'re',test_clock:'clock',
  connected_account:'acct',event:'evt',charge:'ch',dispute:'du',
  invoice_item:'ii',payment_method:'pm',checkout_session:'cs_test',setup_intent:'seti'};
const order={subscription:0,invoice:1,payment_intent:2,customer:3,price:4,
  product:5,refund:6,charge:7,dispute:8,event:9,invoice_item:1,
  connected_account:10,test_clock:11,checkout_session:0,payment_method:-1,setup_intent:2};
const types={product:'product',price:'price',customer:'customer',
  subscription:'subscription',invoice:'invoice',payment_intent:'payment_intent',
  refund:'refund',connected_account:'account',test_clock:'test_helpers.test_clock',
  event:'event',charge:'charge',dispute:'dispute',invoice_item:'invoiceitem',
  checkout_session:'checkout.session',payment_method:'payment_method',
  setup_intent:'setup_intent'};
const valid=(value,prefix)=>typeof value==='string'&&
  new RegExp('^'+prefix+'_[A-Za-z0-9]{2,100}$').test(value);
const fail=x=>{throw new TypeError(x);};
const maps={product:'products',price:'prices',customer:'customers',
  subscription:'subscriptions',invoice:'invoices',payment_intent:'paymentIntents',
  refund:'refunds',connected_account:'accounts',event:'events',
  charge:'charges',dispute:'disputes',invoice_item:'invoiceItems',
  payment_method:'paymentMethods',setup_intent:'setupIntents'};
const fetch=async(s,row)=>row.object_type==='test_clock'?
  s.testHelpers.testClocks.retrieve(row.object_id):
  row.object_type==='checkout_session'?
  s.checkout.sessions.retrieve(row.object_id):
  s[maps[row.object_type]].retrieve(row.object_id);
export async function prepareCleanup(a,ctx){
  const account=ctx?.connection?.stripeAccount,db=ctx?.db;
  if(ctx?.connection?.mode!=='test'||!valid(account,'acct'))
    fail('Selected TEST Stripe account required');
  if(!db||!['getDevRunById','getDevRunObjects','markDevRunObjectCleaned']
    .every(x=>typeof db[x]==='function'))
    fail('Durable account-scoped cleanup ledger unavailable');
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!['runId','scope','dryRun','confirm','requestKey']
      .includes(k))||(a.runId===undefined)===(a.scope===undefined))
    fail('Specify exactly one runId or scope=all-runs');
  if(a.scope!==undefined&&a.scope!=='all-runs')fail('Invalid cleanup scope');
  if(a.runId!==undefined&&!/^run_[a-f0-9]{24}$/.test(a.runId))
    fail('Invalid run ID');
  let ids;
  if(a.runId)ids=[a.runId];
  else{
    if(typeof db.listDevRuns!=='function')fail('Account run listing unavailable');
    const all=await db.listDevRuns({account,limit:50,offset:0});
    if(!Array.isArray(all)||all.length>=50)
      fail('Too many runs for bounded all-runs cleanup; choose a runId');
    ids=all.map(x=>x.id);
  }
  const runs=[];
  for(const id of ids){
    const run=await db.getDevRunById({account,id});
    if(!run||run.stripe_account!==account||run.id!==id||
      !['running','completed','uncertain'].includes(run.status))
      fail('Run is not owned by selected TEST account');
    const rows=await db.getDevRunObjects({account,id});
    if(!Array.isArray(rows)||rows.length>50)fail('Invalid run ledger size');
    for(const row of rows){
      if(!prefixes[row.object_type]||
        !valid(row.object_id,prefixes[row.object_type])||
        typeof row.step_name!=='string'||typeof row.cleaned!=='boolean')
        fail('Invalid tracked TEST provider identity');
    }
    rows.sort((x,y)=>order[x.object_type]-order[y.object_type]||
      x.step_name.localeCompare(y.step_name));
    runs.push({run,rows});
  }
  const count=runs.reduce((n,x)=>n+x.rows.filter(y=>!y.cleaned).length,0);
  if(count>35)fail('Choose individual runId for more than 35 objects');
  return {account,runs,count};
}
export function verifyCleanupIdentity(run,row,obj,rows=[]){
  const type=row.object_type;
  if(!obj||typeof obj!=='object'||Array.isArray(obj)||
    obj.id!==row.object_id||obj.livemode===true||
    (obj.object!==types[type]&&!(type==='customer'&&obj.deleted===true))||
    Object.keys(obj.metadata??{}).some(k=>APP_METADATA_KEYS.includes(k)))
    fail('Provider ownership or type changed; all TEST cleanup aborted');
  if(type==='setup_intent'&&
    (obj.livemode!==false||obj.customer!==null||
      obj.usage!=='off_session'||!Array.isArray(obj.payment_method_types)||
      !obj.payment_method_types.includes('card')))
    fail('TEST SetupIntent ownership or no-charge method permissions changed');
  if(type==='test_clock'){
    if(obj.name!=='RTC DEV RUN '+run.id+' '+row.step_name.split('_').at(-1))
      fail('Clock does not match immutable run provenance');
  }else if(type==='event'){
    const generatedDispute=rows.find(r=>r.object_type==='dispute');
    if(generatedDispute&&obj.type==='charge.dispute.created'){
      const charge=rows.find(r=>r.object_type==='charge');
      if(obj.data?.object?.id!==generatedDispute.object_id||
        obj.data.object.object!=='dispute'||
        obj.data.object.charge!==charge?.object_id||
        obj.data.object.amount!==3600||obj.data.object.currency!=='usd'||
        (obj.account&&obj.account!==run.stripe_account))
        fail('Dispute Event does not match exact linked TEST ledger IDs');
    }else if(obj.data?.object?.metadata?.rtc_run!==run.id||
      (obj.account&&obj.account!==run.stripe_account))
      fail('Recorded TEST event source no longer matches its selected run');
  }else if(type==='payment_method'){
    const customer=rows.find(r=>r.step_name==='customer_1'&&
      r.object_type==='customer');
    if(obj.livemode!==false||obj.type!=='card'||!customer||
      (obj.customer!==customer.object_id&&obj.customer!==null))
      fail('Tracked TEST PaymentMethod belongs to a different run customer');
  }else if(type==='charge'||type==='dispute'){
    const payment=rows.find(r=>r.object_type==='payment_intent');
    const charge=rows.find(r=>r.object_type==='charge');
    if(type==='charge'&&obj.payment_intent!==payment?.object_id||
      type==='dispute'&&obj.charge!==charge?.object_id||
      obj.amount!==3600||obj.currency!=='usd')
      fail('Financial evidence does not link to exact run-owned TEST records');
  }else if(!(type==='customer'&&obj.deleted===true)&&
    obj.metadata?.rtc_run!==run.id)
    fail('Provider rtc_run ownership differs from recorded TEST run');
}
// Immutable Stripe evidence is intentionally not deletable. This is distinct
// from a blocked or uncertain cleanup that needs the owner's attention.
function immutableEvidence(row,was,run){
  if(['event','refund','charge','dispute','invoice_item'].includes(row.object_type))return true;
  if(row.object_type==='invoice')return was.status==='paid'||
    was.status==='uncollectible'||
    run.scenario==='event-invoice-payment-failed';
  if(row.object_type==='checkout_session')return was.status==='complete';
  if(row.object_type==='payment_intent')return was.status==='succeeded';
  if(row.object_type==='setup_intent')return was.status==='succeeded';
  return false;
}
async function safeOperation(s,row,was,key,ctx,run){
  const opts={idempotencyKey:key},id=row.object_id;
  switch(row.object_type){
    case 'payment_method':{
      if(was.customer===null)return true;
      const detached=await s.paymentMethods.detach(id,{},opts);
      if(detached?.id!==id||detached.object!=='payment_method'||
        detached.livemode!==false||detached.customer!==null)return false;
      const actual=await s.paymentMethods.retrieve(id);
      return actual?.id===id&&actual.object==='payment_method'&&
        actual.livemode===false&&actual.customer===null&&
        actual.metadata?.rtc_run===run.id;
    }
    case 'checkout_session':{
      if(was.status==='expired')return true;
      if(was.status!=='open')return false; // completed purchase is immutable
      const ack=await s.checkout.sessions.expire(id,{},opts);
      if(ack?.object!=='checkout.session'||ack.id!==id||ack.livemode!==false)
        return false;
      return (await s.checkout.sessions.retrieve(id)).status==='expired';
    }
    case 'subscription':
      if(was.status==='canceled')return true;
      if(!['active','trialing','past_due','unpaid','incomplete']
        .includes(was.status))return false;
      await s.subscriptions.cancel(id,{invoice_now:false,prorate:false},opts);
      return (await s.subscriptions.retrieve(id)).status==='canceled';
    case 'invoice':
      // Failed collection and Event snapshots remain financial evidence.
      if(run.scenario==='event-invoice-payment-failed')return false;
      if(was.status==='void'||was.deleted===true)return true;
      if(was.status==='paid')return false; // immutable payment evidence
      if(was.status==='open'){
        await s.invoices.voidInvoice(id,{},opts);
        return (await s.invoices.retrieve(id)).status==='void';
      }
      if(was.status==='draft'){
        // Stripe may respond with an exact 404 after deleting a draft.
        // Require a matching deleted receipt before accepting either a
        // deleted tombstone or an independent resource_missing readback.
        const ack=await s.invoices.del(id,{},opts);
        if(ack?.object!=='invoice'||ack.id!==id||ack.deleted!==true)
          return false;
        return gone(()=>s.invoices.retrieve(id),id);
      }
      return false;
    case 'setup_intent':
      if(was.status==='canceled')return true;
      if(!['requires_payment_method','requires_confirmation','requires_action']
        .includes(was.status))return false;
      await s.setupIntents.cancel(id,{cancellation_reason:'abandoned'},opts);
      return (await s.setupIntents.retrieve(id)).status==='canceled';
    case 'payment_intent':
      if(was.status==='canceled')return true;
      if(!['requires_confirmation','requires_payment_method','requires_action']
        .includes(was.status))return false; // processing/succeeded immutable
      await s.paymentIntents.cancel(id,{},opts);
      return (await s.paymentIntents.retrieve(id)).status==='canceled';
    case 'customer':
      if(was.deleted===true)return true;
      await s.customers.del(id,{},opts);
      return (await s.customers.retrieve(id)).deleted===true;
    case 'price':
    case 'product':{
      if(was.active===false)return true;
      await s[maps[row.object_type]].update(id,{active:false},opts);
      return (await s[maps[row.object_type]].retrieve(id)).active===false;
    }
    // A refund is legally immutable. Connected accounts/test clocks may have
    // dependents and require the separate V-2b risk-reviewed deletion paths.
    case 'connected_account':return cleanupTestConnectSeller(s,was,opts);
    case 'test_clock':return cleanupTestClock(s,was,ctx,run.id,opts);
    case 'refund':case 'event':case 'charge':case 'dispute':
    case 'invoice_item':return false;
    default:fail('Unrecognized cleanup type');
  }
}
// Reconcile ONLY a once-verified, zero-value TEST invoice.created draft that
// is independently absent now. No past deletion acknowledgment is invented:
// the complete immutable plan and original Stripe Event must still verify.
async function verifiedMissingDraftInvoice(run,row,rows,ctx,s,error){
  if(row.object_type!=='invoice'||row.step_name!=='invoice_1'||
    run.scenario!=='event-invoice-created'||run.status!=='completed'||
    !exactMissing(error)||!rows.some(r=>r.step_name==='event_1'&&
      r.object_type==='event'&&r.cleaned===false))return false;
  const evidence=await verifyRecordedTriggerRun({runId:run.id},ctx,s);
  return evidence?.providerVerified===true&&evidence.mode==='test'&&
    evidence.type==='invoice.created'&&evidence.sourceType==='invoice'&&
    evidence.sourceId===row.object_id&&evidence.sourceCleaned===false&&
    evidence.immutableEventRetained===true&&
    evidence.eventId===rows.find(r=>r.step_name==='event_1')?.object_id;
}
export async function executeCleanup(a,ctx,s,key){
  const {runs,account}=await prepareCleanup(a,ctx);
  const before=new Map(),verifiedAbsent=new Set();
  // Globally preflight provenance before mutating even the FIRST record.
  for(const {run,rows} of runs)for(const row of rows.filter(r=>!r.cleaned)){
    let object;
    try{object=await fetch(s,row);}
    catch(error){
      if(await verifiedMissingDraftInvoice(run,row,rows,ctx,s,error)){
        verifiedAbsent.add(run.id+':'+row.step_name);
        continue;
      }
      throw error;
    }
    verifyCleanupIdentity(run,row,object,rows);
    before.set(run.id+':'+row.step_name,object);
  }
  const outcomes=[];
  for(const {run,rows} of runs)for(const row of rows){
    if(row.cleaned){
      outcomes.push({runId:run.id,step:row.step_name,id:row.object_id,
        status:'already_cleaned'});continue;
    }
    let state='retained';
    try{
      const worked=verifiedAbsent.has(run.id+':'+row.step_name)||
        await safeOperation(s,row,before.get(run.id+':'+row.step_name),
          key+'_'+run.id+'_'+row.step_name,ctx,run);
      if(worked){
        state=await ctx.db.markDevRunObjectCleaned({account,id:run.id,
          stepName:row.step_name,objectType:row.object_type,objectId:row.object_id})?
          'cleaned':'uncertain';
      }
    }catch{state='uncertain';}
    outcomes.push({runId:run.id,step:row.step_name,id:row.object_id,
      status:state,...(state==='cleaned'&&
        verifiedAbsent.has(run.id+':'+row.step_name)?
        {reconciledFrom:'verified_original_event_and_provider_absence'}:{}),
      ...(state==='retained'?{
        retention:immutableEvidence(row,before.get(run.id+':'+row.step_name),run)?
          'immutable':'review_required'}:{})});
  }
  // Database read-back is independent of the cleanup write/mark requests.
  for(const {run} of runs){
    const rows=await ctx.db.getDevRunObjects({account,id:run.id});
    for(const o of outcomes.filter(x=>x.runId===run.id&&x.status==='cleaned')){
      if(!rows.some(r=>r.step_name===o.step&&r.object_id===o.id&&r.cleaned===true))
        o.status='uncertain';
    }
  }
  const allCleaned=outcomes.every(o=>['cleaned','already_cleaned'].includes(o.status));
  const allEligibleCleaned=outcomes.every(o=>['cleaned','already_cleaned'].includes(o.status)||
    (o.status==='retained'&&o.retention==='immutable'));
  return {outcomes,allCleaned,allEligibleCleaned};
}
