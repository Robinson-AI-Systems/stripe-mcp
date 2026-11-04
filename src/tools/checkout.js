// Native hosted checkout, payment-link and portal configuration reads in
// the connection's mode. Never pass client secrets, raw payment methods,
// or entire Stripe responses.
import {denverLocalTime} from './util.js';
import {modeClient,assertAccountResourceMode} from './account-mode.js';
const profiles=['read_only','everyday','full'],id={type:'string',minLength:3,maxLength:220};
const paging={limit:{type:'integer',minimum:1,maximum:100},starting_after:id};
const read=(name,description,props={},required=[])=>({
  name,description,area:'checkout',profiles,writes:false,
  inputSchema:{type:'object',properties:props,required,additionalProperties:false},
  annotations:{readOnlyHint:true}});
export const tools=[
  read('checkout_list','List TEST or LIVE Checkout sessions by customer.',
    {...paging,customer:id}),
  read('checkout_get','Get a TEST or LIVE Checkout session without exposing secrets.',
    {sessionId:id},['sessionId']),
  read('checkout_list_line_items','List TEST or LIVE Checkout session line items.',
    {sessionId:id,...paging},['sessionId']),
  read('paylink_list','List reusable TEST or LIVE payment links.',paging),
  read('paylink_get','Read a TEST or LIVE payment link.',{linkId:id},['linkId']),
  read('portal_list_configurations','List TEST or LIVE portal configurations.',paging),
  read('portal_get_configuration','Inspect TEST or LIVE portal settings.',
    {configId:id},['configId'])
];
const valid=(value,prefix)=>typeof value==='string'&&
  new RegExp('^'+prefix+'_[A-Za-z0-9_]{3,190}$').test(value);
const requiredId=(v,p)=>{if(!valid(v,p))throw new TypeError('Invalid '+p+' id');return v;};
// Checkout session IDs carry their mode in the prefix (cs_test_ /
// cs_live_); the baseline pattern admitted only cs_test_, refusing
// every LIVE session before any provider call. The converted pattern
// is the one the V2 checkout writes already use (PR #313): both
// prefixes are addressable, and the returned object's own livemode
// is verified against the connection mode by the projection.
const sessionId=v=>{if(typeof v!=='string'||
  !/^cs_(test|live)_[A-Za-z0-9_]{3,190}$/.test(v))
  throw new TypeError('Invalid checkout session id');return v;};
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
// Each projection takes the connection mode as an optional second
// parameter (the shared-projection precedent): when it is 'test' or
// 'live' the object's own livemode is verified against it before the
// historical shape is read; a caller that supplies no mode keeps the
// historical behavior exactly. The baseline projections carried no
// livemode check at all, so the shared helper's default semantics
// apply (an object with no livemode field passes, as every baseline
// fixture does; a present livemode that disagrees refuses the whole
// read). Field sets never change. The checkout session's own `mode`
// field (payment/subscription) is projected untouched — it is not
// the connection mode and is never gated on.
export const checkoutSafe=(v,mode)=>{
  if(['test','live'].includes(mode))assertAccountResourceMode(v,mode);
  return {
  id:v.id,object:'checkout.session',mode:v.mode,status:v.status,
  paymentStatus:v.payment_status,customer:ref(v.customer),
  paymentIntent:ref(v.payment_intent),subscription:ref(v.subscription),
  amountTotal:v.amount_total??null,currency:v.currency??null,
  url:v.url??null,expiresAt:local(v.expires_at),created_local:local(v.created)
  };
};
export const itemSafe=(v,mode)=>{
  if(['test','live'].includes(mode))assertAccountResourceMode(v,mode);
  return {
  id:v.id,object:'item',description:v.description??null,
  amountSubtotal:v.amount_subtotal??0,amountTotal:v.amount_total??0,
  currency:v.currency??null,quantity:v.quantity??null,
  price:ref(v.price)
  };
};
export const paylinkSafe=(v,mode)=>{
  if(['test','live'].includes(mode))assertAccountResourceMode(v,mode);
  return {
  id:v.id,object:'payment_link',active:v.active===true,
  url:v.url??null,created_local:local(v.created),
  metadata:v.metadata??{}
  };
};
export const portalSafe=(v,mode)=>{
  if(['test','live'].includes(mode))assertAccountResourceMode(v,mode);
  const features=v.features??{};
  const profile=v.business_profile??{};
  const publicUrl=x=>{
    if(x==null)return null;
    if(typeof x!=='string'||x.length>500)return null;
    try{const u=new URL(x);
      return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&
        !u.port&&u.hostname.includes('.')?x:null;}catch{return null;}
  };
  return {id:v.id,object:'billing_portal.configuration',name:v.name??null,
    appearance:{headline:typeof profile.headline==='string'&&
      profile.headline.length<=120?profile.headline:null,
      privacyUrl:publicUrl(profile.privacy_policy_url),
      termsUrl:publicUrl(profile.terms_of_service_url)},
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
// The client resolves through the one shared mode-aware seam
// (modeClient in account-mode.js): TEST resolves exactly as this
// module's helper always did (including the historical
// 'TEST Stripe provider unavailable' refusal when the service is
// missing), LIVE resolves only through the verified selected-account
// path, and the connection mode is handed to the handler so every
// projection verifies against it.
const guarded=async(ctx,fn)=>{
  try{
    return ok(await fn(await modeClient(ctx),ctx?.connection?.mode));
  }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
};
export const handlers={
  checkout_list:(a,c)=>guarded(c,async(s,m)=>list(await s.checkout.sessions.list({
    ...page(a),...(a?.customer?{customer:requiredId(a.customer,'cus')}:{})
  }),v=>checkoutSafe(v,m))),
  checkout_get:(a,c)=>guarded(c,async(s,m)=>checkoutSafe(
    await s.checkout.sessions.retrieve(sessionId(a?.sessionId)),m)),
  checkout_list_line_items:(a,c)=>guarded(c,async(s,m)=>{
    const sid=sessionId(a?.sessionId);
    const parent=await s.checkout.sessions.retrieve(sid);
    // The line items belong to the parent session: the parent is
    // fetched and mode-verified first (the build contract), then
    // the items are projected with the same verification.
    assertAccountResourceMode(parent,m);
    return list(await s.checkout.sessions.listLineItems(sid,page(a)),
      v=>itemSafe(v,m));
  }),
  paylink_list:(a,c)=>guarded(c,async(s,m)=>list(
    await s.paymentLinks.list(page(a)),v=>paylinkSafe(v,m))),
  paylink_get:(a,c)=>guarded(c,async(s,m)=>paylinkSafe(
    await s.paymentLinks.retrieve(requiredId(a?.linkId,'plink')),m)),
  portal_list_configurations:(a,c)=>guarded(c,async(s,m)=>list(
    await s.billingPortal.configurations.list(page(a)),v=>portalSafe(v,m))),
  portal_get_configuration:(a,c)=>guarded(c,async(s,m)=>portalSafe(
    await s.billingPortal.configurations.retrieve(requiredId(a?.configId,'bpc')),m))
};
