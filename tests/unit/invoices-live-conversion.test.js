// Owner-obedience V2, family 4 (Invoices & credit notes): the
// fourteen invoice write operations are admitted by the dispatcher
// in BOTH modes (this family was refused at the dispatcher in TEST
// too, so TEST reachability is itself new) and complete the
// confirmed-action sequence in LIVE on the owner's own connection
// (fake provider + fake database only; no LIVE key, no real
// account, no real money). The money aim checks are unchanged:
// creditnote_create still executes only through the guarded money
// contract with provider-derived amounts, exact owner approval
// (row 20) and the shared daily cap (row 21); confirming alone
// moves nothing. invoice_charge_now is money-in and keeps its
// provider-derived exact-balance proof.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {idempotencyKey} from '../../src/stripe/client.js';
import {registry} from '../../src/tools/index.js';
import {isGuardedTestWrite,isGuardedLiveWrite,listingForConnection}
  from '../../src/core/profiles.js';
const tools=registry.tools;
import {handlers as draftHandlers} from '../../src/tools/invoice-writes.js';
import {handlers as lifecycleHandlers}
  from '../../src/tools/invoice-lifecycle-writes.js';
import {handlers as creditHandlers} from '../../src/tools/creditnote-writes.js';

const NAMES=['invoice_create_draft','invoice_update_draft','invoice_add_line',
  'invoice_update_line','invoice_remove_line','invoice_delete_draft',
  'invoice_finalize','invoice_send','invoice_charge_now',
  'invoice_mark_paid_outside_stripe','invoice_void','invoice_mark_uncollectible',
  'creditnote_create','creditnote_void'];
const acct='acct_LIVEINV';
const parse=r=>JSON.parse(r.content[0].text);
const FINGERPRINT=/^WRITE-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/;
afterEach(()=>vi.unstubAllEnvs());

describe('V2 Invoices dispatcher admission (both modes)',()=>{
  const family=tools.filter(t=>NAMES.includes(t.name));
  it('the registry carries exactly the fourteen family tools',()=>{
    expect(family.map(t=>t.name).sort()).toEqual([...NAMES].sort());
  });
  it('admits all fourteen in TEST for write-eligible profiles, never read_only',()=>{
    for(const t of family){
      expect(isGuardedTestWrite(t,{mode:'test',profile:'full'}),t.name).toBe(true);
      expect(isGuardedTestWrite(t,{mode:'test',profile:'everyday'}),t.name).toBe(true);
      expect(isGuardedTestWrite(t,{mode:'test',profile:'read_only'}),t.name).toBe(false);
    }
  });
  it('admits all fourteen in LIVE only on the owner-approved connection',()=>{
    const owner={mode:'live',profile:'full',listing:'catalog',
      context:'customer',rtcLiveOwnerApproved:true,moneyLimitCents:0};
    for(const t of family){
      expect(isGuardedLiveWrite(t,owner),t.name).toBe(true);
      expect(isGuardedLiveWrite(t,{...owner,rtcLiveOwnerApproved:false}),
        t.name).toBe(false);
    }
  });
  it('without the owner context, the money tools need a positive money ceiling',()=>{
    const funded={mode:'live',profile:'full',listing:'catalog',
      rtcLiveOwnerApproved:true,moneyLimitCents:100000};
    for(const t of family)
      expect(isGuardedLiveWrite(t,funded),t.name).toBe(true);
    const unfunded={...funded,moneyLimitCents:0};
    expect(isGuardedLiveWrite(family.find(t=>t.name==='creditnote_create'),
      unfunded)).toBe(false);
    expect(isGuardedLiveWrite(family.find(t=>t.name==='invoice_charge_now'),
      unfunded)).toBe(false);
    expect(isGuardedLiveWrite(family.find(t=>t.name==='invoice_void'),
      unfunded)).toBe(true);
  });
  it('lists all fourteen in the TEST catalog and the LIVE owner catalog',()=>{
    const testNames=listingForConnection(registry,
      {mode:'test',profile:'full',listing:'catalog'}).map(t=>t.name);
    const liveNames=listingForConnection(registry,
      {mode:'live',profile:'full',listing:'catalog',context:'customer',
        rtcLiveOwnerApproved:true,moneyLimitCents:0})
      .map(t=>t.name);
    for(const n of NAMES){
      expect(testNames,n).toContain(n);
      expect(liveNames,n).toContain(n);
    }
  });
});

