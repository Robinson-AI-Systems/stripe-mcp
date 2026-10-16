// Shared current-native TEST subscription projections and provider preflights.
import {denverLocalTime} from './util.js';
import {APP_METADATA_KEYS} from './app-guard.js';

export const allProfiles=['read_only','everyday','full'];
export const writeProfiles=['everyday','full'];
export const fullProfiles=['full'];
export const id=p=>({type:'string',pattern:'^'+p+'_[A-Za-z0-9]{2,100}$'});
export const quantity={type:'integer',minimum:1,maximum:100000};
export const timestamp={type:'integer',minimum:946684800,maximum:4102444800};
export const optionalMetadata={type:'object',additionalProperties:{type:'string'}};
export const ref=v=>typeof v==='string'?v:typeof v?.id==='string'?v.id:null;
export const local=t=>Number.isSafeInteger(t)?denverLocalTime(t):null;
export const checkId=(v,p)=>{
  if(typeof v!=='string'||!new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(v))
    throw new TypeError('Invalid '+p+' identifier');
  return v;
};
export function paging(a={}){
  const limit=a.limit??20;
  if(!Number.isInteger(limit)||limit<1||limit>100||
    (a.starting_after!==undefined&&!/^[A-Za-z0-9_]{3,110}$/.test(a.starting_after)))
    throw new TypeError('Invalid paging arguments');
  return {limit,...(a.starting_after?{starting_after:a.starting_after}:{})};
}
export function pageResult(p,shape){
  if(!Array.isArray(p?.data)||typeof p.has_more!=='boolean')
    throw new TypeError('Invalid provider list');
  return {data:p.data.map(shape),has_more:p.has_more,
    next:p.has_more?p.data.at(-1)?.id??null:null};
}
export const reply=value=>({content:[{type:'text',text:JSON.stringify(value)}]});
export const fail=text=>({isError:true,content:[{type:'text',text}]});
export async function client(ctx){
  if(ctx?.connection?.mode!=='test'||typeof ctx.services?.stripeForConnection!=='function')
    throw new Error('TEST Stripe provider unavailable');
  return ctx.services.stripeForConnection(ctx.connection);
}
export async function guarded(ctx,fn){
  try{return reply(await fn(await client(ctx)));}
  catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
}
// Only expanded native discount/coupon facts enter recurring-revenue math.
// An unresolved Stripe ID becomes a verified:false sentinel, not a zero discount.
export function discountSafe(v){
  const coupon=v?.coupon;
  if(v?.object!=='discount'||coupon?.object!=='coupon'||v.livemode===true||
    coupon.livemode===true)return {verified:false};
  return {verified:true,endUnix:v.end??null,duration:coupon.duration??null,
    percentOff:coupon.percent_off??null,
    amountOffMinor:coupon.amount_off??null,currency:coupon.currency??null};
}
export function discountList(v){
  if(v===null||v===undefined)return [];
  if(!Array.isArray(v))return [{verified:false}];
  return v.map(discountSafe);
}

