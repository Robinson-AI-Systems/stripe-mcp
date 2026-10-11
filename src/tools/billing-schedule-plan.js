// Conservative schedule-phase planning. Never implicitly overwrite active billing.
import {ref} from './billing-shared.js';

const important=['discounts','default_tax_rates','add_invoice_items','transfer_data',
  'automatic_tax','billing_thresholds','application_fee_percent','on_behalf_of',
  'trial_end','default_payment_method','collection_method','description',
  'metadata','invoice_settings','currency','coupon','tax_percent','tax_rates'];
const set=value=>value!==undefined&&value!==null&&value!==false&&
  value!==''&&(!Array.isArray(value)||value.length>0)&&
  (typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>0);
function simplePhase(p){
  if(!p||!Array.isArray(p.items)||p.items.length!==1)
    throw new TypeError('Only single-price scheduled phases can be safely replaced');
  for(const key of important)if(set(p[key]))
    throw new TypeError('Schedule phase has custom '+key+'; preserve through Stripe Dashboard');
  const i=p.items[0],price=ref(i.price);
  if(!price||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>100000)
    throw new TypeError('Schedule phase requires one fixed recurring price and quantity');
  if(i.discounts?.length||i.tax_rates?.length||i.billing_thresholds)
    throw new TypeError('Custom item discounts or taxes cannot be dropped');
  return {price,quantity:i.quantity};
}
function matchesPhase(actual,expected){
  if(!actual||!expected||!Array.isArray(actual.items)||actual.items.length!==1)
    return false;
  const i=actual.items[0],want=expected.items[0];
  return ref(i.price)===want.price&&i.quantity===want.quantity&&
    (expected.start_date===undefined||actual.start_date===expected.start_date)&&
    (expected.end_date===undefined||actual.end_date===expected.end_date)&&
    (expected.iterations===undefined||actual.iterations===expected.iterations);
}
export function planScheduleUpdate(b,a,now=Math.floor(Date.now()/1000)){
  if(!b||!['active','not_started'].includes(b.status)||!Array.isArray(b.phases))
    throw new TypeError('Only pending or active schedules can be edited');
  if(!['flexible','classic'].includes(b.billing_mode?.type))
    throw new TypeError('Schedule billing mode must be verified');
  if(b.status==='not_started'){
    if(b.phases.length!==1||!Number.isSafeInteger(b.start_date)||
      b.start_date<now+300)
      throw new TypeError('Only one-phase future schedules can be changed');
    simplePhase(b.phases[0]);
    if(a.effectiveAt!==undefined||a.replaceFuture!==undefined)
      throw new TypeError('Future timing overrides apply only to active schedules');
    return {phases:[{items:[{price:a.priceId,quantity:a.quantity}],
      iterations:a.iterations,proration_behavior:'none'}],
      effectiveAt:b.start_date,active:false};
  }
  if(!Number.isSafeInteger(a.effectiveAt)||a.effectiveAt<=now+300||
    !b.current_phase||a.effectiveAt!==b.current_phase.end_date)
    throw new TypeError('Active schedule change must start at its verified next phase boundary');
  const currentIndex=b.phases.findIndex(p=>p.start_date===b.current_phase.start_date);
  if(currentIndex<0||currentIndex>9||b.phases.length-currentIndex>10)
    throw new TypeError('Current schedule phase is missing or too complex');
  const current=b.phases[currentIndex];
  if(current.end_date!==b.current_phase.end_date)
    throw new TypeError('Schedule phase boundary changed; refresh before editing');
  const existing=simplePhase(current);
  const future=b.phases.slice(currentIndex+1);
  if(future.length&&a.replaceFuture!==true)
    throw new TypeError('Scheduled future phases exist; explicitly authorize their replacement');
  for(const p of future)simplePhase(p);
  if(b.phases.slice(0,currentIndex).some(p=>
    !Number.isSafeInteger(p.end_date)||p.end_date>b.current_phase.start_date))
    throw new TypeError('Historical phases overlap the active period');
  return {active:true,effectiveAt:a.effectiveAt,
    phases:[
      {start_date:b.current_phase.start_date,end_date:b.current_phase.end_date,
        items:[existing],proration_behavior:'none'},
      {start_date:a.effectiveAt,
        items:[{price:a.priceId,quantity:a.quantity}],
        iterations:a.iterations,proration_behavior:'none'}]};
}
export function verifyScheduleUpdate(before,after,a){
  if(!after||after.id!==before.id||after.status!==before.status||
    after.end_behavior!==a.endBehavior||
    !Array.isArray(after.phases))return false;
  const want=before._phases;
  if(!Array.isArray(want))return false;
  if(before.status==='not_started')
    return after.start_date===before.start_date&&after.phases.length===1&&
      matchesPhase(after.phases[0],want[0]);
  if(!after.current_phase||after.current_phase.start_date!==
      before.current_phase.start_date||
    after.current_phase.end_date!==before.current_phase.end_date)return false;
  const i=after.phases.findIndex(p=>p.start_date===want[0].start_date);
  return i>=0&&after.phases.length===i+want.length&&
    want.every((p,n)=>matchesPhase(after.phases[i+n],p));
}
