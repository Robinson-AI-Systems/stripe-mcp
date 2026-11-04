// Owner-obedience V2, family 3 (Payments & refunds): the nine
// payment write operations complete the confirmed-action sequence in
// LIVE on the owner's own connection (fake provider + fake database
// only; no LIVE key, no real account, no real money). The refund
// money aim checks are unchanged: provider-derived amount, exact
// owner approval (row 20) and the shared daily cap (row 21) bind
// exactly as in TEST; confirming alone moves nothing.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {idempotencyKey} from '../../src/stripe/client.js';
import {makePaymentWrite} from '../../src/tools/payment-writes.js';

const acct='acct_LIVEPAYFIXTURE';
const parse=r=>JSON.parse(r.content[0].text);
afterEach(()=>vi.unstubAllEnvs());

async function liveDb(){
  const db=createFakeDb({accounts:[{id:acct,label:'Fixture',
    money_limit_cents:10000,live_enabled:true,live_connected:true}]});
  // A LIVE money approval requires an enrolled LIVE credential, in
  // the fake database exactly as in the real one.
  await db.saveLiveKey({account:acct,ciphertext:'v1.fake',
    kind:'restricted',last4:'FAKE'});
  // The owner's own connection row (kind 'connector'), stored in
  // LIVE mode: the money reservation binds a non-pass approval's
  // mode to this row, so the fixture connection must exist as a
  // stored row, as in production.
  await db.createAccessToken({accessToken:'owner-live-access',
    clientId:'owner-client',stripeAccount:acct,mode:'live',profile:'full',
    liveWriteApproved:true});
  return db;
}
// The owner's own OAuth connection, exactly as src/core/mcp-auth.js
// builds it, on a production deployment with LIVE access granted.
async function liveCtx(db,sdk){
  const scope=(await db.tokenRowsForTest())
    .find(t=>t.kind==='connector')?.result_scope;
  vi.stubEnv('VERCEL_ENV','production');
  return {db,connectionId:scope,liveAccessGranted:true,
    getCustomer:async()=>({id:'cus_live1',object:'customer',
      livemode:true,metadata:{}}),
    connection:{stripeAccount:acct,mode:'live',profile:'full',listing:'catalog',
      context:'customer',rtcLiveOwnerApproved:true,moneyLimitCents:0},
    services:{stripeForConnection:async()=>sdk}};
}
let intentSeq=0;
// The owner's LIVE approval, simulated through the same
// decision-intent path the protected owner page uses in production.
async function approveFor(db,ctx,tool,args){
  const key=idempotencyKey(ctx.connection,tool,args);
  const id='V2PAYM'+String(++intentSeq).padStart(26,'0');
  expect(await db.requestMoneyDecisionIntent({id,account:acct,
    idempotencyKey:key,kind:'approve',
    expiresAt:new Date(Date.now()+600000)})).toBe(true);
  expect(await db.consumeMoneyDecisionIntent(id)).toBe(true);
}

