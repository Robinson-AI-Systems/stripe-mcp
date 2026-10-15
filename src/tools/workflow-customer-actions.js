// W-3/W-4: account-scoped TEST workflows composed ONLY of guarded native tools.
// One whole-job preview; every provider write still traverses its own defineWrite.
// A workflow preview NEVER stands in for independent owner money-out approval.
import {createHash} from 'node:crypto';
import {allProfiles,reply,fail} from './billing-shared.js';
import {collect,nativeRead,verifyContext,validCustomer,deadline,expired,
  integer,str} from './workflow-read-common.js';

const id=p=>({type:'string',pattern:'^'+p+'_[A-Za-z0-9]{2,100}$'});
const usdAmount={type:'integer',minimum:1,maximum:100000000};
const yes={type:'boolean'};
const reasons=['duplicate','fraudulent','requested_by_customer'];
const refundFields={
  customerId:id('cus'),description:{type:'string',minLength:3,maxLength:160},
  chargeId:id('ch'),amountCents:usdAmount,
  reason:{type:'string',enum:reasons},outsideApp:yes,
  previewToken:{type:'string',pattern:'^[a-f0-9]{64}$'},
  dryRun:yes,confirm:yes,requestKey:{type:'string',minLength:1,maxLength:104}
};
const cancelFields={
  customerId:id('cus'),subscriptionId:id('sub'),
  timing:{type:'string',enum:['now','period_end']},
  invoiceNow:yes,prorate:yes,voidOpenInvoices:yes,
  refundChargeId:id('ch'),refundAmountCents:usdAmount,
  refundReason:{type:'string',enum:reasons},outsideApp:yes,
  previewToken:refundFields.previewToken,
  dryRun:yes,confirm:yes,requestKey:refundFields.requestKey
};
const tool=(name,description,properties,required,moneyOut)=>({
  name,description,area:'workflows',profiles:['everyday','full'],
  writes:true,writeContract:'defineWrite-v1',
  // The actual change, approval, reservation, idempotency and readback are
  // performed exclusively by the selected native defineWrite-v1 handler.
  safety:moneyOut?'$':'P',moneySpec:moneyOut?'provider-derived':null,
  moneyOut,annotations:{destructiveHint:true},
  inputSchema:{type:'object',properties,required,additionalProperties:false}
});
export const tools=[
  tool('workflow_refund_customer',
    'Preview one customer refund and delegate to independently approved TEST refund.',
    refundFields,['customerId'],true),
  tool('workflow_cancel_customer',
    'Preview TEST cancellation, optional refund and invoice voids with native guards.',
    cancelFields,['customerId','timing'],true)
];

const regex={cus:/^cus_[A-Za-z0-9]{2,100}$/,ch:/^ch_[A-Za-z0-9]{2,100}$/,
  sub:/^sub_[A-Za-z0-9]{2,100}$/};
const writable=ctx=>{
  verifyContext(ctx);
  if(!['everyday','full'].includes(ctx.connection.profile)||
    typeof ctx.db?.recordChange!=='function')
    throw new TypeError('Guarded TEST write profile and audit database required');
};
const check=(a,shape,kind)=>{
  if(!a||typeof a!=='object'||Array.isArray(a))
    throw new TypeError('Structured workflow arguments required');
  for(const [key,value] of Object.entries(a)){
    const f=shape[key];
    if(!f)throw new TypeError('Unsupported '+kind+' option '+key);
    if(f.type==='boolean'&&typeof value!=='boolean')
      throw new TypeError('Invalid '+key);
    if(f.type==='integer'&&(!integer(value)||value<(f.minimum??0)||
      value>(f.maximum??Number.MAX_SAFE_INTEGER)))
      throw new TypeError('Invalid '+key);
    if(f.type==='string'&&(typeof value!=='string'||
      value.length>(f.maxLength??1000)||value.length<(f.minLength??0)||
      (f.enum&&!f.enum.includes(value))||
      (f.pattern&&!new RegExp(f.pattern).test(value))))
      throw new TypeError('Invalid '+key);
  }
  if(!validCustomer(a.customerId))throw new TypeError('Exact TEST customerId required');
  if(a.confirm===true&&(a.dryRun===true||!a.previewToken||!a.requestKey))
    throw new TypeError('Confirmation requires matching previewToken and stable requestKey');
  if(a.dryRun===true&&a.confirm===true)
    throw new TypeError('Preview cannot execute');
};
const finger=(account,kind,facts)=>createHash('sha256')
  .update(JSON.stringify({account,mode:'test',kind,facts}))
  .digest('hex');
