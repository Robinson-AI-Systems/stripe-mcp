// Preconditions shared by native item writes and active schedule lifecycle.
import {APP_METADATA_KEYS} from './app-guard.js';
import {ensureSubscription,ref} from './billing-shared.js';
import {protectAppOwnedTarget} from './app-guard.js';

const supported=new Set(['active','trialing','past_due']);
export function verifyItemLedger(sub){
  ensureSubscription(sub);
  if(!supported.has(sub.status))throw new TypeError('Only mutable TEST recurring subscriptions are supported');
  if(sub.pending_update)throw new TypeError('Pending subscription update must finish first');
  if(sub.items.data.length>20)
    throw new TypeError('Large multi-item plans need Stripe Dashboard confirmation');
  for(const i of sub.items.data){
    const p=i.price;
    if(!/^si_[A-Za-z0-9]{2,100}$/.test(i.id??'')||!ref(p)||
      !Number.isSafeInteger(i.quantity)||
      i.quantity<1||i.quantity>100000)
      throw new TypeError('Incomplete subscription item quantity or price');
    if(p.currency!=='usd'||p.type!=='recurring'||p.recurring?.usage_type!=='licensed'||
      !Number.isSafeInteger(p.unit_amount)||p.unit_amount<0)
      throw new TypeError('Only USD fixed-rate licensed existing items can be edited');
    if(i.current_period_end<=i.current_period_start||
      i.current_period_end<=0||!Number.isSafeInteger(i.current_period_end))
      throw new TypeError('Invalid subscription item billing interval');
    if(Object.keys(p.metadata??{}).some(key=>APP_METADATA_KEYS.includes(key)))
      throw new TypeError('App-owned recurring price cannot be changed here');
  }
  return sub;
}
export async function verifyLinkedScheduleSubscription(s,sch,args,ctx){
  if(sch.status!=='active')return null;
  const linked=ref(sch.subscription);
  if(!linked||!/^sub_[A-Za-z0-9]{2,100}$/.test(linked))
    throw new TypeError('Active schedule subscription reference is unverified');
  const current=verifyItemLedger(await s.subscriptions.retrieve(linked));
  if(ref(current.customer)!==ref(sch.customer))
    throw new TypeError('Schedule and active subscription customers disagree');
  const decision=await protectAppOwnedTarget(args,{
    ...ctx,getCustomer:async id=>s.customers.retrieve(id)
  },current);
  current._appDecision=decision;
  // Defer app-owned denials to the shared targetGuard so they retain the
  // normal audited refusal contract rather than leaking an exception.
  if(current.schedule&&ref(current.schedule)!==sch.id)
    throw new TypeError('Active subscription points to another schedule');
  if(current.pause_collection)
    throw new TypeError('Paused collection requires a manual schedule review');
  if(current.cancel_at_period_end||current.cancel_at)
    throw new TypeError('Schedule-linked subscription has a pending cancellation');
  if(current.status==='past_due'&&args.invoiceNow===true)
    throw new TypeError('Overdue active subscription must be reconciled before final invoicing');
  return current;
}