function liveSdk({objectMode=true}={}){
  const state={writes:[]};
  const pi={id:'pi_live1',object:'payment_intent',livemode:objectMode,
    status:'requires_capture',amount:8500,amount_capturable:8500,
    currency:'usd',customer:'cus_live1',latest_charge:'ch_live1',
    description:'before',metadata:{},receipt_email:null};
  const charge={id:'ch_live1',object:'charge',livemode:objectMode,
    paid:true,refunded:false,amount:8500,amount_refunded:0,
    currency:'usd',customer:'cus_live1',payment_intent:'pi_live1',
    description:'before',metadata:{},receipt_email:null,status:'succeeded'};
  const refund={id:'re_live1',object:'refund',livemode:objectMode,
    charge:'ch_live1',amount:8500,status:'requires_action',
    metadata:{},currency:'usd'};
  const setup={id:'seti_live1',object:'setup_intent',livemode:objectMode,
    status:'requires_payment_method'};
  let createdPi=null,createdRefund=null;
  const sdk={
    accounts:{retrieve:async()=>({object:'account',id:acct,livemode:true})},
    balance:{retrieve:async()=>({object:'balance',livemode:true})},
    customers:{retrieve:async()=>({id:'cus_live1',object:'customer',
      livemode:objectMode,invoice_settings:{default_payment_method:'pm_live1'}})},
    paymentMethods:{retrieve:async()=>({id:'pm_live1',
      object:'payment_method',livemode:objectMode,customer:'cus_live1'})},
    paymentIntents:{
      retrieve:async id=>id===createdPi?.id?createdPi:pi,
      create:async(payload)=>{
        state.writes.push({op:'paymentIntents.create',payload});
        createdPi={id:'pi_liveNEW',object:'payment_intent',
          livemode:objectMode,status:'succeeded',amount:payload.amount,
          currency:'usd',customer:payload.customer};return createdPi;},
      capture:async()=>{state.writes.push({op:'paymentIntents.capture'});
        pi.status='succeeded';return pi;},
      cancel:async()=>{state.writes.push({op:'paymentIntents.cancel'});
        pi.status='canceled';return pi;},
      update:async(id,payload)=>{state.writes.push({op:'paymentIntents.update',payload});
        Object.assign(pi,payload);return pi;}},
    charges:{retrieve:async()=>charge,
      update:async(id,payload)=>{state.writes.push({op:'charges.update',payload});
        Object.assign(charge,payload);return charge;}},
    refunds:{
      retrieve:async id=>id===createdRefund?.id?createdRefund:refund,
      create:async(payload)=>{state.writes.push({op:'refunds.create',payload});
        createdRefund={id:'re_liveNEW',object:'refund',livemode:objectMode,
          charge:payload.charge,amount:payload.amount,status:'succeeded',
          metadata:{}};return createdRefund;},
      update:async(id,payload)=>{state.writes.push({op:'refunds.update',payload});
        refund.metadata=payload.metadata;return refund;},
      cancel:async()=>{state.writes.push({op:'refunds.cancel'});
        refund.status='canceled';return refund;}},
    setupIntents:{retrieve:async()=>setup,
      cancel:async()=>{state.writes.push({op:'setupIntents.cancel'});
        setup.status='canceled';return setup;}}};
  return {sdk,state,pi,charge,refund,setup};
}

const tool=name=>makePaymentWrite(name).handler;
const FINGERPRINT=/^WRITE-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/;

