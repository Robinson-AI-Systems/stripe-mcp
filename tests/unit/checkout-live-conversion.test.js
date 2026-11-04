// Owner-obedience V2, family 6 (Checkout, payment links and portal
// sessions): the nine hosted write operations complete the
// confirmed-action sequence in LIVE on the owner's own connection
// (fake provider + fake database only; no LIVE key, no real account,
// no real payment link minted). The aim checks are unchanged:
// a created URL is surfaced only after hosted-URL verification, a
// payment link requires a verified active price, and the portal
// configuration is verified by feature read-back.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {makeCheckoutWrite} from '../../src/tools/checkout-writes.js';

const acct='acct_LIVEHOSTEDFIXTURE';
const parse=r=>JSON.parse(r.content[0].text);
afterEach(()=>vi.unstubAllEnvs());

async function liveDb(){
  return createFakeDb({accounts:[{id:acct,label:'Fixture',
    money_limit_cents:10000,live_enabled:true,live_connected:true}]});
}
// The owner's own OAuth connection, exactly as src/core/mcp-auth.js
// builds it, on a production deployment with LIVE access granted.
async function liveCtx(db,sdk){
  vi.stubEnv('VERCEL_ENV','production');
  return {db,connectionId:'owner-live-client',liveAccessGranted:true,
    getCustomer:async()=>({id:'cus_live1',object:'customer',
      livemode:true,metadata:{}}),
    connection:{stripeAccount:acct,mode:'live',profile:'full',listing:'catalog',
      context:'customer',rtcLiveOwnerApproved:true,moneyLimitCents:0},
    services:{stripeForConnection:async()=>sdk,
      hostedReturnUrls:{
        success:'https://example.test/payments/success',
        cancel:'https://example.test/payments/cancel',
        portal:'https://example.test/customer/return'}}};
}

function liveSdk({objectMode=true,linkActive=true,createdUrl=null}={}){
  const state={writes:[]};
  const customer={id:'cus_live1',object:'customer',livemode:objectMode,metadata:{}};
  const price={id:'price_live1',object:'price',livemode:objectMode,
    type:'one_time',recurring:null,active:true,currency:'usd',
    unit_amount:8500,metadata:{}};
  const session={id:'cs_live_FAKE1234',object:'checkout.session',
    livemode:objectMode,status:'open',mode:'payment',customer:'cus_live1',
    url:'https://checkout.stripe.com/c/pay/cs_live_FAKE1234'};
  const link={id:'plink_live1',object:'payment_link',livemode:objectMode,
    active:linkActive,url:'https://buy.stripe.com/live_FAKE1234',
    metadata:{},allow_promotion_codes:false};
  const config={id:'bpc_live1',object:'billing_portal.configuration',
    livemode:objectMode,active:true,metadata:{},
    features:{payment_method_update:{enabled:true},
      invoice_history:{enabled:true},subscription_cancel:{enabled:false},
      subscription_update:{enabled:false}}};
  let newSession=null,newLink=null,portalSession=null;
  const sdk={
    accounts:{retrieve:async()=>({object:'account',id:acct,livemode:true})},
    balance:{retrieve:async()=>({object:'balance',livemode:true})},
    customers:{retrieve:async()=>({...customer})},
    prices:{retrieve:async()=>({...price})},
    files:{retrieve:async id=>({id,object:'file',livemode:objectMode,
      purpose:'business_logo'})},
    checkout:{sessions:{
      create:async args=>{state.writes.push({op:'checkout.sessions.create'});
        newSession={id:'cs_live_NEW1234',object:'checkout.session',
          livemode:objectMode,status:'open',mode:args.mode,
          customer:args.customer,
          url:createdUrl??'https://checkout.stripe.com/c/pay/cs_live_NEW1234'};
        return {...newSession};},
      retrieve:async id=>id==='cs_live_NEW1234'?{...newSession}:{...session},
      expire:async()=>{state.writes.push({op:'checkout.sessions.expire'});
        session.status='expired';return {...session};}}},
    paymentLinks:{
      retrieve:async id=>id==='plink_NEW1234'?{...newLink}:{...link},
      create:async args=>{state.writes.push({op:'paymentLinks.create'});
        newLink={id:'plink_NEW1234',object:'payment_link',
          livemode:objectMode,active:true,
          url:createdUrl??'https://buy.stripe.com/live_NEW1234',
          metadata:args.metadata??{}};return {...newLink};},
      update:async(id,args)=>{state.writes.push({op:'paymentLinks.update'});
        if(args.active!==undefined)link.active=args.active;
        if(args.metadata)for(const [key,value] of Object.entries(args.metadata)){
          if(value==='')delete link.metadata[key];
          else link.metadata[key]=value;
        }
        if(args.allow_promotion_codes!==undefined)
          link.allow_promotion_codes=args.allow_promotion_codes;
        return {...link};}},
    billingPortal:{
      configurations:{
        retrieve:async()=>({...config,
          features:structuredClone(config.features)}),
        update:async(id,args)=>{
          state.writes.push({op:'billingPortal.configurations.update'});
          config.features={...config.features,...args.features};
          return {...config};}},
      sessions:{create:async args=>{
        state.writes.push({op:'billingPortal.sessions.create'});
        portalSession={id:'bps_NEW1234',object:'billing_portal.session',
          livemode:objectMode,customer:args.customer,
          configuration:args.configuration||'bpc_live1',
          url:'https://billing.stripe.com/p/session/live_NEW1234'};
        return {...portalSession};}}}};
  return {sdk,state,price,session,link,config};
}

