// Payment, charge, refund and setup reads in the connection's own
// mode (TEST or LIVE), every returned object verified against that
// mode before projection. Never emit client_secret.
import {denverLocalTime} from './util.js';
import {modeClient,assertAccountResourceMode} from './account-mode.js';
const profiles=['read_only','everyday','full'];
const id={type:'string',minLength:3,maxLength:110};
const limit={type:'integer',minimum:1,maximum:100};
const paging={limit,starting_after:id};
const read=(name,description,props={},required=[])=>({
  name,description,profiles,area:'payments',writes:false,
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties:props,required,additionalProperties:false}
});
const q={query:{type:'string',minLength:1,maxLength:400},limit,page:id};
export const tools=[
  read('payment_list','List TEST or LIVE payment intents by customer, status or time.',
    {...paging,customer:id,createdFrom:{type:'integer',minimum:0}}),
  read('payment_get','Read a TEST or LIVE payment intent without a client secret.',{paymentId:id},['paymentId']),
  read('payment_search','Search TEST or LIVE payment intents with bounded Stripe query.',q,['query']),
  read('charge_list','List TEST or LIVE charges and verified outcome summaries.',
    {...paging,customer:id,payment_intent:id}),
  read('charge_get','Read a TEST or LIVE charge with decline and refund summaries.',{chargeId:id},['chargeId']),
  read('charge_search','Search TEST or LIVE charges using current Stripe search API.',q,['query']),
  read('payment_list_refunds','List TEST or LIVE refunds for a charge or payment.',
    {...paging,charge:id,payment_intent:id}),
  read('payment_get_refund','Read a TEST or LIVE refund, including its status.',{refundId:id},['refundId']),
  read('setup_list','List TEST or LIVE setup intents with bounded pagination.',{...paging,customer:id}),
  read('setup_get','Read a TEST or LIVE setup intent without payment secrets.',{setupId:id},['setupId'])
];
const verify=(value,prefix)=>typeof value==='string'&&new RegExp('^'+prefix+'_[A-Za-z0-9]{2,100}$').test(value);
const pagingArgs=(a={})=>{
  const n=a.limit??20;
  if(!Number.isInteger(n)||n<1||n>100||
     (a.starting_after!==undefined&&!/^[A-Za-z_0-9]{3,110}$/.test(a.starting_after)))
    throw new TypeError('Use limit 1–100 and valid starting_after cursor');
  return {limit:n,...(a.starting_after?{starting_after:a.starting_after}:{})};
};
const searchArgs=a=>{
  if(typeof a?.query!=='string'||a.query.length>400||!a.query.trim()||
    !/^[a-zA-Z0-9_@\-\s.\[\]:'"~+*]+$/.test(a.query))
    throw new TypeError('Invalid bounded payment search query');
  if(a.page!==undefined&&!/^[A-Za-z0-9_-]{1,200}$/.test(a.page))
    throw new TypeError('Invalid payment search cursor');
  return {query:a.query,limit:pagingArgs(a).limit,...(a.page?{page:a.page}:{})};
};
const list=async(p,shape)=>({data:(p?.data||[]).map(shape),
  has_more:p?.has_more===true,next:p?.next_page??(p?.has_more?p.data?.at(-1)?.id:null),
  nextHelp:p?.has_more?'Pass next as page for search or starting_after for list':null});
const local=x=>Number.isSafeInteger(x)?denverLocalTime(x):null;
const strId=v=>typeof v==='string'?v:typeof v?.id==='string'?v.id:null;
// Each projection takes the connection mode as an optional second
// parameter (the shared-projection precedent): when it is 'test' or
// 'live' the object's own livemode is verified against it before the
// historical shape is read; a caller that supplies no mode keeps the
// historical behavior exactly. Field sets never change.
export const paymentSafe=(v,mode)=>{
  if(['test','live'].includes(mode))assertAccountResourceMode(v,mode);
  return {
  id:v.id,object:'payment_intent',status:v.status,amount:v.amount,
  amount_received:v.amount_received??0,currency:v.currency,
  customer:strId(v.customer),paymentMethod:strId(v.payment_method),
  latestCharge:strId(v.latest_charge),description:v.description??null,
  receiptEmail:v.receipt_email??null,canceledAt:local(v.canceled_at),
  failureCode:typeof v.last_payment_error?.code==='string'?v.last_payment_error.code:null,
  declineCode:typeof v.last_payment_error?.decline_code==='string'?v.last_payment_error.decline_code:null,
  created_local:local(v.created),metadata:v.metadata??{}
  };
};
export const chargeSafe=(v,mode)=>{
  if(['test','live'].includes(mode))assertAccountResourceMode(v,mode);
  return {
  id:v.id,object:'charge',status:v.status,paid:v.paid===true,
  amount:v.amount,amount_refunded:v.amount_refunded??0,
  currency:v.currency,customer:strId(v.customer),
  paymentIntent:strId(v.payment_intent),description:v.description??null,
  refunded:v.refunded===true,disputed:v.disputed===true,
  outcome:v.outcome?{type:v.outcome.type,reason:v.outcome.reason??null,
    networkStatus:v.outcome.network_status??null}:null,
  failureCode:v.failure_code??null,created_local:local(v.created),metadata:v.metadata??{}
  };
};
export const refundSafe=(v,mode)=>{
  if(['test','live'].includes(mode))assertAccountResourceMode(v,mode);
  return {
  id:v.id,object:'refund',amount:v.amount,currency:v.currency,status:v.status,
  reason:v.reason??null,charge:strId(v.charge),paymentIntent:strId(v.payment_intent),
  created_local:local(v.created),metadata:v.metadata??{}
  };
};
export const setupSafe=(v,mode)=>{
  if(['test','live'].includes(mode))assertAccountResourceMode(v,mode);
  return {
  id:v.id,object:'setup_intent',status:v.status,customer:strId(v.customer),
  paymentMethod:strId(v.payment_method),usage:v.usage??null,
  cancellationReason:v.cancellation_reason??null,
  created_local:local(v.created),metadata:v.metadata??{}
  };
};
const ok=x=>({content:[{type:'text',text:JSON.stringify(x)}]});
const fail=x=>({isError:true,content:[{type:'text',text:x}]});
// The client resolves through the one shared mode-aware seam
// (modeClient in account-mode.js): TEST resolves exactly as this
// module's helper always did, LIVE resolves only through the
// verified selected-account path, and the connection mode is handed
// to the handler so every projection verifies against it.
const guarded=async(ctx,fn)=>{
  try{
    return ok(await fn(await modeClient(ctx),ctx?.connection?.mode));
  }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
};
const ensure=(v,p)=>{if(!verify(v,p))throw new TypeError('Invalid '+p+' target identifier');return v;};
export const handlers={
  payment_list:(a,c)=>guarded(c,async(s,m)=>list(await s.paymentIntents.list({
    ...pagingArgs(a),...(a?.customer?{customer:ensure(a.customer,'cus')}:{}),
    ...(a?.createdFrom?{created:{gte:a.createdFrom}}:{})
  }),v=>paymentSafe(v,m))),
  payment_get:(a,c)=>guarded(c,async(s,m)=>paymentSafe(
    await s.paymentIntents.retrieve(ensure(a?.paymentId,'pi')),m)),
  payment_search:(a,c)=>guarded(c,async(s,m)=>list(
    await s.paymentIntents.search(searchArgs(a)),v=>paymentSafe(v,m))),
  charge_list:(a,c)=>guarded(c,async(s,m)=>list(await s.charges.list({
    ...pagingArgs(a),...(a?.customer?{customer:ensure(a.customer,'cus')}:{}),
    ...(a?.payment_intent?{payment_intent:ensure(a.payment_intent,'pi')}: {})
  }),v=>chargeSafe(v,m))),
  charge_get:(a,c)=>guarded(c,async(s,m)=>chargeSafe(
    await s.charges.retrieve(ensure(a?.chargeId,'ch')),m)),
  charge_search:(a,c)=>guarded(c,async(s,m)=>list(
    await s.charges.search(searchArgs(a)),v=>chargeSafe(v,m))),
  payment_list_refunds:(a,c)=>guarded(c,async(s,m)=>list(await s.refunds.list({
    ...pagingArgs(a),...(a?.charge?{charge:ensure(a.charge,'ch')}:{}),
    ...(a?.payment_intent?{payment_intent:ensure(a.payment_intent,'pi')}: {})
  }),v=>refundSafe(v,m))),
  payment_get_refund:(a,c)=>guarded(c,async(s,m)=>refundSafe(
    await s.refunds.retrieve(ensure(a?.refundId,'re')),m)),
  setup_list:(a,c)=>guarded(c,async(s,m)=>list(await s.setupIntents.list({
    ...pagingArgs(a),...(a?.customer?{customer:ensure(a.customer,'cus')}: {})
  }),v=>setupSafe(v,m))),
  setup_get:(a,c)=>guarded(c,async(s,m)=>setupSafe(
    await s.setupIntents.retrieve(ensure(a?.setupId,'seti')),m))
};
