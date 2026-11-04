// G-1a: Stripe account money reads in the connection's own mode
// (TEST or LIVE). No bank numbers or raw provider objects.
import {allProfiles,guarded,paging,pageResult,ref,local,checkId} from './billing-shared.js';
import {assertAccountResourceMode} from './account-mode.js';

const error=x=>{throw new TypeError(x);};
const cents=x=>Number.isSafeInteger(x)&&Math.abs(x)<=1000000000000;
const currency=x=>typeof x==='string'&&/^[a-z]{3}$/.test(x);
const text=x=>typeof x==='string'?x:null;
const stamp=x=>Number.isSafeInteger(x)?x:null;
function args(a,allowed,required=[]){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(x=>!allowed.includes(x))||
    required.some(x=>a[x]===undefined))error('Exact bounded financial read arguments required');
  return a;
}
function money(v){
  if(!v||!currency(v.currency)||!cents(v.amount))
    error('Stripe amount or currency not verified');
  return {amountMinor:v.amount,currency:v.currency};
}
function safeBalanceAmounts(values){
  if(!Array.isArray(values)||values.length>100)
    error('Stripe currency balance buckets are incomplete');
  return values.map(x=>({...money(x),
    sourceTypes:x.source_types&&typeof x.source_types==='object'?
      Object.fromEntries(Object.entries(x.source_types).filter(([k,v])=>
        /^[a-z_]{1,45}$/.test(k)&&cents(v))):null}));
}
// CAP-4 D-1: the projections take the connection mode as an optional
// parameter, on the shared-projection precedent — a supplied mode
// verifies the object's own livemode in both directions before
// projection; no mode keeps the historical behavior exactly (these
// projections are module-local, so handler callers always supply the
// connection's mode and no external caller exists to drift).
function safeBalance(v,mode){
  if(['test','live'].includes(mode))assertAccountResourceMode(v,mode);
  if(v?.object!=='balance'||!Array.isArray(v.available)||
    !Array.isArray(v.pending))error('Stripe account balance was not verified');
  return {currencyUnits:'provider_minor_units',available:safeBalanceAmounts(v.available),
    pending:safeBalanceAmounts(v.pending),
    instantAvailable:v.instant_available?safeBalanceAmounts(v.instant_available):null,
    connectReserved:v.connect_reserved?safeBalanceAmounts(v.connect_reserved):null,
    livemode:v.livemode===true};
}
function safeTransaction(v,mode){
  if(['test','live'].includes(mode))assertAccountResourceMode(v,mode);
  if(v?.object!=='balance_transaction'||typeof v.id!=='string'||
    !/^txn_[A-Za-z0-9]{2,100}$/.test(v.id)||
    !cents(v.fee)||!cents(v.net)||!cents(v.amount)||
    v.amount-v.fee!==v.net||!currency(v.currency))
    error('Stripe balance transaction amount, fee or net unverified');
  return {id:v.id,amountMinor:v.amount,feeMinor:v.fee,netMinor:v.net,
    currency:v.currency,status:text(v.status),type:text(v.type),
    reportingCategory:text(v.reporting_category),
    source:ref(v.source),description:text(v.description),
    createdAt:local(v.created),availableOn:local(v.available_on),
    createdUnix:stamp(v.created)};
}
function safePayout(v,mode){
  if(['test','live'].includes(mode))assertAccountResourceMode(v,mode);
  if(v?.object!=='payout'||typeof v.id!=='string'||
    !/^po_[A-Za-z0-9]{2,100}$/.test(v.id)||!cents(v.amount)||
    !currency(v.currency))
    error('Stripe payout identity or money value unavailable');
  const destination=ref(v.destination);
  return {id:v.id,...money(v),status:text(v.status),method:text(v.method),
    type:text(v.type),automatic:v.automatic===true,
    destinationId:destination,createdAt:local(v.created),
    arrivalAt:local(v.arrival_date),failureCode:text(v.failure_code),
    failureMessage:text(v.failure_message),
    description:text(v.description),balanceTransaction:ref(v.balance_transaction)};
}
function safeTopup(v,mode){
  if(['test','live'].includes(mode))assertAccountResourceMode(v,mode);
  if(v?.object!=='topup'||typeof v.id!=='string'||
    !/^tu_[A-Za-z0-9]{2,100}$/.test(v.id))
    error('Stripe top-up identity unverified');
  return {id:v.id,...money(v),status:text(v.status),
    description:text(v.description),createdAt:local(v.created),
    expectedAvailableAt:local(v.expected_availability_date),
    balanceTransaction:ref(v.balance_transaction),
    failureCode:text(v.failure_code),failureMessage:text(v.failure_message)};
}
const paged={limit:{type:'integer',minimum:1,maximum:100},
  starting_after:{type:'string',minLength:3,maxLength:110}};
