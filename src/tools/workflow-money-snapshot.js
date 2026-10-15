// W-1: verified read-only financial window and recurring-revenue snapshot.
// Every provider request runs through the ordinary native registry handler.
import {allProfiles,reply,fail} from './billing-shared.js';
import {collect,verifyContext,deadline,expired,dateWindow,
  partial,amount,hasCurrency,integer} from './workflow-read-common.js';

const date={type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'};
export const tools=[{name:'workflow_money_snapshot',
  description:'Summarize TEST money flows and recurring revenue by currency and Colorado dates.',
  area:'workflows',profiles:allProfiles,writes:false,
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties:{fromDate:date,toDate:date},
    required:['fromDate','toDate'],additionalProperties:false}}];

function interval(price){
  const r=price?.recurring;
  const n=r?.intervalCount;
  if(!Number.isSafeInteger(n)||n<1||n>100)return null;
  const factors={month:1,year:1/12,week:52/12,day:365/12};
  if(!Object.hasOwn(factors,r.interval))return null;
  return factors[r.interval]/n;
}
function discountsOf(discounts,now){
  if(!Array.isArray(discounts))return null;
  const result=[];
  for(const v of discounts){
    if(v?.verified!==true)return null;
    if(v.endUnix!==null&&v.endUnix!==undefined&&
      (!Number.isSafeInteger(v.endUnix)||v.endUnix<=now))continue;
    if(v.duration==='once')continue; // a one-off concession is not recurring MRR
    if(!['forever','repeating'].includes(v.duration))return null;
    if(v.duration==='repeating'&&!Number.isSafeInteger(v.endUnix))return null;
    if((v.percentOff!==null&&v.percentOff!==undefined)&&
      (!Number.isFinite(v.percentOff)||v.percentOff<0||v.percentOff>100))return null;
    if(v.amountOffMinor!==null&&v.amountOffMinor!==undefined&&
      (!integer(v.amountOffMinor)||v.amountOffMinor<0||
      !hasCurrency(v.currency)))return null;
    result.push(v);
  }
  return result;
}
function applyDiscounts(gross,discounts,ratio,currency){
  let result=gross;
  for(const discount of discounts){
    if(discount.percentOff!==null&&discount.percentOff!==undefined)
      result*=1-discount.percentOff/100;
    else if(discount.amountOffMinor!==null&&discount.amountOffMinor!==undefined){
      if(discount.currency!==currency||ratio===null)return null;
      result-=discount.amountOffMinor*ratio;
    }else return null;
  }
  return Math.max(0,result);
}
function priced(item){
  if(!hasCurrency(item.currency)||!Number.isSafeInteger(item.quantity)||
    item.quantity<1||item.quantity>100_000)return {reason:'unverified_item'};
  if(item.billingScheme==='tiered'||item.usageType==='metered')
    return {reason:'usage_or_tiered'};
  if(item.billingScheme!=='per_unit'||item.usageType!=='licensed'||
    !integer(item.unitAmountCents)||item.unitAmountCents<0)
    return {reason:'unverified_price'};
  const ratio=interval(item);
  if(!ratio)return {reason:'unverified_interval'};
  return {currency:item.currency,monthly:item.unitAmountCents*item.quantity*ratio,ratio};
}
export function calculateRecurring(subscriptions,{now=Math.floor(Date.now()/1000)}={}){
  const totals=Object.create(null),trialing=Object.create(null);
  const excluded=[],incomplete=[];
  let active=0,trials=0;
  for(const sub of subscriptions){
    if(!['active','trialing'].includes(sub.status)||sub.pauseCollection)continue;
    const items=sub.items;
    if(!Array.isArray(items)||!items.length||sub.moreItems===true){
      incomplete.push({subscription:sub.id,reason:'subscription_items_unverified'});continue;
    }
    const globalDiscounts=discountsOf(sub.discounts??[],now);
    if(!globalDiscounts){
      incomplete.push({subscription:sub.id,reason:'discount_provenance_unverified'});continue;
    }
    const subtotals=Object.create(null),ratios=Object.create(null),issues=[];
    for(const item of items){
      const info=priced(item);
      if(info.reason){issues.push(info.reason);continue;}
      const itemDiscounts=discountsOf(item.discounts??[],now);
      if(!itemDiscounts){issues.push('item_discount_unverified');continue;}
      const net=applyDiscounts(info.monthly,itemDiscounts,info.ratio,info.currency);
      if(net===null){issues.push('item_discount_currency_unverified');continue;}
      subtotals[info.currency]=(subtotals[info.currency]??0)+net;
      ratios[info.currency]??=info.ratio;
      if(ratios[info.currency]!==info.ratio)ratios[info.currency]=null;
    }
    if(issues.some(x=>x!=='usage_or_tiered')){
      incomplete.push({subscription:sub.id,reason:'price_or_discount_unverified'});continue;
    }
    if(issues.includes('usage_or_tiered'))
      excluded.push({subscription:sub.id,reason:'metered_or_tiered_not_in_MRR'});
    for(const [currency,gross] of Object.entries(subtotals)){
      const net=applyDiscounts(gross,globalDiscounts,ratios[currency],currency);
      if(net===null){
        incomplete.push({subscription:sub.id,reason:'subscription_discount_unverified'});continue;
      }
      const target=sub.status==='trialing'?trialing:totals;
      target[currency]=(target[currency]??0)+net;
    }
    if(sub.status==='trialing')trials++;
    else active++;
  }
  const rounded=items=>Object.fromEntries(Object.entries(items)
    .sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,Math.round(v)]));
  return {mrrMinorByCurrency:rounded(totals),
    trialingPotentialMonthlyMinorByCurrency:rounded(trialing),
    activeSubscriptions:active,trialingSubscriptions:trials,
    excluded:excluded.slice(0,25),unverified:incomplete.slice(0,25),
    complete:incomplete.length===0,
    note:'Amounts are recurring minor units per month, never converted or added across currencies. Trialing is excluded from active MRR; usage-based and tiered prices are excluded.'};
}
async function fullItems(sub,ctx,end){
  if(!sub.moreItems)return {subscription:sub,complete:true};
  const pages=await collect('billing_list_items',{subscriptionId:sub.id,limit:100},ctx,{end});
  if(!pages.complete)return {subscription:sub,complete:false,reason:pages.reason};
  const seen=new Set(),items=[];
  for(const item of [...sub.items,...pages.data]){
    if(!seen.has(item.id)){seen.add(item.id);items.push(item);}
  }
  return {subscription:{...sub,items,moreItems:false},complete:true};
}
export async function moneySnapshot(a,ctx){
  verifyContext(ctx);
  if(!a||Object.keys(a).some(k=>!['fromDate','toDate'].includes(k)))
    throw new TypeError('Only explicit Colorado fromDate/toDate are permitted');
  const win=dateWindow(a.fromDate,a.toDate),end=deadline();
  const tx=await collect('money_list_balance_transactions',{limit:100},ctx,{
    end,stop:page=>page.some(t=>integer(t.createdUnix)&&t.createdUnix<win.from)});
  const txRows=[];
  let invalid=false;
  for(const t of tx.data){
    if(!integer(t.createdUnix)||!integer(t.amountMinor)||!hasCurrency(t.currency))
      {invalid=true;continue;}
    if(t.createdUnix>=win.from&&t.createdUnix<win.until)txRows.push(t);
  }
  const flows=Object.create(null);
  for(const t of txRows){
    const entry=flows[t.currency]??={moneyInMinor:0,moneyOutMinor:0,
      feesMinor:0,netMinor:0,transactions:0};
    const gross=amount(t.amountMinor);
    if(gross>=0)entry.moneyInMinor+=gross;
    else entry.moneyOutMinor+=-gross;
    entry.feesMinor+=amount(t.feeMinor);
    entry.netMinor+=amount(t.netMinor);
    entry.transactions++;
  }
  const subs=await collect('billing_list_subscriptions',{status:'all',limit:100},ctx,{end});
  const prepared=[],itemGaps=[];
  for(const sub of subs.data){
    if(expired(end)){itemGaps.push('time_budget');break;}
    const result=await fullItems(sub,ctx,end);
    if(result.complete)prepared.push(result.subscription);
    else itemGaps.push(result.reason??'subscription_items');
  }
  const mrr=calculateRecurring(prepared);
  const moneyComplete=tx.complete&&!invalid;
  const recurringComplete=subs.complete&&!itemGaps.length&&mrr.complete;
  const summary=partial([{name:'balance_transactions',complete:moneyComplete,
    reason:invalid?'invalid_provider_values':tx.reason},
    {name:'subscriptions',complete:recurringComplete,
      reason:itemGaps[0]??(!mrr.complete?'incomplete_recurring_inputs':subs.reason)}],end);
  return {kind:'money_snapshot',account:ctx.connection.stripeAccount,mode:'test',
    window:win,complete:summary.complete,moneyFlowsComplete:moneyComplete,
    mrrComplete:recurringComplete,
    balanceTransactionCount:txRows.length,
    moneyFlowsByCurrency:flows,recurring:mrr,
    collectedPages:{balance:tx.pages,subscriptions:subs.pages},
    continuation:summary.continuation,gaps:summary.gaps,
    explanation:'Money in/out are signed original TEST balance transaction gross amounts within Colorado dates; fees and net are shown separately. All values are in each currency\'s Stripe minor unit. Partial scans are not final totals.'};
}
export const handlers={workflow_money_snapshot:async(a,ctx)=>{
  try{return reply(await moneySnapshot(a,ctx));}
  catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
}};