const tool=name=>makeCheckoutWrite(name).handler;
const FINGERPRINT=/^WRITE-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/;

describe('V2 Checkout LIVE conversion (owner connection, fake provider)',()=>{
  it('paylink_create previews public payability at the verified price and confirms into exactly one link',async()=>{
    const {sdk,state}=liveSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={priceId:'price_live1',quantity:1};
    const preview=parse(await tool('paylink_create')({...args,dryRun:true},ctx));
    expect(preview.done).toBe(false);
    expect(preview.mode).toBe('LIVE');
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('verified price of $85.00');
    expect(preview.preview).toContain('Anyone who has the link can pay it with a real card');
    expect(preview.previewFingerprint).toMatch(FINGERPRINT);
    expect(state.writes).toHaveLength(0);
    const done=parse(await tool('paylink_create')(
      {...args,confirm:true,requestKey:'live-paylink-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(done.url).toBe('https://buy.stripe.com/live_NEW1234');
    expect(state.writes.map(w=>w.op)).toEqual(['paymentLinks.create']);
  });

  it('checkout_create_payment_link_for_customer previews the verified price and confirms into one hosted page',async()=>{
    const {sdk,state}=liveSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={customerId:'cus_live1',priceId:'price_live1'};
    const preview=parse(await tool('checkout_create_payment_link_for_customer')({...args,dryRun:true},ctx));
    expect(preview.mode).toBe('LIVE');
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('verified price of $85.00');
    expect(preview.preview).toContain('Anyone who has the page link can open it and pay with a real card');
    const done=parse(await tool('checkout_create_payment_link_for_customer')(
      {...args,confirm:true,requestKey:'live-customer-page-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(done.url).toBe('https://checkout.stripe.com/c/pay/cs_live_NEW1234');
    expect(state.writes.map(w=>w.op)).toEqual(['checkout.sessions.create']);
  });

  it('checkout_create_setup_link previews that no money is charged and confirms into one setup page',async()=>{
    const {sdk,state}=liveSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={customerId:'cus_live1'};
    const preview=parse(await tool('checkout_create_setup_link')({...args,dryRun:true},ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('No money is charged');
    const done=parse(await tool('checkout_create_setup_link')(
      {...args,confirm:true,requestKey:'live-setup-page-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(done.url).toBe('https://checkout.stripe.com/c/pay/cs_live_NEW1234');
    expect(state.writes.map(w=>w.op)).toEqual(['checkout.sessions.create']);
  });

  it('checkout_expire accepts a cs_live session id and confirms into one expire',async()=>{
    const {sdk,state}=liveSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={sessionId:'cs_live_FAKE1234'};
    const preview=parse(await tool('checkout_expire')({...args,dryRun:true},ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('stops accepting payment right away');
    const done=parse(await tool('checkout_expire')(
      {...args,confirm:true,requestKey:'live-expire-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(state.writes.map(w=>w.op)).toEqual(['checkout.sessions.expire']);
  });

  it('paylink_update, paylink_deactivate and paylink_activate each complete in LIVE',async()=>{
    const cases=[
      ['paylink_update',{linkId:'plink_live1',metadata:{department:'sales'}},true],
      ['paylink_deactivate',{linkId:'plink_live1'},true],
      ['paylink_activate',{linkId:'plink_live1'},false]];
    for(const [name,args,linkActive] of cases){
      const {sdk,state}=liveSdk({linkActive});const db=await liveDb();
      const ctx=await liveCtx(db,sdk);
      const preview=parse(await tool(name)({...args,dryRun:true},ctx));
      expect(preview.preview).toContain('LIVE MODE');
      const done=parse(await tool(name)({...args,confirm:true,
        requestKey:'live-'+name,previewFingerprint:preview.previewFingerprint},ctx));
      expect(done.done,name).toBe(true);
      expect(state.writes.map(w=>w.op),name).toEqual(['paymentLinks.update']);
    }
  });

  it('portal_create_session confirms into one verified portal link',async()=>{
    const {sdk,state}=liveSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={customerId:'cus_live1',configId:'bpc_live1'};
    const preview=parse(await tool('portal_create_session')({...args,dryRun:true},ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('short-lived hosted customer-portal link');
    const done=parse(await tool('portal_create_session')(
      {...args,confirm:true,requestKey:'live-portal-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(done.url).toBe('https://billing.stripe.com/p/session/live_NEW1234');
    expect(state.writes.map(w=>w.op)).toEqual(['billingPortal.sessions.create']);
  });

  it('portal_update_configuration previews the exact customer powers and confirms the policy change',async()=>{
    const {sdk,state,config}=liveSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={configId:'bpc_live1',subscriptionCancel:true};
    const preview=parse(await tool('portal_update_configuration')({...args,dryRun:true},ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('customers CAN cancel their own subscriptions');
    const done=parse(await tool('portal_update_configuration')(
      {...args,confirm:true,requestKey:'live-portal-config-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(config.features.subscription_cancel.enabled).toBe(true);
    expect(state.writes.map(w=>w.op)).toEqual(['billingPortal.configurations.update']);
  });

  it('a drifted confirmation refuses with the fresh fingerprint and executes nothing',async()=>{
    const {sdk,state,price}=liveSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={priceId:'price_live1',quantity:1};
    const preview=parse(await tool('paylink_create')({...args,dryRun:true},ctx));
    price.unit_amount=9000; // provider state drifts after the preview
    const refused=parse(await tool('paylink_create')(
      {...args,confirm:true,requestKey:'live-drift-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(refused.done).toBe(false);
    expect(refused.error).toMatch(/evaluated state has changed/);
    expect(refused.previewFingerprint).toMatch(FINGERPRINT);
    expect(refused.previewFingerprint).not.toBe(preview.previewFingerprint);
    expect(state.writes).toHaveLength(0);
    const done=parse(await tool('paylink_create')(
      {...args,confirm:true,requestKey:'live-drift-2',
        previewFingerprint:refused.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(state.writes).toHaveLength(1);
  });

  it('a TEST-mode object under a LIVE connection is refused at read, before any write',async()=>{
    const {sdk,state}=liveSdk({objectMode:false});const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    await expect(tool('paylink_create')(
      {priceId:'price_live1',confirm:true,requestKey:'live-wrongmode-1'},ctx))
      .rejects.toThrow('Stripe provider resource mode mismatch');
    expect(state.writes).toHaveLength(0);
  });

  it('a LIVE-mode object under a TEST connection is refused the other way',async()=>{
    const {sdk,state}=liveSdk({objectMode:true});
    const db=createFakeDb();
    const ctx={db,connectionId:'owner-client-fixture',
      getCustomer:async()=>({id:'cus_live1',object:'customer',
        livemode:true,metadata:{}}),
      connection:{stripeAccount:acct,mode:'test',profile:'full',listing:'catalog',
        context:'customer',moneyLimitCents:0},
      services:{stripeForConnection:async()=>sdk}};
    await expect(tool('paylink_create')(
      {priceId:'price_live1',confirm:true,requestKey:'test-wrongmode-1'},ctx))
      .rejects.toThrow('Stripe provider resource mode mismatch');
    expect(state.writes).toHaveLength(0);
  });

  it('a created URL that is not Stripe-hosted is never surfaced and the write is not confirmed',async()=>{
    const {sdk,state}=liveSdk({createdUrl:'https://evil.example/pay/NEW1234'});
    const db=await liveDb();const ctx=await liveCtx(db,sdk);
    const result=parse(await tool('paylink_create')(
      {priceId:'price_live1',quantity:1,confirm:true,
        requestKey:'live-badurl-1'},ctx));
    expect(result.done).toBe(false);
    expect(result.confirmed).toBe(false);
    expect(result.url).toBeUndefined();
    expect(state.writes).toHaveLength(1);
  });
});