// ---- fake provider -------------------------------------------------
function fixtureSdk({objectMode=true}={}){
  const state={writes:[]};
  const customer={id:'cus_live1',object:'customer',livemode:objectMode,
    metadata:{},
    email:'owner@example.com',deleted:false,
    invoice_settings:{default_payment_method:'pm_live1'}};
  const pm={id:'pm_live1',object:'payment_method',livemode:objectMode,
    customer:'cus_live1'};
  const line=(id,amount)=>({id,object:'line_item',amount,quantity:1,
    price:{id:'price_live1',unit_amount:amount,currency:'usd',
      product:'prod_live1',recurring:null},discount_amounts:[]});
  const invoice=(id,status,method)=>({id,object:'invoice',
    livemode:objectMode,customer:'cus_live1',status,currency:'usd',
    collection_method:method,auto_advance:false,number:null,metadata:{},
    description:null,discount:null,discounts:[],effective_at:null,
    footer:null,payment_intent:null,deleted:false,
    hosted_invoice_url:method==='send_invoice'?'https://invoice.example/x':null,
    automatic_tax:{enabled:false,status:null},
    total:2000,subtotal:2000,amount_due:2000,amount_remaining:2000,
    amount_paid:0,total_tax_amounts:[],total_discount_amounts:[],
    lines:{object:'list',data:[line('il_'+id,2000)]}});
  const paidInvoice=invoice('in_livePAID','paid','charge_automatically');
  paidInvoice.total=20000;paidInvoice.subtotal=20000;
  paidInvoice.amount_paid=20000;paidInvoice.amount_due=0;
  paidInvoice.amount_remaining=0;paidInvoice.paid=true;
  paidInvoice.lines={object:'list',data:[line('il_in_livePAID',20000)]};
  const store=new Map([
    ['in_liveDRAFT',invoice('in_liveDRAFT','draft','send_invoice')],
    ['in_liveAUTO',invoice('in_liveAUTO','open','charge_automatically')],
    ['in_liveSEND',invoice('in_liveSEND','open','send_invoice')],
    ['in_livePAID',paidInvoice]]);
  const totals=inv=>{
    inv.subtotal=inv.lines.data.reduce((n,l)=>n+l.amount,0);
    inv.total=inv.subtotal;inv.amount_due=inv.total;inv.amount_remaining=inv.total;};
  const missing=()=>Object.assign(new Error('missing'),
    {statusCode:404,code:'resource_missing'});
  const items=new Map([['ii_DRAFT1',{id:'ii_DRAFT1',object:'invoiceitem',
    livemode:objectMode,invoice:'in_liveDRAFT',customer:'cus_live1',
    amount:2000,currency:'usd',metadata:{},proration:false,
    description:'Initial'}]]);
  const creditNote={id:'cn_live1',object:'credit_note',livemode:objectMode,
    status:'issued',currency:'usd',amount:8500,invoice:'in_livePAID',
    customer:'cus_live1',reason:'duplicate',type:'post_payment',
    refund_amount:0,out_of_band_amount:0,credit_amount:8500,
    effective_at:1700000000,memo:null,lines:{object:'list',data:[]}};
  let createdNote=null;
  const sdk={
    accounts:{retrieve:async()=>({object:'account',id:acct,livemode:true})},
    balance:{retrieve:async()=>({object:'balance',livemode:true})},
    customers:{retrieve:async()=>structuredClone(customer)},
    paymentMethods:{retrieve:async()=>structuredClone(pm)},
    invoices:{
      retrieve:async id=>{
        const inv=store.get(id);
        if(!inv||inv.deleted)throw missing();
        return structuredClone(inv);},
      create:async(payload,opts)=>{
        state.writes.push({op:'invoices.create',payload,opts});
        const inv=invoice('in_liveNEW','draft',payload.collection_method);
        inv.customer=payload.customer;inv.description=payload.description??null;
        inv.lines={object:'list',data:[]};totals(inv);
        store.set(inv.id,inv);return structuredClone(inv);},
      update:async(id,payload,opts)=>{
        state.writes.push({op:'invoices.update',payload,opts});
        const inv=store.get(id);Object.assign(inv,payload);
        return structuredClone(inv);},
      del:async(id,payload,opts)=>{
        state.writes.push({op:'invoices.del',opts});
        const inv=store.get(id);inv.deleted=true;
        return structuredClone(inv);},
      finalizeInvoice:async(id,payload,opts)=>{
        state.writes.push({op:'invoices.finalize',opts});
        const inv=store.get(id);inv.status='open';
        inv.status_transitions={finalized_at:1700000000};
        return structuredClone(inv);},
      sendInvoice:async(id,payload,opts)=>{
        state.writes.push({op:'invoices.send',opts});
        return structuredClone(store.get(id));},
      pay:async(id,payload,opts)=>{
        state.writes.push({op:'invoices.pay',payload,opts});
        const inv=store.get(id);inv.status='paid';inv.paid=true;
        inv.paid_out_of_band=payload.paid_out_of_band===true;
        inv.amount_paid=inv.total;inv.amount_remaining=0;
        return structuredClone(inv);},
      voidInvoice:async(id,payload,opts)=>{
        state.writes.push({op:'invoices.void',opts});
        const inv=store.get(id);inv.status='void';
        inv.status_transitions={voided_at:1700000000};
        return structuredClone(inv);},
      markUncollectible:async(id,payload,opts)=>{
        state.writes.push({op:'invoices.uncollectible',opts});
        const inv=store.get(id);inv.status='uncollectible';
        inv.status_transitions={marked_uncollectible_at:1700000000};
        return structuredClone(inv);}},
    invoiceItems:{
      retrieve:async id=>{
        const item=items.get(id);
        if(!item)throw missing();
        return structuredClone(item);},
      list:async({invoice:id})=>({object:'list',has_more:false,
        data:[...items.values()].filter(i=>i.invoice===id)
          .map(i=>structuredClone(i))}),
      create:async(payload,opts)=>{
        state.writes.push({op:'invoiceItems.create',payload,opts});
        const item={id:'ii_liveNEW',object:'invoiceitem',
          livemode:objectMode,invoice:payload.invoice,customer:'cus_live1',
          amount:payload.amount,currency:'usd',metadata:{},proration:false,
          description:payload.description??null};
        items.set(item.id,item);
        const inv=store.get(payload.invoice);
        inv.lines.data.push(line('il_liveNEW',payload.amount));totals(inv);
        return structuredClone(item);},
      update:async(id,payload,opts)=>{
        state.writes.push({op:'invoiceItems.update',payload,opts});
        const item=items.get(id);
        if(!item)throw missing();
        if(payload.amount!==undefined)item.amount=payload.amount;
        if(payload.description!==undefined)item.description=payload.description;
        const inv=store.get(item.invoice);
        if(payload.amount!==undefined&&inv.lines.data[0])
          inv.lines.data[0].amount=payload.amount;
        totals(inv);return structuredClone(item);},
      del:async(id,payload,opts)=>{
        state.writes.push({op:'invoiceItems.delete',opts});
        const item=items.get(id);
        if(!item)throw missing();
        items.delete(id);
        const inv=store.get(item.invoice);
        inv.lines.data=[];totals(inv);
        return {id,object:'invoiceitem',deleted:true};}},
    paymentIntents:{create:async()=>({id:'pi_live1',object:'payment_intent',
      status:'succeeded',livemode:objectMode})},
    creditNotes:{
      preview:async()=>({id:'cn_livePREVIEW',object:'credit_note',
        livemode:objectMode,
        amount:8500,invoice:'in_livePAID',customer:'cus_live1',
        out_of_band_amount:0,refund_amount:8500,credit_amount:0,
        effective_at:1700000000,reason:'duplicate',type:'post_payment',
        status:'issued',currency:'usd',memo:null,
        lines:{object:'list',data:[]}}),
      create:async(payload,opts)=>{
        state.writes.push({op:'creditNotes.create',payload,opts});
        createdNote={...creditNote,id:'cn_liveNEW',livemode:objectMode,
          invoice:payload.invoice,amount:payload.amount,
          refund_amount:payload.amount,credit_amount:0};
        return structuredClone(createdNote);},
      retrieve:async id=>{
        const cn=id===createdNote?.id?createdNote:creditNote;
        return structuredClone(cn);},
      voidCreditNote:async(id,payload,opts)=>{
        state.writes.push({op:'creditNotes.void',opts});
        creditNote.status='void';return structuredClone(creditNote);},
      list:async()=>({object:'list',data:[]})}};
  return {sdk,state,store,customer};
}