async function customer(customerId,ctx){
  const result=await nativeRead('customer_get',{customerId},ctx);
  if(result.id!==customerId||result.deleted===true)
    throw new TypeError('Selected TEST customer was not verified');
  return result;
}
async function nativeWrite(name,args,ctx){
  const {registry}=await import('./index.js');
  const t=registry.tools.find(v=>v.name===name);
  if(!t||t.writes!==true||t.writeContract!=='defineWrite-v1'||
    !t.profiles?.includes(ctx.connection.profile)||
    typeof registry.handlers[name]!=='function')
    throw new TypeError('Required native guarded TEST write is unavailable');
  const outcome=await registry.handlers[name](args,ctx);
  const raw=outcome?.content?.[0]?.text;
  if(typeof raw!=='string'||raw.length>32000)
    throw new TypeError('Native guarded receipt was unavailable');
  let value;
  try{value=JSON.parse(raw);}catch{
    throw new TypeError('Native guarded receipt was unreadable');
  }
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw new TypeError('Native guarded receipt is invalid');
  return {isError:outcome.isError===true,value};
}
const code=s=>typeof s==='string'?s.slice(0,130):null;
const normalize=s=>s.trim().replace(/\s+/g,' ').toLowerCase();
const refundable=ch=>ch&&regex.ch.test(ch.id??'')&&
  ch.status==='succeeded'&&ch.paid===true&&ch.refunded!==true&&
  ch.disputed!==true&&ch.currency==='usd'&&integer(ch.amount)&&
  integer(ch.amount_refunded)&&ch.amount>ch.amount_refunded&&
  ch.amount-ch.amount_refunded<=100000000;
async function chargeCandidate(a,ctx,end){
  let charge;
  if(a.chargeId){
    if(!regex.ch.test(a.chargeId))throw new TypeError('Invalid chargeId');
    charge=await nativeRead('charge_get',{chargeId:a.chargeId},ctx);
  }else{
    if(typeof a.description!=='string'||normalize(a.description).length<3)
      throw new TypeError('Provide an exact chargeId or a meaningful payment description');
    const found=await collect('charge_list',{customer:a.customerId,limit:100},ctx,{end});
    if(!found.complete)throw new TypeError(
      'Refund discovery incomplete ('+found.reason+'); provide exact chargeId');
    const query=normalize(a.description);
    const matches=found.data.filter(ch=>refundable(ch)&&
      typeof ch.description==='string'&&normalize(ch.description).includes(query));
    if(matches.length!==1)
      throw new TypeError(matches.length?'Ambiguous customer charge; specify exact chargeId':
        'No verified refundable TEST charge matches that description');
    charge=matches[0];
  }
  if(!refundable(charge)||charge.customer!==a.customerId)
    throw new TypeError('Exact customer-owned refundable USD charge unavailable');
  if(a.description&&(!charge.description||
    !normalize(charge.description).includes(normalize(a.description))))
    throw new TypeError('Charge description does not match selected customer payment');
  const remaining=charge.amount-charge.amount_refunded;
  const amount=a.amountCents??remaining;
  if(!integer(amount)||amount<=0||amount>remaining)
    throw new TypeError('Requested refund exceeds verified remaining charge balance');
  return {chargeId:charge.id,amountCents:amount,
    refundableCents:remaining,currency:'usd',customerId:a.customerId,
    description:str(charge.description,120),reason:a.reason??'requested_by_customer',
    ...(a.outsideApp!==undefined?{outsideApp:a.outsideApp}:{})};
}
const refundArgs=v=>({chargeId:v.chargeId,amountCents:v.amountCents,
  reason:v.reason,...(v.outsideApp!==undefined?{outsideApp:v.outsideApp}:{})});
