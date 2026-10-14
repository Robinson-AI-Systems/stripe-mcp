// V-2/V-3 independent provider cleanup inspection for completed original TEST
// Event runs. No Stripe or SQL mutations; never equate ledger flags with proof.
import {verifyRecordedTriggerRun} from '../dev/triggers.js';
import {exactMissing} from '../dev/dependent-cleanup.js';
import {APP_METADATA_KEYS} from './app-guard.js';
import {client,reply,allProfiles} from './billing-shared.js';
import {gone} from './write.js';

const valid=x=>typeof x==='string'&&/^run_[a-f0-9]{24}$/.test(x);
const refs={customer:['customers','customer'],product:['products','product'],
  price:['prices','price'],subscription:['subscriptions','subscription'],
  invoice:['invoices','invoice'],payment_intent:['paymentIntents','payment_intent'],
  charge:['charges','charge'],dispute:['disputes','dispute'],
  invoice_item:['invoiceItems','invoiceitem'],refund:['refunds','refund'],
  payment_method:['paymentMethods','payment_method'],
  checkout_session:['checkout.sessions','checkout.session']};
const immutable=new Set(['charge','dispute','refund','invoice_item']);
const providerRead=(stripe,type,id)=>{
  const [namespace]=refs[type]??[];
  if(!namespace)throw new TypeError('Unsupported TEST provider cleanup resource');
  const sdk=namespace==='checkout.sessions'?stripe.checkout?.sessions:stripe[namespace];
  if(typeof sdk?.retrieve!=='function')
    throw new TypeError('TEST provider reader unavailable');
  return sdk.retrieve(id);
};
function inspectState(row,obj,runId,scenario,rows){
  const known=refs[row.object_type];
  if(!known||obj?.id!==row.object_id||obj.object!==known[1]||
    obj.livemode===true||Object.keys(obj.metadata??{}).some(x=>
      APP_METADATA_KEYS.includes(x)))
    return 'unverified';
  if(!(row.object_type==='customer'&&obj.deleted===true)&&
    !['charge','dispute'].includes(row.object_type)&&
    obj.metadata?.rtc_run!==runId)
    return 'unverified';
  switch(row.object_type){
    case 'payment_method':{
      if(obj.livemode!==false||obj.type!=='card')return 'unverified';
      // A recorded detached card must still be owned by the exact original
      // run, and the provider readback is separate from the SQL cleanup flag.
      const exactCustomer=rows.find(r=>r.step_name==='customer_1'&&
        r.object_type==='customer')?.object_id;
      if(!exactCustomer)return 'unverified';
      return obj.customer===null?'cleaned':
        obj.customer===exactCustomer?'outstanding':'unverified';
    }
    case 'customer':return obj.deleted===true?'cleaned':'outstanding';
    case 'product':case 'price':
      return obj.active===false?'cleaned':obj.active===true?'outstanding':'unverified';
    case 'subscription':
      return obj.status==='canceled'?'cleaned':
        typeof obj.status==='string'?'outstanding':'unverified';
    case 'invoice':
      if(obj.status==='paid'||scenario==='event-invoice-payment-failed')
        return 'retained';
      return obj.status==='void'||obj.deleted===true?'cleaned':
        ['draft','open','uncollectible'].includes(obj.status)?'outstanding':'unverified';
    case 'payment_intent':
      return obj.status==='canceled'?'cleaned':
        obj.status==='succeeded'?'retained':
        typeof obj.status==='string'?'outstanding':'unverified';
    case 'checkout_session':
      return obj.status==='expired'?'cleaned':
        obj.status==='complete'?'retained':
        obj.status==='open'?'outstanding':'unverified';
    default:return immutable.has(row.object_type)?'retained':'unverified';
  }
}
function classify(row,state){
  if(state==='unverified')return 'provider_unverified';
  if(state==='outstanding')return row.cleaned?'ledger_mismatch':'pending_cleanup';
  if(state==='cleaned')return row.cleaned?'verified_cleaned':'ledger_pending';
  if(state==='retained')return row.cleaned?'ledger_mismatch':'intentionally_retained';
  return 'provider_unverified';
}
export const tools=[{
  name:'dev_verify_cleanup_run',area:'developer',writes:false,profiles:allProfiles,
  annotations:{readOnlyHint:true},
  description:'Verify current Stripe TEST cleanup states against an original Event and durable run ledger; read-only, no cleanup writes.',
  inputSchema:{type:'object',properties:{
    runId:{type:'string',pattern:'^run_[a-f0-9]{24}$'}
  },required:['runId'],additionalProperties:false}
}];
export const handlers={
  async dev_verify_cleanup_run(a,ctx){
    const account=ctx?.connection?.stripeAccount;
    if(ctx?.connection?.mode!=='test'||!/^acct_[A-Za-z0-9]{2,100}$/.test(account??''))
      return gone('Select original TEST Stripe account');
    if(!a||typeof a!=='object'||Array.isArray(a)||
      Object.keys(a).length!==1||!valid(a.runId))
      return gone('Exact completed TEST Event run ID required');
    if(typeof ctx.db?.getDevRunById!=='function'||
      typeof ctx.db?.getDevRunObjects!=='function')
      return gone('Durable account-scoped TEST run ledger unavailable');
    const stripe=await client(ctx);
    let original;
    try{original=await verifyRecordedTriggerRun({runId:a.runId},ctx,stripe);}
    catch{return gone('Original selected-account TEST Event provenance not independently verified');}
    if(original.providerVerified!==true||original.eventId==null)
      return gone('Original selected-account TEST Event not verified');
    const run=await ctx.db.getDevRunById({account,id:a.runId});
    const rows=await ctx.db.getDevRunObjects({account,id:a.runId});
    if(!run||run.stripe_account!==account||run.id!==a.runId||
      run.status!=='completed'||!Array.isArray(rows)||rows.length<2||
      rows.length>12||rows.some(x=>typeof x.cleaned!=='boolean'))
      return gone('TEST run ledger unavailable or inconsistent');
    const outcome=[];
    for(const row of rows){
      if(row.object_type==='event'){
        if(row.object_id!==original.eventId||row.cleaned!==false)
          return gone('Immutable original Event ledger changed unexpectedly');
        outcome.push({step:row.step_name,type:'event',resourceId:row.object_id,
          cleanedInLedger:false,verification:'intentionally_retained'});
        continue;
      }
      let state='unverified';
      try{
        const obj=await providerRead(stripe,row.object_type,row.object_id);
        state=inspectState(row,obj,run.id,run.scenario,rows);
      }catch(error){
        // Strict absent-invoice classification requires an independently
        // verified original draft Event source; never assume other 404s
        // prove cleanup or convert provider failures into successes.
        if(row.object_type==='invoice'&&exactMissing(error)&&
          original.sourceType==='invoice'&&original.sourceId===row.object_id&&
          ['invoice.created','invoice.updated'].includes(original.type))
          state='cleaned';
      }
      outcome.push({step:row.step_name,type:row.object_type,
        resourceId:row.object_id,cleanedInLedger:row.cleaned,
        verification:classify(row,state)});
    }
    const complete=outcome.every(x=>
      ['verified_cleaned','intentionally_retained'].includes(x.verification));
    return reply({runId:run.id,mode:'test',eventId:original.eventId,
      eventProviderVerified:true,sourceType:original.sourceType,
      sourceId:original.sourceId,allEligibleCleanedAndVerified:complete,
      rows:outcome,
      note:'Read-only independent provider snapshots; verified_cleaned requires matching durable cleanup ledger. ledger_pending means provider state and recorded cleanup differ. Immutable evidence remains retained. No refund, second deletion, new Event, webhook receipt or payment settlement is inferred.'});
  }
};
