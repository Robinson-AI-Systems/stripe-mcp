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
    if(!i.id||!ref(p)||!Number.isSafeInteger(i.quantity)||
      i.quantity<1||i.quantity>100000)
      throw new TypeError('Incomplete subscription item quantity or price');
    if(p.currency!=='usd'||p.type!=='recurring'||p.recurring?.usage_type!=='licensed'||
      !Number.isSafeInteger(p.unit_amount)||p.unit_amount<0)
      throw new TypeError('Only USD fixed-rate licensed existing items can be edited');
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
  if(decision!==true)
    throw new TypeError(typeof decision==='string'?decision:'App ownership cannot be verified');
  if(current.schedule&&ref(current.schedule)!==sch.id)
    throw new TypeError('Active subscription points to another schedule');
  if(current.pause_collection)
    throw new TypeError('Paused collection requires a manual schedule review');
  return current;
}
