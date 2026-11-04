// CAP-4 D-5 — checkout, payment-link and portal-configuration READ
// tools verify every returned object against the connection's own
// mode. At baseline the family was refusal-only in two layers: the
// shared `guarded` helper refused every non-TEST connection before
// any provider call ('TEST Stripe provider unavailable'), and the
// session-ID pattern admitted only cs_test_ IDs, so no LIVE session
// could even be addressed; the projections themselves carried no
// mode verification at all. Recorded honestly: 14 of these 18
// tests fail at the pre-D-5 baseline (every LIVE happy path, the
// projection refusals on both connection modes, the parent and
// item verification on the line-item read, the projection mode
// contract, the descriptions, and the malformed-ID text, whose
// refusal message the conversion renames). Four pass at baseline
// and after: the two byte-identical TEST output pins and the tool
// registration pin — proving TEST behavior and field sets did not
// move — and the wrong-mode-parent line-item refusal, whose
// outcome at baseline was produced by the cs_test-only ID pattern
// and after conversion is produced by the parent mode
// verification it names.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {tools,handlers,checkoutSafe,itemSafe,paylinkSafe,portalSafe}
  from '../../src/tools/checkout.js';

const acct='acct_D5FAKE';
const parse=r=>JSON.parse(r.content[0].text);
const secret='CLIENT_SECRET_SENTINEL';

const sessionBase={object:'checkout.session',mode:'payment',
  status:'complete',payment_status:'paid',customer:'cus_D5FAKE',
  payment_intent:'pi_D5FAKE',subscription:null,amount_total:1500,
  currency:'usd',url:'https://checkout.stripe.com/c/pay/FAKE',
  expires_at:1695766597,created:1695680197,client_secret:secret};
const session=(livemode,over={})=>({id:livemode?'cs_live_D5FAKE1':'cs_test_D5FAKE1',
  ...sessionBase,livemode,...over});
const itemBase={id:'li_D5FAKE',description:'Washer rental',
  amount_subtotal:1500,amount_total:1500,currency:'usd',quantity:1,
  price:{id:'price_D5FAKE'}};
const item=livemode=>({...itemBase,livemode});
const linkBase={id:'plink_D5FAKE',active:true,
  url:'https://buy.stripe.com/FAKE',created:1695680197,
  metadata:{source:'unit'}};
const link=livemode=>({...linkBase,livemode});
const portalBase={id:'bpc_D5FAKE',name:'Default',active:true,
  is_default:true,default_return_url:'https://example.com/return',
  business_profile:{headline:'Acme',
    privacy_policy_url:'https://example.com/privacy',
    terms_of_service_url:'https://example.com/terms'},
  features:{payment_method_update:{enabled:true},
    invoice_history:{enabled:true},subscription_cancel:{enabled:false},
    subscription_update:{enabled:true}}};
const portal=livemode=>({...portalBase,livemode});

const liveSdkParts={accounts:{retrieve:async()=>({id:acct,
    object:'account',livemode:true})},
  balance:{retrieve:async()=>({object:'balance',livemode:true})}};
function sdk({sess=sess0(),items=[item(false)],links=[link(false)],
  portals=[portal(false)]}={}) {
  return {...liveSdkParts,
    checkout:{sessions:{
      list:vi.fn(async()=>({data:[sess],has_more:false})),
      retrieve:vi.fn(async()=>sess),
      listLineItems:vi.fn(async()=>({data:items,has_more:false}))}},
    paymentLinks:{
      list:vi.fn(async()=>({data:links,has_more:false})),
      retrieve:vi.fn(async()=>links[0])},
    billingPortal:{configurations:{
      list:vi.fn(async()=>({data:portals,has_more:false})),
      retrieve:vi.fn(async()=>portals[0])}}};
}
function sess0(){return session(false);}
function testCtx(s){
  return {connection:{stripeAccount:acct,mode:'test',profile:'full'},
    services:{stripeForConnection:async()=>s}};
}
async function liveCtx(s){
  vi.stubEnv('VERCEL_ENV','production');
  const db=createFakeDb({accounts:[{id:acct,live_enabled:true,
    live_connected:true,money_limit_cents:0}]});
  return {db,connection:{stripeAccount:acct,mode:'live',profile:'full'},
    services:{stripeForConnection:async()=>s}};
}
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});