async function liveDb(){
  const db=createFakeDb({accounts:[{id:acct,label:'Fixture',
    money_limit_cents:100000,live_enabled:true,live_connected:true}]});
  await db.saveLiveKey({account:acct,ciphertext:'v1.fake',
    kind:'restricted',last4:'FAKE'});
  await db.createAccessToken({accessToken:'owner-live-access',
    clientId:'owner-client',stripeAccount:acct,mode:'live',profile:'full',
    liveWriteApproved:true});
  return db;
}
async function liveCtx(db,sdk){
  const scope=(await db.tokenRowsForTest())
    .find(t=>t.kind==='connector')?.result_scope;
  vi.stubEnv('VERCEL_ENV','production');
  return {db,connectionId:scope,liveAccessGranted:true,
    connection:{stripeAccount:acct,mode:'live',profile:'full',listing:'catalog',
      context:'customer',rtcLiveOwnerApproved:true,moneyLimitCents:0},
    services:{stripeForConnection:async()=>sdk}};
}
let intentSeq=0;
async function approveFor(db,ctx,tool,args){
  const key=idempotencyKey(ctx.connection,tool,args);
  const id='V2INVM'+String(++intentSeq).padStart(26,'0');
  expect(await db.requestMoneyDecisionIntent({id,account:acct,
    idempotencyKey:key,kind:'approve',
    expiresAt:new Date(Date.now()+600000)})).toBe(true);
  expect(await db.consumeMoneyDecisionIntent(id)).toBe(true);
}