describe('V2 Payments LIVE conversion (owner connection, fake provider)',()=>{
  it('charge_saved_method previews LIVE facts and confirms into exactly one charge',async()=>{
    const {sdk,state}=liveSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={customerId:'cus_live1',amountCents:8500,description:'Rent'};
    const preview=parse(await tool('payment_charge_saved_method')({...args,dryRun:true},ctx));
    expect(preview.done).toBe(false);
    expect(preview.mode).toBe('LIVE');
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain(
      "charge the customer's saved payment method $85.00");
    expect(preview.previewFingerprint).toMatch(FINGERPRINT);
    expect(state.writes).toHaveLength(0);
    const done=parse(await tool('payment_charge_saved_method')(
      {...args,confirm:true,requestKey:'live-charge-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].op).toBe('paymentIntents.create');
  });

  it('capture previews the amount taken and confirms into exactly one capture',async()=>{
    const {sdk,state}=liveSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const preview=parse(await tool('payment_capture')(
      {paymentId:'pi_live1',dryRun:true},ctx));
    expect(preview.mode).toBe('LIVE');
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('capture $85.00');
    const done=parse(await tool('payment_capture')(
      {paymentId:'pi_live1',confirm:true,requestKey:'live-capture-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(state.writes.map(w=>w.op)).toEqual(['paymentIntents.capture']);
  });

  it('cancel, payment_update, charge_update and setup_cancel each complete in LIVE',async()=>{
    const cases=[
      ['payment_cancel',{paymentId:'pi_live1'},'paymentIntents.cancel'],
      ['payment_update',{paymentId:'pi_live1',description:'after'},'paymentIntents.update'],
      ['charge_update',{chargeId:'ch_live1',description:'after'},'charges.update'],
      ['setup_cancel',{setupId:'seti_live1'},'setupIntents.cancel']];
    for(const [name,args,op] of cases){
      const {sdk,state}=liveSdk();const db=await liveDb();
      const ctx=await liveCtx(db,sdk);
      const preview=parse(await tool(name)({...args,dryRun:true},ctx));
      expect(preview.preview).toContain('LIVE MODE');
      const done=parse(await tool(name)({...args,confirm:true,
        requestKey:'live-'+name,previewFingerprint:preview.previewFingerprint},ctx));
      expect(done.done, name).toBe(true);
      expect(state.writes.map(w=>w.op), name).toEqual([op]);
    }
  });

  it('create_refund: confirm alone moves nothing; the exact owner approval executes exactly once and counts against the day',async()=>{
    const {sdk,state}=liveSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={chargeId:'ch_live1'};
    const preview=parse(await tool('payment_create_refund')({...args,dryRun:true},ctx));
    expect(preview.mode).toBe('LIVE');
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain(
      "refund $85.00 back to the customer's original payment method");
    expect(preview.previewFingerprint).toMatch(FINGERPRINT);
    const confirmArgs={...args,confirm:true,requestKey:'live-refund-1',
      previewFingerprint:preview.previewFingerprint};
    const refused=parse(await tool('payment_create_refund')(confirmArgs,ctx));
    expect(refused.done).toBe(false);
    expect(JSON.stringify(refused)).toMatch(/explicit approval is required/);
    expect(state.writes).toHaveLength(0);
    expect((await db.getMoneyUsage({account:acct,connection:ctx.connectionId}))
      .used_cents).toBe(0);
    await approveFor(db,ctx,'payment_create_refund',confirmArgs);
    const done=parse(await tool('payment_create_refund')(confirmArgs,ctx));
    expect(done.done).toBe(true);
    expect(state.writes.map(w=>w.op)).toEqual(['refunds.create']);
    expect((await db.getMoneyUsage({account:acct,connection:ctx.connectionId}))
      .used_cents).toBe(8500);
  });

  it('update_refund and cancel_refund complete in LIVE',async()=>{
    const cases=[
      ['payment_update_refund',{refundId:'re_live1',metadata:{note:'ok'}},'refunds.update'],
      ['payment_cancel_refund',{refundId:'re_live1'},'refunds.cancel']];
    for(const [name,args,op] of cases){
      const {sdk,state}=liveSdk();const db=await liveDb();
      const ctx=await liveCtx(db,sdk);
      const preview=parse(await tool(name)({...args,dryRun:true},ctx));
      expect(preview.preview).toContain('LIVE MODE');
      const done=parse(await tool(name)({...args,confirm:true,
        requestKey:'live-'+name,previewFingerprint:preview.previewFingerprint},ctx));
      expect(done.done, name).toBe(true);
      expect(state.writes.map(w=>w.op), name).toEqual([op]);
    }
  });

  it('a drifted confirmation refuses with the fresh fingerprint and executes nothing',async()=>{
    const {sdk,state,pi}=liveSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const preview=parse(await tool('payment_capture')(
      {paymentId:'pi_live1',dryRun:true},ctx));
    pi.amount_capturable=8000; // provider state drifts after the preview
    const refused=parse(await tool('payment_capture')(
      {paymentId:'pi_live1',confirm:true,requestKey:'live-drift-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(refused.done).toBe(false);
    expect(refused.error).toMatch(/evaluated state has changed/);
    expect(refused.previewFingerprint).toMatch(FINGERPRINT);
    expect(refused.previewFingerprint).not.toBe(preview.previewFingerprint);
    expect(state.writes).toHaveLength(0);
    const done=parse(await tool('payment_capture')(
      {paymentId:'pi_live1',confirm:true,requestKey:'live-drift-2',
        previewFingerprint:refused.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(state.writes).toHaveLength(1);
  });

  it('a TEST-mode object under a LIVE connection is refused at read, before any write',async()=>{
    const {sdk,state}=liveSdk({objectMode:false});const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    await expect(tool('payment_capture')(
      {paymentId:'pi_live1',confirm:true,requestKey:'live-wrongmode-1'},ctx))
      .rejects.toThrow('Stripe provider resource mode mismatch');
    expect(state.writes).toHaveLength(0);
  });

  it('a LIVE refund target from TEST mode is refused before approval or write',async()=>{
    const {sdk,state}=liveSdk({objectMode:false});const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    await expect(tool('payment_create_refund')(
      {chargeId:'ch_live1',confirm:true,requestKey:'live-wrongmode-2'},ctx))
      .rejects.toThrow('Stripe provider resource mode mismatch');
    expect(state.writes).toHaveLength(0);
    expect((await db.getMoneyUsage({account:acct,connection:ctx.connectionId}))
      .used_cents).toBe(0);
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
    await expect(tool('payment_capture')(
      {paymentId:'pi_live1',confirm:true,requestKey:'test-wrongmode-1'},ctx))
      .rejects.toThrow('Stripe provider resource mode mismatch');
    expect(state.writes).toHaveLength(0);
  });
});
