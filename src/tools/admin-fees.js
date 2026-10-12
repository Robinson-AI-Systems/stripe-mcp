// G-6d: bounded TEST fee ledger observations, not a Stripe pricing statement.
import {client,reply,fail,allProfiles} from './billing-shared.js';
const bad=m=>{throw new TypeError(m);};
const acct=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(x);
const txn=x=>typeof x==='string'&&/^txn_[A-Za-z0-9]{2,100}$/.test(x);
const minor=x=>Number.isSafeInteger(x)&&Math.abs(x)<=1000000000000;
const currencies=x=>typeof x==='string'&&/^[a-z]{3}$/.test(x);
const feeTypes=new Set(['stripe_fee','application_fee','payment_method_passthrough_fee','tax']);
const dashboardUrl='https://dashboard.stripe.com/';
function validate(a){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!['from','to','pageLimit','maxPages'].includes(k))||
    !Number.isSafeInteger(a.from)||!Number.isSafeInteger(a.to)||
    a.from<946684800||a.to>4102444800||
    a.to<=a.from||a.to-a.from>31*86400||
    (a.pageLimit!==undefined&&(!Number.isInteger(a.pageLimit)||
      a.pageLimit<1||a.pageLimit>100))||
    (a.maxPages!==undefined&&(!Number.isInteger(a.maxPages)||
      a.maxPages<1||a.maxPages>5)))
    bad('Choose an explicit period of at most 31 days and up to five bounded TEST pages');
}
function add(table,currency,key,amount){
  const map=table[currency]??(table[currency]={});
  map[key]=(map[key]??0)+amount;
  if(!Number.isSafeInteger(map[key])||Math.abs(map[key])>1000000000000)
    bad('Period fees exceed safely reportable value');
}
function rowSafe(v,from,to){
  if(v?.object!=='balance_transaction'||!txn(v.id)||
    !Number.isSafeInteger(v.created)||v.created<from||v.created>=to||
    !currencies(v.currency)||!minor(v.amount)||!minor(v.fee)||
    !minor(v.net)||v.amount-v.fee!==v.net)
    bad('Provider balance transaction was invalid or outside the requested TEST period');
  if(v.livemode===true)bad('LIVE balance data is not allowed');
  const details=v.fee_details;
  if(details!=null&&(!Array.isArray(details)||details.length>30))
    bad('Stripe fee breakdown not safely readable');
  let breakdown=null;
  if(Array.isArray(details)){
    const fees=[];
    let total=0;
    for(const f of details){
      if(!minor(f?.amount)||!currencies(f.currency)||f.currency!==v.currency||
        typeof f.type!=='string'||f.type.length>80)
        bad('Stripe fee breakdown invalid or cross-currency');
      fees.push({type:feeTypes.has(f.type)?f.type:'other',amount:f.amount});
      total+=f.amount;
    }
    if(total!==v.fee)bad('Stripe transaction fee does not reconcile to its breakdown');
    breakdown=fees;
  }
  return {id:v.id,currency:v.currency,fee:v.fee,
    reportingCategory:typeof v.reporting_category==='string'&&
      /^[a-z_]{2,50}$/.test(v.reporting_category)?v.reporting_category:null,
    breakdown};
}
function unreadable(account){
  return {account,mode:'test',available:false,complete:false,
    sampleTotals:null,byFeeType:null,transactionsScanned:0,
    statementsVerified:false,dashboardUrl,
    note:'The selected TEST account did not permit this fee ledger read. No zero-fee or complete-statement claim is possible.'};
}
export const tools=[{
  name:'admin_fees_and_billing',area:'admin',writes:false,profiles:allProfiles,
  annotations:{readOnlyHint:true},
  description:'Summarize bounded TEST ledger fees by currency/type with honest partial results; Stripe statements need owner verification.',
  inputSchema:{type:'object',properties:{
    from:{type:'integer',minimum:946684800,maximum:4102444800},
    to:{type:'integer',minimum:946684800,maximum:4102444800},
    pageLimit:{type:'integer',minimum:1,maximum:100},
    maxPages:{type:'integer',minimum:1,maximum:5}},
    required:['from','to'],additionalProperties:false}
}];
export const handlers={
  async admin_fees_and_billing(a,ctx){
    try{
      validate(a);
      const account=ctx?.connection?.stripeAccount;
      if(ctx?.connection?.mode!=='test'||!acct(account))
        bad('Select a connected TEST Stripe account');
      const s=await client(ctx);
      let own;
      try{own=await s.accounts.retrieve();}
      catch(e){
        if([403,404].includes(e?.statusCode??e?.status)||
          ['permission_denied','resource_missing'].includes(e?.code))
          return reply(unreadable(account));
        throw e;
      }
      if(own?.object!=='account'||own.id!==account||own.livemode===true)
        bad('Exact own-account TEST identity could not be verified');
      const sampleTotals={},byFeeType={},seen=new Set();
      const limit=a.pageLimit??50,maxPages=a.maxPages??3;
      let cursor=null,complete=false,missingBreakdown=0,pages=0;
      for(let i=0;i<maxPages;i++){
        let page;
        try{page=await s.balanceTransactions.list({
          limit,created:{gte:a.from,lt:a.to},
          ...(cursor?{starting_after:cursor}:{})});}
        catch(e){
          if([403,404].includes(e?.statusCode??e?.status)||
            ['permission_denied','resource_missing'].includes(e?.code)){
            if(pages===0)return reply(unreadable(account));
            break; // The partial sample remains explicitly incomplete.
          }
          throw e;
        }
        if(page?.object!=='list'||!Array.isArray(page.data)||
          page.data.length>limit||typeof page.has_more!=='boolean'||
          (page.has_more&&page.data.length===0))
          bad('Stripe fee ledger pagination is incomplete or invalid');
        for(const raw of page.data){
          const row=rowSafe(raw,a.from,a.to);
          if(seen.has(row.id))bad('Duplicate provider transaction across fee pages');
          seen.add(row.id);
          add(sampleTotals,row.currency,'feeMinor',row.fee);
          add(sampleTotals,row.currency,'transactionCount',1);
          if(row.breakdown){
            for(const fee of row.breakdown)add(byFeeType,row.currency,fee.type,fee.amount);
          }else{
            missingBreakdown++;
            add(byFeeType,row.currency,'unclassified',row.fee);
          }
        }
        pages++;
        if(!page.has_more){complete=true;break;}
        const next=page.data.at(-1)?.id;
        if(!txn(next)||next===cursor)bad('Stripe fee cursor was invalid');
        cursor=next;
      }
      return reply({account,mode:'test',available:true,period:{from:a.from,to:a.to},
        complete,transactionsScanned:seen.size,pagesScanned:pages,
        sampleTotals:Object.entries(sampleTotals).sort().map(([currency,v])=>
          ({currency,feeMinor:v.feeMinor,transactions:v.transactionCount})),
        byFeeType:Object.entries(byFeeType).sort().map(([currency,values])=>
          ({currency,types:Object.entries(values).sort().map(([type,feeMinor])=>
            ({type,feeMinor}))})),
        missingFeeBreakdowns:missingBreakdown,statementsVerified:false,
        dashboardUrl,billingFeesStatus:'not_readable',taxFeesStatus:'not_readable',
        radarFeesStatus:'not_readable',
        ownerSteps:['Open the selected Stripe Dashboard Reporting and Billing pages.',
          'Compare this observed TEST ledger sample with official Stripe statements and invoices.',
          'Confirm Billing, Tax and Radar charges separately; they are not independently verified here.'],
        note:complete?'Complete filtered ledger enumeration; official Stripe invoices and subscription pricing are not verified.':
          'PARTIAL ledger sample only; amounts must not be represented as complete period charges.'});
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