export function itemSafe(item){
  return {id:item.id,subscription:ref(item.subscription),
    price:ref(item.price),quantity:item.quantity??null,
    unitAmountCents:item.price?.unit_amount??null,currency:item.price?.currency??null,
    billingScheme:item.price?.billing_scheme??null,
    usageType:item.price?.recurring?.usage_type??null,
    discounts:discountList(item.discounts),
    recurring:item.price?.recurring?{interval:item.price.recurring.interval,
      intervalCount:item.price.recurring.interval_count??1}:null,
    currentPeriodStart:local(item.current_period_start),
    currentPeriodEnd:local(item.current_period_end),
    currentPeriodStartUnix:item.current_period_start??null,
    currentPeriodEndUnix:item.current_period_end??null};
}
export function subscriptionSafe(sub){
  return {id:sub.id,status:sub.status,customer:ref(sub.customer),
    currency:sub.currency??null,collectionMethod:sub.collection_method??null,
    billingMode:sub.billing_mode?.type??null,defaultPaymentMethod:ref(sub.default_payment_method),
    latestInvoice:ref(sub.latest_invoice),schedule:ref(sub.schedule),
    cancelAtPeriodEnd:sub.cancel_at_period_end===true,cancelAt:local(sub.cancel_at),
    canceledAt:local(sub.canceled_at),endedAt:local(sub.ended_at),
    pauseCollection:sub.pause_collection?.behavior??null,
    items:(sub.items?.data??[]).map(itemSafe),
    discounts:discountList(sub.discounts??(sub.discount?[sub.discount]:[])),
    moreItems:sub.items?.has_more===true,
    metadata:sub.metadata??{},description:sub.description??null};
}
export function scheduleSafe(v){
  return {id:v.id,status:v.status,customer:ref(v.customer),
    subscription:ref(v.subscription),endBehavior:v.end_behavior??null,
    startDate:local(v.start_date),endDate:local(v.end_date),
    phases:(v.phases??[]).map(p=>({
      start:local(p.start_date),end:local(p.end_date),
      iterations:p.iterations??null,
      items:(p.items??[]).map(i=>({price:ref(i.price),quantity:i.quantity??null}))
    })),metadata:v.metadata??{}};
}
export function safeRecurringPrice(p){
  if(p?.active!==true||p.currency!=='usd'||p.type!=='recurring'||
    !p.recurring||!Number.isSafeInteger(p.unit_amount)||p.unit_amount<0||
    p.recurring.usage_type!=='licensed')
    throw new TypeError('Only active, licensed, fixed-amount USD recurring prices are supported');
  if(Object.keys(p.metadata??{}).some(k=>APP_METADATA_KEYS.includes(k)))
    throw new TypeError('App-owned price cannot be modified outside its application');
  return p;
}
export function ensureSubscription(s){
  if(!s||s.deleted===true||!Array.isArray(s.items?.data)||
    s.items.has_more===true||!s.items.data.length||s.currency!=='usd')
    throw new TypeError('Complete USD subscription item periods are required');
  if(s.items.data.some(i=>!Number.isSafeInteger(i.current_period_end)||
    !Number.isSafeInteger(i.current_period_start)))
    throw new TypeError('Provider item billing periods unavailable');
  return s;
}
export function validateMetadata(m){
  if(m===undefined)return;
  if(!m||Array.isArray(m)||typeof m!=='object'||Object.keys(m).length>20||
    Object.entries(m).some(([k,v])=>!/^[A-Za-z0-9_-]{1,40}$/.test(k)||
      ['constructor','__proto__','prototype'].includes(k)||APP_METADATA_KEYS.includes(k)||
      typeof v!=='string'||v.length>200))
    throw new TypeError('Invalid or app-owned metadata');
}
export function validateFields(a,allowed,required=[]){
  if(!a||typeof a!=='object'||Array.isArray(a))
    throw new TypeError('Subscription arguments required');
  for(const key of required)if(a[key]===undefined||a[key]===null)
    throw new TypeError('Missing '+key);
  for(const [key,value] of Object.entries(a)){
    if(['dryRun','confirm','requestKey'].includes(key))continue;
    const shape=allowed[key];if(!shape)throw new TypeError('Unsupported '+key);
    if(shape.type==='integer'&&(!Number.isSafeInteger(value)||
      value<(shape.minimum??0)||value>(shape.maximum??Number.MAX_SAFE_INTEGER)))
      throw new TypeError('Invalid '+key);
    if(shape.type==='boolean'&&typeof value!=='boolean')
      throw new TypeError('Invalid '+key);
    if(shape.type==='string'&&(typeof value!=='string'||value.length>(shape.maxLength??110)||
      (shape.minLength&&value.length<shape.minLength)||
      (shape.pattern&&!new RegExp(shape.pattern).test(value))||
      (shape.enum&&!shape.enum.includes(value))))
      throw new TypeError('Invalid '+key);
    if(shape.type==='object')validateMetadata(value);
  }
  if(a.requestKey!==undefined&&
    (typeof a.requestKey!=='string'||a.requestKey.length<1||a.requestKey.length>128))
    throw new TypeError('Invalid retry identifier');
}
export const proration={type:'string',
  enum:['none','create_prorations','always_invoice']};
export const ownership={outsideApp:{type:'boolean'}};
export const positiveTotal=invoice=>{
  if(invoice?.currency!=='usd'||!Number.isSafeInteger(invoice.total)||
    Math.abs(invoice.total)>100000000)
    throw new TypeError('USD provider invoice amount unavailable');
  return invoice.total;
};
export function previewSafe(invoice,effectiveAt,behavior){
  const total=positiveTotal(invoice);
  return {currency:'usd',invoiceTotalCents:total,
    amountDueCents:invoice.amount_due??null,
    effectiveAt,effectiveLocal:local(effectiveAt),
    prorationBehavior:behavior,
    prorationLinesComplete:Array.isArray(invoice.lines?.data)&&invoice.lines.has_more===false,
    prorationLines:(invoice.lines?.data??[])
      .filter(i=>i.parent?.subscription_item_details?.proration===true)
      .map(i=>({amountCents:i.amount,description:i.description??null}))};
}
export async function previewChange(s,sub,items,at,behavior,{billingAnchor=null}={}){
  ensureSubscription(sub);
  if(!Number.isSafeInteger(at)||at<946684800||at>4102444800)
    throw new TypeError('Provide explicit valid effectiveAt');
  if(!['none','create_prorations','always_invoice'].includes(behavior))
    throw new TypeError('Explicit prorationBehavior required');
  const invoice=await s.invoices.createPreview({
    customer:ref(sub.customer),subscription:sub.id,currency:'usd',
    subscription_details:{items,proration_behavior:behavior,
      ...(behavior==='none'?{}:{proration_date:at}),
      ...(billingAnchor?{billing_cycle_anchor:billingAnchor}:{})}
  });
  return previewSafe(invoice,at,behavior);
}