describe('CAP-4 D-5 checkout session reads verify the connection mode',()=>{
  it('serves verified LIVE sessions in list and get',async()=>{
    const s=sdk({sess:session(true)}),ctx=await liveCtx(s);
    const list=parse(await handlers.checkout_list({limit:5},ctx));
    expect(s.checkout.sessions.list).toHaveBeenCalledWith({limit:5});
    expect(list.data[0]).toMatchObject({id:'cs_live_D5FAKE1',
      object:'checkout.session',mode:'payment',status:'complete',
      paymentStatus:'paid',amountTotal:1500,currency:'usd'});
    expect(parse(await handlers.checkout_get(
      {sessionId:'cs_live_D5FAKE1'},ctx)).id).toBe('cs_live_D5FAKE1');
  });
  it('projects the session mode field untouched on a LIVE connection',async()=>{
    const s=sdk({sess:session(true,{mode:'subscription',
      subscription:'sub_D5FAKE'})}),ctx=await liveCtx(s);
    const got=parse(await handlers.checkout_get(
      {sessionId:'cs_live_D5FAKE1'},ctx));
    expect(got.mode).toBe('subscription');
    expect(got.subscription).toBe('sub_D5FAKE');
  });
  it('never leaks the client secret on LIVE session reads',async()=>{
    const s=sdk({sess:session(true)}),ctx=await liveCtx(s);
    const serialized=JSON.stringify([
      await handlers.checkout_list({},ctx),
      await handlers.checkout_get({sessionId:'cs_live_D5FAKE1'},ctx)]);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain('client_secret');
  });
  it('refuses a TEST session on a LIVE connection at the projection',async()=>{
    const s=sdk({sess:session(false)}),ctx=await liveCtx(s);
    expect((await handlers.checkout_list({},ctx)).isError).toBe(true);
    expect(s.checkout.sessions.list).toHaveBeenCalled();
    expect((await handlers.checkout_get(
      {sessionId:'cs_test_D5FAKE1'},ctx)).isError).toBe(true);
    expect(s.checkout.sessions.retrieve)
      .toHaveBeenCalledWith('cs_test_D5FAKE1');
  });
  it('refuses a LIVE session on a TEST connection in list and get',async()=>{
    const s=sdk({sess:session(true)}),ctx=testCtx(s);
    expect((await handlers.checkout_list({},ctx)).isError).toBe(true);
    expect((await handlers.checkout_get(
      {sessionId:'cs_live_D5FAKE1'},ctx)).isError).toBe(true);
  });
  it('refuses a malformed session id before any provider call',async()=>{
    const s=sdk(),ctx=testCtx(s);
    const r=await handlers.checkout_get({sessionId:'cs_FAKE'},ctx);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('Invalid checkout session id');
    expect(s.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });
  it('serves verified LIVE line items, parent fetched and verified first',async()=>{
    const s=sdk({sess:session(true),items:[item(true)]}),
      ctx=await liveCtx(s);
    const v=parse(await handlers.checkout_list_line_items(
      {sessionId:'cs_live_D5FAKE1',limit:10},ctx));
    expect(s.checkout.sessions.retrieve)
      .toHaveBeenCalledWith('cs_live_D5FAKE1');
    expect(s.checkout.sessions.listLineItems)
      .toHaveBeenCalledWith('cs_live_D5FAKE1',{limit:10});
    expect(v.data[0]).toMatchObject({id:'li_D5FAKE',
      description:'Washer rental',amountTotal:1500,quantity:1,
      price:'price_D5FAKE'});
  });
  it('refuses line items when the parent session is the wrong mode',async()=>{
    const s=sdk({sess:session(true),items:[item(false)]}),
      ctx=testCtx(s);
    expect((await handlers.checkout_list_line_items(
      {sessionId:'cs_live_D5FAKE1'},ctx)).isError).toBe(true);
    expect(s.checkout.sessions.listLineItems).not.toHaveBeenCalled();
  });
  it('refuses a wrong-mode line item even when the parent matches',async()=>{
    const s=sdk({sess:session(false),items:[item(true)]}),
      ctx=testCtx(s);
    expect((await handlers.checkout_list_line_items(
      {sessionId:'cs_test_D5FAKE1'},ctx)).isError).toBe(true);
    expect(s.checkout.sessions.listLineItems).toHaveBeenCalled();
  });
  it('keeps TEST session outputs byte-identical to baseline',async()=>{
    const ctx=testCtx(sdk());
    expect(parse(await handlers.checkout_get(
      {sessionId:'cs_test_D5FAKE1'},ctx))).toEqual({
      id:'cs_test_D5FAKE1',object:'checkout.session',mode:'payment',
      status:'complete',paymentStatus:'paid',customer:'cus_D5FAKE',
      paymentIntent:'pi_D5FAKE',subscription:null,amountTotal:1500,
      currency:'usd',url:'https://checkout.stripe.com/c/pay/FAKE',
      expiresAt:'Sep 26, 2023, 16:16:37 MDT',
      created_local:'Sep 25, 2023, 16:16:37 MDT'});
    const items=parse(await handlers.checkout_list_line_items(
      {sessionId:'cs_test_D5FAKE1'},ctx));
    expect(items.data[0]).toEqual({id:'li_D5FAKE',object:'item',
      description:'Washer rental',amountSubtotal:1500,
      amountTotal:1500,currency:'usd',quantity:1,
      price:'price_D5FAKE'});
    expect(items.has_more).toBe(false);
  });
});

describe('CAP-4 D-5 payment link and portal reads verify the connection mode',()=>{
  it('serves verified LIVE payment links in list and get',async()=>{
    const s=sdk({links:[link(true)]}),ctx=await liveCtx(s);
    const list=parse(await handlers.paylink_list({limit:5},ctx));
    expect(list.data[0]).toMatchObject({id:'plink_D5FAKE',
      object:'payment_link',active:true,
      url:'https://buy.stripe.com/FAKE'});
    expect(parse(await handlers.paylink_get(
      {linkId:'plink_D5FAKE'},ctx)).id).toBe('plink_D5FAKE');
  });
  it('refuses wrong-mode payment links on both connection modes',async()=>{
    const liveSide=await liveCtx(sdk({links:[link(false)]}));
    expect((await handlers.paylink_list({},liveSide)).isError).toBe(true);
    expect((await handlers.paylink_get(
      {linkId:'plink_D5FAKE'},liveSide)).isError).toBe(true);
    const testSide=testCtx(sdk({links:[link(true)]}));
    expect((await handlers.paylink_list({},testSide)).isError).toBe(true);
    expect((await handlers.paylink_get(
      {linkId:'plink_D5FAKE'},testSide)).isError).toBe(true);
  });
  it('serves verified LIVE portal configurations in list and get',async()=>{
    const s=sdk({portals:[portal(true)]}),ctx=await liveCtx(s);
    const list=parse(await handlers.portal_list_configurations(
      {limit:5},ctx));
    expect(list.data[0]).toMatchObject({id:'bpc_D5FAKE',
      object:'billing_portal.configuration',name:'Default',
      active:true,isDefault:true,
      features:{paymentMethodUpdate:true,invoiceHistory:true,
        subscriptionCancel:false,subscriptionUpdate:true}});
    expect(parse(await handlers.portal_get_configuration(
      {configId:'bpc_D5FAKE'},ctx)).appearance.headline).toBe('Acme');
  });
  it('refuses wrong-mode portal configurations on both connection modes',async()=>{
    const liveSide=await liveCtx(sdk({portals:[portal(false)]}));
    expect((await handlers.portal_list_configurations(
      {},liveSide)).isError).toBe(true);
    expect((await handlers.portal_get_configuration(
      {configId:'bpc_D5FAKE'},liveSide)).isError).toBe(true);
    const testSide=testCtx(sdk({portals:[portal(true)]}));
    expect((await handlers.portal_list_configurations(
      {},testSide)).isError).toBe(true);
    expect((await handlers.portal_get_configuration(
      {configId:'bpc_D5FAKE'},testSide)).isError).toBe(true);
  });
  it('keeps TEST paylink and portal outputs byte-identical to baseline',async()=>{
    const ctx=testCtx(sdk());
    expect(parse(await handlers.paylink_get({linkId:'plink_D5FAKE'},ctx)))
      .toEqual({id:'plink_D5FAKE',object:'payment_link',active:true,
        url:'https://buy.stripe.com/FAKE',
        created_local:'Sep 25, 2023, 16:16:37 MDT',
        metadata:{source:'unit'}});
    expect(parse(await handlers.portal_get_configuration(
      {configId:'bpc_D5FAKE'},ctx))).toEqual({id:'bpc_D5FAKE',
      object:'billing_portal.configuration',name:'Default',
      appearance:{headline:'Acme',
        privacyUrl:'https://example.com/privacy',
        termsUrl:'https://example.com/terms'},
      active:true,isDefault:true,
      defaultReturnUrl:'https://example.com/return',
      features:{paymentMethodUpdate:true,invoiceHistory:true,
        subscriptionCancel:false,subscriptionUpdate:true}});
  });
});

describe('CAP-4 D-5 projection mode contract and registry',()=>{
  it('projections verify a supplied mode in both directions; no-mode is historical',()=>{
    expect(checkoutSafe(session(false))).toMatchObject(
      {id:'cs_test_D5FAKE1'});
    // The baseline projections carried no mode check at all, so a
    // no-mode caller still projects a LIVE object — recorded in the
    // card as this family's deliberate difference from D-4, whose
    // projections hard-required TEST at baseline.
    expect(checkoutSafe(session(true))).toMatchObject(
      {id:'cs_live_D5FAKE1'});
    expect(checkoutSafe(session(false),'test')).toMatchObject(
      {id:'cs_test_D5FAKE1'});
    expect(checkoutSafe(session(true),'live')).toMatchObject(
      {id:'cs_live_D5FAKE1'});
    expect(()=>checkoutSafe(session(true),'test')).toThrow(
      'Stripe provider resource mode mismatch');
    expect(()=>checkoutSafe(session(false),'live')).toThrow(
      'Stripe provider resource mode mismatch');
    expect(()=>itemSafe(item(true),'test')).toThrow();
    expect(()=>paylinkSafe(link(false),'live')).toThrow();
    expect(()=>portalSafe(portal(true),'test')).toThrow();
    expect(paylinkSafe(link(true),'live')).toMatchObject(
      {id:'plink_D5FAKE'});
    expect(portalSafe(portal(false),'test')).toMatchObject(
      {id:'bpc_D5FAKE'});
  });
  it('descriptions name both modes',()=>{
    for(const t of tools)expect(t.description).toContain('LIVE');
  });
  it('registers exactly the seven family tools, all read-only',()=>{
    expect(tools.map(t=>t.name)).toEqual([
      'checkout_list','checkout_get','checkout_list_line_items',
      'paylink_list','paylink_get','portal_list_configurations',
      'portal_get_configuration']);
    for(const t of tools)expect(t.writes).toBe(false);
  });
});