const identifier=p=>({type:'string',pattern:'^'+p+'_[A-Za-z0-9]{2,100}$'});
const def=(name,description,properties={},required=[])=>({
  name,description,area:'money',writes:false,profiles:allProfiles,
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties,required,additionalProperties:false}
});
export const tools=[
  def('money_get_balance','Read TEST or LIVE available and pending balances by currency. Amounts are provider minor units.'),
  def('money_list_balance_transactions','List TEST or LIVE balance transactions with exact fee and net.',{
    ...paged,payout:identifier('po'),type:{type:'string',minLength:1,maxLength:50}}),
  def('money_get_balance_transaction','Read one TEST or LIVE balance transaction with its exact fee and net.',{
    transactionId:identifier('txn')},['transactionId']),
  def('money_list_payouts','List TEST or LIVE payouts, status, expected arrival and destination ID only.',{
    ...paged,status:{type:'string',enum:['pending','paid','failed','canceled']}}),
  def('money_get_payout','Read one TEST or LIVE payout without bank numbers.',{
    payoutId:identifier('po')},['payoutId']),
  def('money_list_payout_transactions','List balance transactions assigned to an automatic TEST or LIVE payout.',{
    payoutId:identifier('po'),...paged},['payoutId']),
  def('money_list_topups','List TEST or LIVE top-ups without exposing bank account data.',{
    ...paged,status:{type:'string',enum:['pending','succeeded','failed','canceled']}}),
  def('money_get_topup','Read one TEST or LIVE top-up without exposing payment source details.',{
    topupId:identifier('tu')},['topupId'])
];
export const handlers={
  money_get_balance:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,[]);
    return safeBalance(await stripe.balance.retrieve(),ctx?.connection?.mode);
  }),
  money_list_balance_transactions:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,['limit','starting_after','payout','type']);
    const options={...paging(a)};
    if(a.payout)options.payout=checkId(a.payout,'po');
    if(a.type!==undefined){
      if(!/^[a-z_]{2,50}$/.test(a.type))error('Invalid Stripe balance transaction type');
      options.type=a.type;
    }
    const mode=ctx?.connection?.mode;
    return pageResult(await stripe.balanceTransactions.list(options),
      v=>safeTransaction(v,mode));
  }),
  money_get_balance_transaction:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,['transactionId'],['transactionId']);
    return safeTransaction(await stripe.balanceTransactions.retrieve(
      checkId(a.transactionId,'txn')),ctx?.connection?.mode);
  }),
  money_list_payouts:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,['limit','starting_after','status']);
    if(a.status!==undefined&&!['pending','paid','failed','canceled'].includes(a.status))
      error('Unsupported payout status');
    const mode=ctx?.connection?.mode;
    return pageResult(await stripe.payouts.list({...paging(a),
      ...(a.status?{status:a.status}:{})}),v=>safePayout(v,mode));
  }),
  money_get_payout:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,['payoutId'],['payoutId']);
    return safePayout(await stripe.payouts.retrieve(checkId(a.payoutId,'po')),
      ctx?.connection?.mode);
  }),
  money_list_payout_transactions:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,['payoutId','limit','starting_after'],['payoutId']);
    const payoutId=checkId(a.payoutId,'po');
    const mode=ctx?.connection?.mode;
    const payout=await stripe.payouts.retrieve(payoutId);
    // The automatic-payout proof is parameterized to the connection's
    // mode (CAP-4 D-1): the exact payout object, exact ID,
    // automatic===true and a livemode equal to the connection's mode,
    // with the same exactness in both modes; the manual-payout
    // exclusion stands in both modes. The refusal text names the
    // connection's mode, so the TEST wording is byte-identical.
    if(payout?.object!=='payout'||payout.id!==payoutId||payout.automatic!==true||
      (payout.livemode!==undefined&&payout.livemode!==(mode==='live')))error(
      'Exact automatic '+(mode==='live'?'LIVE':'TEST')+
      ' payout required; manual payouts cannot be reconciled with this filter');
    return {...pageResult(await stripe.balanceTransactions.list({
      ...paging(a),payout:payoutId}),v=>safeTransaction(v,mode)),
      payoutId,scope:'automatic_payout_only'};
  }),
  money_list_topups:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,['limit','starting_after','status']);
    if(a.status!==undefined&&
      !['pending','succeeded','failed','canceled'].includes(a.status))
      error('Unsupported top-up status');
    const mode=ctx?.connection?.mode;
    return pageResult(await stripe.topups.list({...paging(a),
      ...(a.status?{status:a.status}:{})}),v=>safeTopup(v,mode));
  }),
  money_get_topup:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,['topupId'],['topupId']);
    return safeTopup(await stripe.topups.retrieve(checkId(a.topupId,'tu')),
      ctx?.connection?.mode);
  })
};