async function readyStep(toolName,args,ctx){
  const response=await nativeWrite(toolName,{...args,dryRun:true},ctx);
  if(response.isError||typeof response.value.preview!=='string')
    throw new TypeError('Native '+toolName+' preview refused or unavailable');
  return {tool:toolName,args,preview:response.value.preview.slice(0,400)};
}
async function planRefund(a,ctx,end){
  await customer(a.customerId,ctx);
  const amount=await chargeCandidate(a,ctx,end);
  if(expired(end))throw new TypeError('Refund preview exceeded time budget');
  const step=await readyStep('payment_create_refund',refundArgs(amount),ctx);
  return {facts:{customerId:a.customerId,refund:amount},steps:[step]};
}
async function planCancel(a,ctx,end){
  await customer(a.customerId,ctx);
  const subs=await collect('billing_list_subscriptions',
    {customer:a.customerId,status:'all',limit:100},ctx,{end});
  if(!subs.complete)throw new TypeError('Subscription discovery incomplete: '+subs.reason);
  const allowed=new Set(['active','trialing','past_due','unpaid']);
  const candidates=subs.data.filter(s=>s.customer===a.customerId&&
    allowed.has(s.status));
  const chosen=a.subscriptionId?
    candidates.find(s=>s.id===a.subscriptionId):
    candidates.length===1?candidates[0]:null;
  if(!chosen||!regex.sub.test(chosen.id))
    throw new TypeError(candidates.length>1&&!a.subscriptionId?
      'Multiple eligible subscriptions; specify exact subscriptionId':
      'No exact mutable TEST subscription found for customer');
  if(a.timing==='period_end'&&chosen.cancelAtPeriodEnd)
    throw new TypeError('Subscription is already scheduled to cancel');
  if(a.timing==='now'&&
    (typeof a.invoiceNow!=='boolean'||typeof a.prorate!=='boolean'))
    throw new TypeError('Immediate cancellation needs explicit invoiceNow and prorate');
  if(a.timing==='period_end'&&(a.invoiceNow!==undefined||a.prorate!==undefined))
    throw new TypeError('Period-end cancellation cannot set immediate invoice options');
  if((a.refundAmountCents!==undefined||a.refundReason!==undefined)&&
    !a.refundChargeId)
    throw new TypeError('Optional refund requires exact refundChargeId');
  const steps=[],snapshot={customerId:a.customerId,
    subscription:{id:chosen.id,status:chosen.status,currency:chosen.currency,
      cancelAtPeriodEnd:chosen.cancelAtPeriodEnd,
      itemsCount:chosen.items?.length??null},
    timing:a.timing,invoiceNow:a.invoiceNow??null,prorate:a.prorate??null,
    voidOpenInvoices:a.voidOpenInvoices===true,refund:null,invoices:[]};
  if(a.refundChargeId){
    const refund=await chargeCandidate({customerId:a.customerId,
      chargeId:a.refundChargeId,amountCents:a.refundAmountCents,
      reason:a.refundReason,outsideApp:a.outsideApp},ctx,end);
    snapshot.refund=refund;
    steps.push(await readyStep('payment_create_refund',refundArgs(refund),ctx));
  }
  steps.push(await readyStep('billing_cancel_subscription',{
    subscriptionId:chosen.id,timing:a.timing,
    ...(a.timing==='now'?{invoiceNow:a.invoiceNow,prorate:a.prorate}:{}),
    ...(a.outsideApp!==undefined?{outsideApp:a.outsideApp}:{})
  },ctx));
  if(a.voidOpenInvoices===true){
    const invoices=await collect('invoice_list',
      {customerId:a.customerId,status:'open',limit:100},ctx,{end});
    if(!invoices.complete)
      throw new TypeError('Open invoice discovery incomplete: '+invoices.reason);
    const open=invoices.data.filter(i=>i.status==='open'&&
      i.customer===a.customerId&&integer(i.amount_remaining)&&
      i.amount_remaining>0);
    if(open.length>5)
      throw new TypeError('More than five open invoices: review and cancel in smaller stages');
    for(const invoice of open){
      if(invoice.currency!=='usd')throw new TypeError('Non-USD invoice requires separate review');
      snapshot.invoices.push({id:invoice.id,status:invoice.status,
        remainingCents:invoice.amount_remaining,currency:invoice.currency});
      steps.push(await readyStep('invoice_void',{invoiceId:invoice.id,
        ...(a.outsideApp!==undefined?{outsideApp:a.outsideApp}:{})},ctx));
    }
  }
  if(expired(end))throw new TypeError('Cancellation plan exceeded 50-second budget');
  return {facts:snapshot,steps};
}
const stepView=s=>({tool:s.tool,target:s.args.chargeId??s.args.subscriptionId??
  s.args.invoiceId,preview:s.preview});
