// G-1a: TEST-only Stripe account money reads. No bank numbers or raw provider objects.
import {allProfiles,guarded,paging,pageResult,ref,local,checkId} from './billing-shared.js';

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
function safeBalance(v){
  if(v?.object!=='balance'||!Array.isArray(v.available)||
    !Array.isArray(v.pending))error('Stripe account balance was not verified');
  return {currencyUnits:'provider_minor_units',available:safeBalanceAmounts(v.available),
    pending:safeBalanceAmounts(v.pending),
    instantAvailable:v.instant_available?safeBalanceAmounts(v.instant_available):null,
    connectReserved:v.connect_reserved?safeBalanceAmounts(v.connect_reserved):null,
    livemode:v.livemode===true};
}
function safeTransaction(v){
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
function safePayout(v){
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
function safeTopup(v){
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
  def('money_get_balance','Read TEST available and pending balances by currency. Amounts are provider minor units.'),
  def('money_list_balance_transactions','List TEST balance transactions with exact fee and net.',{
    ...paged,payout:identifier('po'),type:{type:'string',minLength:1,maxLength:50}}),
  def('money_get_balance_transaction','Read one TEST balance transaction with its exact fee and net.',{
    transactionId:identifier('txn')},['transactionId']),
  def('money_list_payouts','List TEST payouts, status, expected arrival and destination ID only.',{
    ...paged,status:{type:'string',enum:['pending','paid','failed','canceled']}}),
  def('money_get_payout','Read one TEST payout without bank numbers.',{
    payoutId:identifier('po')},['payoutId']),
  def('money_list_payout_transactions','List balance transactions assigned to an automatic TEST payout.',{
    payoutId:identifier('po'),...paged},['payoutId']),
  def('money_list_topups','List TEST top-ups without exposing bank account data.',{
    ...paged,status:{type:'string',enum:['pending','succeeded','failed','canceled']}}),
  def('money_get_topup','Read one TEST top-up without exposing payment source details.',{
    topupId:identifier('tu')},['topupId'])
];
export const handlers={
  money_get_balance:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,[]);
    return safeBalance(await stripe.balance.retrieve());
  }),
  money_list_balance_transactions:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,['limit','starting_after','payout','type']);
    const options={...paging(a)};
    if(a.payout)options.payout=checkId(a.payout,'po');
    if(a.type!==undefined){
      if(!/^[a-z_]{2,50}$/.test(a.type))error('Invalid Stripe balance transaction type');
      options.type=a.type;
    }
    return pageResult(await stripe.balanceTransactions.list(options),safeTransaction);
  }),
  money_get_balance_transaction:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,['transactionId'],['transactionId']);
    return safeTransaction(await stripe.balanceTransactions.retrieve(
      checkId(a.transactionId,'txn')));
  }),
  money_list_payouts:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,['limit','starting_after','status']);
    if(a.status!==undefined&&!['pending','paid','failed','canceled'].includes(a.status))
      error('Unsupported payout status');
    return pageResult(await stripe.payouts.list({...paging(a),
      ...(a.status?{status:a.status}:{})}),safePayout);
  }),
  money_get_payout:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,['payoutId'],['payoutId']);
    return safePayout(await stripe.payouts.retrieve(checkId(a.payoutId,'po')));
  }),
  money_list_payout_transactions:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,['payoutId','limit','starting_after'],['payoutId']);
    const payoutId=checkId(a.payoutId,'po');
    const payout=await stripe.payouts.retrieve(payoutId);
    if(payout?.object!=='payout'||payout.id!==payoutId||payout.automatic!==true||
      payout.livemode===true)error(
      'Exact automatic TEST payout required; manual payouts cannot be reconciled with this filter');
    return {...pageResult(await stripe.balanceTransactions.list({
      ...paging(a),payout:payoutId}),safeTransaction),
      payoutId,scope:'automatic_payout_only'};
  }),
  money_list_topups:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,['limit','starting_after','status']);
    if(a.status!==undefined&&
      !['pending','succeeded','failed','canceled'].includes(a.status))
      error('Unsupported top-up status');
    return pageResult(await stripe.topups.list({...paging(a),
      ...(a.status?{status:a.status}:{})}),safeTopup);
  }),
  money_get_topup:(a,ctx)=>guarded(ctx,async stripe=>{
    args(a,['topupId'],['topupId']);
    return safeTopup(await stripe.topups.retrieve(checkId(a.topupId,'tu')));
  })
};