describe('V2 Invoices TEST reachability (new for this family)',()=>{
  const testCtx=(db,sdk)=>({db,connectionId:'owner-client-fixture',
    connection:{stripeAccount:acct,mode:'test',profile:'full',listing:'catalog',
      context:'customer',moneyLimitCents:0},
    services:{stripeForConnection:async()=>sdk}});

  it('invoice_create_draft completes preview to confirm end to end in TEST',async()=>{
    const {sdk,state}=fixtureSdk({objectMode:false});const db=createFakeDb();
    const ctx=testCtx(db,sdk);
    const args={customerId:'cus_live1',collectionMethod:'send_invoice',
      daysUntilDue:7};
    const preview=parse(await draftHandlers.invoice_create_draft(
      {...args,dryRun:true},ctx));
    expect(preview.done).toBe(false);
    expect(preview.mode).toBe('test');
    expect(preview.preview).toContain('TEST MODE');
    expect(preview.previewFingerprint).toMatch(FINGERPRINT);
    expect(state.writes).toHaveLength(0);
    const done=parse(await draftHandlers.invoice_create_draft(
      {...args,confirm:true,requestKey:'test-create-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(state.writes.map(w=>w.op)).toEqual(['invoices.create']);
  });

  it('a drifted TEST confirmation refuses with the fresh fingerprint and executes nothing',async()=>{
    const {sdk,state,store}=fixtureSdk({objectMode:false});
    const db=createFakeDb();
    const ctx=testCtx(db,sdk);
    const args={invoiceId:'in_liveDRAFT',description:'Rent'};
    const preview=parse(await draftHandlers.invoice_update_draft(
      {...args,dryRun:true},ctx));
    store.get('in_liveDRAFT').description='Changed elsewhere';
    const refused=parse(await draftHandlers.invoice_update_draft(
      {...args,confirm:true,requestKey:'test-drift-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(refused.done).toBe(false);
    expect(refused.error).toMatch(/evaluated state has changed/);
    expect(refused.previewFingerprint).toMatch(FINGERPRINT);
    expect(refused.previewFingerprint).not.toBe(preview.previewFingerprint);
    expect(state.writes).toHaveLength(0);
    const done=parse(await draftHandlers.invoice_update_draft(
      {...args,confirm:true,requestKey:'test-drift-2',
        previewFingerprint:refused.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(state.writes).toHaveLength(1);
  });
});

describe('V2 Invoices LIVE conversion (owner connection, fake provider)',()=>{
  it('invoice_create_draft previews LIVE facts and confirms into exactly one create',async()=>{
    const {sdk,state}=fixtureSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={customerId:'cus_live1',collectionMethod:'send_invoice',
      daysUntilDue:7,description:'Rent'};
    const preview=parse(await draftHandlers.invoice_create_draft(
      {...args,dryRun:true},ctx));
    expect(preview.done).toBe(false);
    expect(preview.mode).toBe('LIVE');
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('No finalization or payment');
    expect(preview.previewFingerprint).toMatch(FINGERPRINT);
    expect(state.writes).toHaveLength(0);
    const done=parse(await draftHandlers.invoice_create_draft(
      {...args,confirm:true,requestKey:'live-create-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(state.writes.map(w=>w.op)).toEqual(['invoices.create']);
  });

  it('add_line, update_line, update_draft and remove_line each complete in LIVE',async()=>{
    const cases=[
      ['invoice_add_line',draftHandlers.invoice_add_line,
        {invoiceId:'in_liveDRAFT',amountCents:500,description:'Extra'},
        'invoiceItems.create'],
      ['invoice_update_line',draftHandlers.invoice_update_line,
        {invoiceId:'in_liveDRAFT',lineItemId:'ii_DRAFT1',amountCents:2500},
        'invoiceItems.update'],
      ['invoice_update_draft',draftHandlers.invoice_update_draft,
        {invoiceId:'in_liveDRAFT',description:'After'},'invoices.update'],
      ['invoice_remove_line',draftHandlers.invoice_remove_line,
        {invoiceId:'in_liveDRAFT',lineItemId:'ii_DRAFT1'},'invoiceItems.delete']];
    for(const [name,handler,args,op] of cases){
      const {sdk,state}=fixtureSdk();const db=await liveDb();
      const ctx=await liveCtx(db,sdk);
      const preview=parse(await handler({...args,dryRun:true},ctx));
      expect(preview.preview,name).toContain('LIVE MODE');
      const done=parse(await handler({...args,confirm:true,
        requestKey:'live-'+name,previewFingerprint:preview.previewFingerprint},ctx));
      expect(done.done,name).toBe(true);
      expect(state.writes.map(w=>w.op),name).toEqual([op]);
    }
  });

  it('invoice_finalize discloses immutability and completes in LIVE',async()=>{
    const {sdk,state}=fixtureSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={invoiceId:'in_liveDRAFT'};
    const preview=parse(await lifecycleHandlers.invoice_finalize(
      {...args,dryRun:true},ctx));
    expect(preview.mode).toBe('LIVE');
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('immutable');
    const done=parse(await lifecycleHandlers.invoice_finalize(
      {...args,confirm:true,requestKey:'live-finalize-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(state.writes.map(w=>w.op)).toEqual(['invoices.finalize']);
  });

  it('invoice_send discloses the real customer email and completes in LIVE',async()=>{
    const {sdk,state}=fixtureSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={invoiceId:'in_liveSEND'};
    const preview=parse(await lifecycleHandlers.invoice_send(
      {...args,dryRun:true},ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('email the real customer');
    expect(preview.preview).toContain('open real collection');
    const done=parse(await lifecycleHandlers.invoice_send(
      {...args,confirm:true,requestKey:'live-send-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(state.writes.map(w=>w.op)).toEqual(['invoices.send']);
  });

  it('invoice_charge_now charges the provider-verified balance exactly once in LIVE',async()=>{
    const {sdk,state}=fixtureSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={invoiceId:'in_liveAUTO',expectedRemainingCents:2000};
    const preview=parse(await lifecycleHandlers.invoice_charge_now(
      {...args,dryRun:true},ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('$20.00');
    const done=parse(await lifecycleHandlers.invoice_charge_now(
      {...args,confirm:true,requestKey:'live-charge-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(state.writes.map(w=>w.op)).toEqual(['invoices.pay']);
    expect(state.writes[0].payload.paid_out_of_band).toBe(false);
  });

  it('mark_paid_outside_stripe, void and mark_uncollectible each complete in LIVE',async()=>{
    const cases=[
      ['invoice_mark_paid_outside_stripe',
        {invoiceId:'in_liveAUTO',expectedRemainingCents:2000},'invoices.pay'],
      ['invoice_void',{invoiceId:'in_liveAUTO'},'invoices.void'],
      ['invoice_mark_uncollectible',{invoiceId:'in_liveAUTO'},
        'invoices.uncollectible']];
    for(const [name,args,op] of cases){
      const {sdk,state}=fixtureSdk();const db=await liveDb();
      const ctx=await liveCtx(db,sdk);
      const preview=parse(await lifecycleHandlers[name]({...args,dryRun:true},ctx));
      expect(preview.preview,name).toContain('LIVE MODE');
      const done=parse(await lifecycleHandlers[name]({...args,confirm:true,
        requestKey:'live-'+name,previewFingerprint:preview.previewFingerprint},ctx));
      expect(done.done,name).toBe(true);
      expect(state.writes.map(w=>w.op),name).toEqual([op]);
    }
  });

  it('invoice_delete_draft completes through the lifecycle door in LIVE',async()=>{
    const {sdk,state}=fixtureSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={invoiceId:'in_liveDRAFT'};
    const preview=parse(await lifecycleHandlers.invoice_delete_draft(
      {...args,dryRun:true},ctx));
    expect(preview.preview).toContain('LIVE MODE');
    const done=parse(await lifecycleHandlers.invoice_delete_draft(
      {...args,confirm:true,requestKey:'live-lifecycle-delete-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(state.writes.map(w=>w.op)).toEqual(['invoices.del']);
  });

  it('creditnote_create: confirm alone moves nothing; the exact owner approval executes exactly once and counts against the day',async()=>{
    const {sdk,state}=fixtureSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={invoiceId:'in_livePAID',amountCents:8500,allocation:'refund',
      reason:'duplicate'};
    const preview=parse(await creditHandlers.creditnote_create(
      {...args,dryRun:true},ctx));
    expect(preview.mode).toBe('LIVE');
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('independent owner must approve');
    expect(preview.previewFingerprint).toMatch(FINGERPRINT);
    const confirmArgs={...args,confirm:true,requestKey:'live-credit-1',
      previewFingerprint:preview.previewFingerprint};
    const refused=parse(await creditHandlers.creditnote_create(confirmArgs,ctx));
    expect(refused.done).toBe(false);
    expect(JSON.stringify(refused)).toMatch(/explicit approval is required/);
    expect(state.writes).toHaveLength(0);
    expect((await db.getMoneyUsage({account:acct,connection:ctx.connectionId}))
      .used_cents).toBe(0);
    await approveFor(db,ctx,'creditnote_create',confirmArgs);
    const done=parse(await creditHandlers.creditnote_create(confirmArgs,ctx));
    expect(done.done).toBe(true);
    expect(state.writes.map(w=>w.op)).toEqual(['creditNotes.create']);
    expect((await db.getMoneyUsage({account:acct,connection:ctx.connectionId}))
      .used_cents).toBe(8500);
  });

  it('creditnote_void completes in LIVE',async()=>{
    const {sdk,state}=fixtureSdk();const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={creditNoteId:'cn_live1'};
    const preview=parse(await creditHandlers.creditnote_void(
      {...args,dryRun:true},ctx));
    expect(preview.preview).toContain('LIVE MODE');
    const done=parse(await creditHandlers.creditnote_void(
      {...args,confirm:true,requestKey:'live-credit-void-1',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(state.writes.map(w=>w.op)).toEqual(['creditNotes.void']);
  });

  it('a TEST-mode object under a LIVE connection is refused at read, before any write',async()=>{
    const {sdk,state}=fixtureSdk({objectMode:false});const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    await expect(draftHandlers.invoice_update_draft(
      {invoiceId:'in_liveDRAFT',description:'x',confirm:true,
        requestKey:'live-wrongmode-1'},ctx))
      .rejects.toThrow('Stripe provider resource mode mismatch');
    await expect(lifecycleHandlers.invoice_send(
      {invoiceId:'in_liveSEND',confirm:true,requestKey:'live-wrongmode-2'},ctx))
      .rejects.toThrow('Stripe provider resource mode mismatch');
    await expect(creditHandlers.creditnote_create(
      {invoiceId:'in_liveAUTO',amountCents:8500,allocation:'refund',
        reason:'duplicate',dryRun:true},ctx))
      .rejects.toThrow('Stripe provider resource mode mismatch');
    expect(state.writes).toHaveLength(0);
  });

  it('a LIVE-mode object under a TEST connection is refused the other way',async()=>{
    const {sdk,state}=fixtureSdk({objectMode:true});
    const db=createFakeDb();
    const ctx={db,connectionId:'owner-client-fixture',
      connection:{stripeAccount:acct,mode:'test',profile:'full',listing:'catalog',
        context:'customer',moneyLimitCents:0},
      services:{stripeForConnection:async()=>sdk}};
    await expect(draftHandlers.invoice_update_draft(
      {invoiceId:'in_liveDRAFT',description:'x',confirm:true,
        requestKey:'test-wrongmode-1'},ctx))
      .rejects.toThrow('Stripe provider resource mode mismatch');
    expect(state.writes).toHaveLength(0);
  });

  it('the app-ownership guard still refuses an application-owned invoice in LIVE',async()=>{
    const {sdk,state,store}=fixtureSdk();const db=await liveDb();
    store.get('in_liveDRAFT').metadata={agreementId:'ag_LIVE1'};
    const ctx=await liveCtx(db,sdk);
    const refused=parse(await draftHandlers.invoice_update_draft(
      {invoiceId:'in_liveDRAFT',description:'x',confirm:true,
        requestKey:'live-appguard-1'},ctx));
    expect(refused.done).toBe(false);
    expect(JSON.stringify(refused)).toMatch(/App-owned record or unsafe target/);
    expect(state.writes).toHaveLength(0);
  });
});
