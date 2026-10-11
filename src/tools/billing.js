// Native read-only TEST subscriptions, schedule and exact invoice previews.
import {allProfiles,id,quantity,timestamp,proration,paging,pageResult,
  guarded,checkId,subscriptionSafe,itemSafe,scheduleSafe,previewChange,
  ensureSubscription,safeRecurringPrice} from './billing-shared.js';

const cursor={type:'string',minLength:2,maxLength:110};
const query={type:'string',minLength:1,maxLength:400};
const props={limit:{type:'integer',minimum:1,maximum:100},starting_after:cursor};
const read=(name,description,properties={},required=[])=>({
  name,description,area:'billing',profiles:allProfiles,writes:false,
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties,required,additionalProperties:false}});
export const tools=[
  read('billing_list_subscriptions','List TEST subscriptions and each item billing period.',
    {...props,customer:id('cus'),status:{type:'string',
      enum:['all','active','past_due','canceled','trialing','incomplete','unpaid']}}),
  read('billing_get_subscription','Read a TEST subscription, item periods and collection status.',
    {subscriptionId:id('sub')},['subscriptionId']),
  read('billing_search_subscriptions','Search TEST subscriptions with bounded Stripe search.',
    {query,limit:props.limit,page:cursor},['query']),
  read('billing_preview_change','Preview the exact TEST invoice for an item price or quantity change.',
    {subscriptionId:id('sub'),itemId:id('si'),priceId:id('price'),
      quantity,prorationBehavior:proration,effectiveAt:timestamp},
    ['subscriptionId','itemId','effectiveAt','prorationBehavior']),
  read('billing_list_items','List TEST subscription items including independent billing periods.',
    {subscriptionId:id('sub'),...props},['subscriptionId']),
  read('billing_list_schedules','List TEST subscription schedules with paging.',
    {...props,customer:id('cus')}),
  read('billing_get_schedule','Read a TEST subscription schedule and phase details.',
    {scheduleId:id('sub_sched')},['scheduleId'])
];
const search=a=>{
  if(typeof a?.query!=='string'||!a.query.trim()||a.query.length>400||
    !/^[A-Za-z0-9_@\-\s.\[\]:'"~+*]+$/.test(a.query))
    throw new TypeError('Invalid subscription search query');
  if(a.page!==undefined&&!/^[A-Za-z0-9_-]{2,200}$/.test(a.page))
    throw new TypeError('Invalid search page');
  return {query:a.query,limit:paging(a).limit,...(a.page?{page:a.page}:{})};
};
const providerList=(v,project,searchMode=false)=>{
  if(!Array.isArray(v?.data))throw new TypeError('Invalid provider search results');
  return {data:v.data.map(project),has_more:v.has_more===true,
    next:searchMode?v.next_page??null:(v.has_more?v.data.at(-1)?.id??null:null)};
};
export const handlers={
  billing_list_subscriptions:(a,c)=>guarded(c,async s=>providerList(
    await s.subscriptions.list({...paging(a),
      ...(a?.customer?{customer:checkId(a.customer,'cus')}:{}),
      ...(a?.status?{status:a.status}:{})}),subscriptionSafe)),
  billing_get_subscription:(a,c)=>guarded(c,async s=>subscriptionSafe(
    await s.subscriptions.retrieve(checkId(a?.subscriptionId,'sub')))),
  billing_search_subscriptions:(a,c)=>guarded(c,async s=>providerList(
    await s.subscriptions.search(search(a)),subscriptionSafe,true)),
  billing_preview_change:(a,c)=>guarded(c,async s=>{
    const sub=ensureSubscription(await s.subscriptions.retrieve(checkId(a?.subscriptionId,'sub')));
    const item=sub.items.data.find(i=>i.id===checkId(a?.itemId,'si'));
    if(!item)throw new TypeError('Item does not belong to this subscription');
    if(!a.priceId&&a.quantity===undefined)
      throw new TypeError('Provide changed priceId or quantity');
    if(a.quantity!==undefined&&(!Number.isSafeInteger(a.quantity)||a.quantity<1||a.quantity>100000))
      throw new TypeError('Invalid item quantity');
    if(a.priceId)safeRecurringPrice(await s.prices.retrieve(checkId(a.priceId,'price')));
    return previewChange(s,sub,[{id:item.id,
      price:a.priceId??(typeof item.price==='string'?item.price:item.price?.id),
      quantity:a.quantity??item.quantity}],a.effectiveAt,a.prorationBehavior);
  }),
  billing_list_items:(a,c)=>guarded(c,async s=>pageResult(
    await s.subscriptionItems.list({subscription:checkId(a?.subscriptionId,'sub'),...paging(a)}),
    itemSafe)),
  billing_list_schedules:(a,c)=>guarded(c,async s=>providerList(
    await s.subscriptionSchedules.list({...paging(a),
      ...(a?.customer?{customer:checkId(a.customer,'cus')}:{} )}),scheduleSafe)),
  billing_get_schedule:(a,c)=>guarded(c,async s=>scheduleSafe(
    await s.subscriptionSchedules.retrieve(checkId(a?.scheduleId,'sub_sched'))))
};
