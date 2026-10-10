// Native hosted TEST checkout, payment-link and portal configuration reads.
// Never pass client secrets, raw payment methods, or entire Stripe responses.
import {denverLocalTime} from './util.js';
const profiles=['read_only','everyday','full'],id={type:'string',minLength:3,maxLength:220};
const paging={limit:{type:'integer',minimum:1,maximum:100},starting_after:id};
const read=(name,description,props={},required=[])=>({
  name,description,area:'checkout',profiles,writes:false,
  inputSchema:{type:'object',properties:props,required,additionalProperties:false},
  annotations:{readOnlyHint:true}});
export const tools=[
  read('checkout_list','List hosted TEST Checkout sessions by customer, with paging.',
    {...paging,customer:id}),
  read('checkout_get','Inspect a TEST Checkout session without exposing secrets.',
    {sessionId:id},['sessionId']),
  read('checkout_list_line_items','List safe line items for a TEST Checkout session.',
    {sessionId:id,...paging},['sessionId']),
  read('paylink_list','List reusable TEST Stripe payment links with paging.',paging),
  read('paylink_get','Read a reusable TEST payment link.',{linkId:id},['linkId']),
  read('portal_list_configurations','List TEST customer portal feature configurations.',paging),
  read('portal_get_configuration','Inspect TEST portal settings and permissions.',
    {configId:id},['configId'])
];
const valid=(value,prefix)=>typeof value==='string'&&
  new RegExp('^'+prefix+'_[A-Za-z0-9_]{3,190}$').test(value);
const requiredId=(v,p)=>{if(!valid(v,p))throw new TypeError('Invalid '+p+' id');return v;};
const page=args=>{
  const limit=args?.limit??20;
  if(!Number.isInteger(limit)||limit<1||limit>100||
    (args?.starting_after!==undefined&&!/^[A-Za-z0-9_]{3,220}$/.test(args.starting_after)))
    throw new TypeError('Use limit 1–100 and a valid next cursor');
  return {limit,...(args.starting_after?{starting_after:args.starting_after}:{})};
};
const list=(resp,shape)=>({data:(resp?.data??[]).map(shape),
  has_more:resp?.has_more===true,
  next:resp?.has_more?resp.data?.at(-1)?.id??null:null,
  nextHelp:resp?.has_more?'Provide next as starting_after':null});
const local=t=>Number.isSafeInteger(t)?denverLocalTime(t):null;
const ref=v=>typeof v==='string'?v:typeof v?.id==='string'?v.id:null;
const checkoutSafe=v=>({
  id:v.id,object:'checkout.session',mode:v.mode,status:v.status,
  paymentStatus:v.payment_status,customer:ref(v.customer),
  paymentIntent:ref(v.payment_intent),subscription:ref(v.subscription),
  amountTotal:v.amount_total??null,currency:v.currency??null,
  url:v.url??null,expiresAt:local(v.expires_at),created_local:local(v.created)
});
const itemSafe=v=>({
  id:v.id,object:'item',description:v.description??null,
  amountSubtotal:v.amount_subtotal??0,amountTotal:v.amount_total??0,
  currency:v.currency??null,quantity:v.quantity??null,
  price:ref(v.price)
});
const paylinkSafe=v=>({
  id:v.id,object:'payment_link',active:v.active===true,
  url:v.url??null,created_local:local(v.created),
  metadata:v.metadata??{}
});
const portalSafe=v=>{
  const features=v.features??{};
  return {id:v.id,object:'billing_portal.configuration',name:v.name??null,
    active:v.active===true,isDefault:v.is_default===true,
    defaultReturnUrl:v.default_return_url??null,
    features:{
      paymentMethodUpdate:features.payment_method_update?.enabled===true,
      invoiceHistory:features.invoice_history?.enabled===true,
      subscriptionCancel:features.subscription_cancel?.enabled===true,
      subscriptionUpdate:features.subscription_update?.enabled===true
    }};
};
const ok=x=>({content:[{type:'text',text:JSON.stringify(x)}]});
const fail=x=>({isError:true,content:[{type:'text',text:x}]});
const guarded=async(ctx,fn)=>{
  try{
    if(ctx?.connection?.mode!=='test'||typeof ctx.services?.stripeForConnection!=='function')
      throw new Error('TEST Stripe provider unavailable');
    return ok(await fn(await ctx.services.stripeForConnection(ctx.connection)));
  }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
};
export const handlers={
  checkout_list:(a,c)=>guarded(c,async s=>list(await s.checkout.sessions.list({
    ...page(a),...(a?.customer?{customer:requiredId(a.customer,'cus')}:{})
  }),checkoutSafe)),
  checkout_get:(a,c)=>guarded(c,async s=>checkoutSafe(
    await s.checkout.sessions.retrieve(requiredId(a?.sessionId,'cs_test')))),
  checkout_list_line_items:(a,c)=>guarded(c,async s=>list(
    await s.checkout.sessions.listLineItems(requiredId(a?.sessionId,'cs_test'),page(a)),itemSafe)),
  paylink_list:(a,c)=>guarded(c,async s=>list(
    await s.paymentLinks.list(page(a)),paylinkSafe)),
  paylink_get:(a,c)=>guarded(c,async s=>paylinkSafe(
    await s.paymentLinks.retrieve(requiredId(a?.linkId,'plink')))),
  portal_list_configurations:(a,c)=>guarded(c,async s=>list(
    await s.billingPortal.configurations.list(page(a)),portalSafe)),
  portal_get_configuration:(a,c)=>guarded(c,async s=>portalSafe(
    await s.billingPortal.configurations.retrieve(requiredId(a?.configId,'bpc'))))
};