async function execute(kind,a,ctx,plan,end){
  const token=finger(ctx.connection.stripeAccount,kind,plan.facts);
  const preview={kind,mode:'test',account:ctx.connection.stripeAccount,
    previewToken:token,complete:true,
    note:'Not an atomic transaction. Each native step needs its own guarded approval; refund money-out always requires an independent owner grant.',
    steps:plan.steps.map(stepView)};
  if(a.confirm!==true)return {...preview,done:false,needsConfirmation:true};
  if(a.previewToken!==token)
    throw new TypeError('Plan changed or previewToken does not match: preview again');
  const finished=[];
  for(let i=0;i<plan.steps.length;i++){
    if(expired(end))return {...preview,done:false,confirmed:false,
      completedSteps:finished,remainingSteps:plan.steps.slice(i).map(stepView),
      warning:'Time budget expired; reconcile native receipts before any manual continuation'};
    const s=plan.steps[i],suffix=s.tool==='payment_create_refund'?'refund':
      s.tool==='billing_cancel_subscription'?'cancel':'void'+String(i);
    const outcome=await nativeWrite(s.tool,{...s.args,
      confirm:true,requestKey:a.requestKey+':'+suffix},ctx);
    const receipt={tool:s.tool,target:s.args.chargeId??s.args.subscriptionId??
      s.args.invoiceId,confirmed:outcome.value.done===true&&
      outcome.value.confirmed===true,
      ...(code(outcome.value.idempotencyKey)?{idempotencyKey:code(outcome.value.idempotencyKey)}:{}),
      ...(code(outcome.value.resourceId)?{resourceId:code(outcome.value.resourceId)}:{})};
    if(outcome.isError||receipt.confirmed!==true)
      return {...preview,done:false,confirmed:false,completedSteps:finished,
        failedStep:receipt,remainingSteps:plan.steps.slice(i+1).map(stepView),
        warning:'Native guarded step denied or provider/audit outcome uncertain. Do not retry automatically; inspect exact native audit before any continuation.'};
    finished.push(receipt);
  }
  return {...preview,done:true,confirmed:true,completedSteps:finished,
    remainingSteps:[],note:'Every native step confirmed its own read-back. Refund initiation is not a settlement guarantee.'};
}
async function run(kind,a,ctx){
  writable(ctx);
  const isRefund=kind==='refund_customer';
  check(a,isRefund?refundFields:cancelFields,kind);
  if(!isRefund&&(!['now','period_end'].includes(a.timing)))
    throw new TypeError('State cancel timing now or period_end');
  const end=deadline();
  const plan=isRefund?await planRefund(a,ctx,end):await planCancel(a,ctx,end);
  return execute(kind,a,ctx,plan,end);
}
export const handlers={
  workflow_refund_customer:async(a,ctx)=>{
    try{return reply(await run('refund_customer',a,ctx));}
    catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  },
  workflow_cancel_customer:async(a,ctx)=>{
    try{return reply(await run('cancel_customer',a,ctx));}
    catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
