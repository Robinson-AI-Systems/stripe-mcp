// Owner-obedience V2, family 1 (Money): the payout operations and the
// payout schedule complete the confirmed-action sequence in LIVE on
// the owner's own connection (fake provider + fake database only; no
// LIVE key, no real account). The money aim checks are unchanged:
// exact owner approval (row 20), the shared daily cap + override
// (row 21), pass ceilings (row 22), USD only (row 23). The synthetic
// top-up fixture does NOT convert (ruling 2).
import {afterEach,describe,expect,it,vi} from 'vitest';
import {randomBytes} from 'node:crypto';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {idempotencyKey} from '../../src/stripe/client.js';
import {createRtcReadOnlyHttpHandler} from '../../src/core/rtc-http.js';
import {registry} from '../../src/tools/index.js';
import {handlers as createHandlers} from '../../src/tools/money-payout-create.js';
import {handlers as payoutHandlers} from '../../src/tools/money-payout-writes.js';
import {handlers as reverseHandlers} from '../../src/tools/money-payout-reverse.js';
import {handlers as scheduleHandlers} from '../../src/tools/money-schedule-write.js';
import {handlers as brandHandlers} from '../../src/tools/brand-account.js';
import {handlers as topupHandlers} from '../../src/tools/money-topup-writes.js';

const acct='acct_LIVEFIXTURE',bank='ba_FAKE1234',payoutId='po_FAKE1234';
const parse=r=>JSON.parse(r.content[0].text);
afterEach(()=>vi.unstubAllEnvs());

async function liveDb({limitCents=10000}={}){
  const db=createFakeDb({accounts:[{id:acct,label:'Fixture',
    money_limit_cents:limitCents,live_enabled:true,live_connected:true}]});
  // A LIVE money approval request requires an enrolled LIVE credential,
  // in the fake database exactly as in the real one.
  await db.saveLiveKey({account:acct,ciphertext:'v1.fake',
    kind:'restricted',last4:'FAKE'});
  // The owner's own connection row (kind 'connector'). The reservation
  // binds a non-pass approval's mode to this row's stored mode, so the
  // fixture connection must exist as a stored row, as in production.
  await db.createAccessToken({accessToken:'owner-live-access',
    clientId:'owner-client',stripeAccount:acct,mode:'live',profile:'full',
    liveWriteApproved:true});
  return db;
}
// The owner's own OAuth connection, exactly as src/core/mcp-auth.js
// builds it (grant context resolved server-side, delegated ceiling 0),
// on a production deployment with LIVE access granted. connectionId is
// the stored result scope of the connector row created in liveDb.
async function liveCtx(db,sdk){
  const scope=(await db.tokenRowsForTest())
    .find(t=>t.kind==='connector')?.result_scope;
  return {db,connectionId:scope,liveAccessGranted:true,
    connection:{stripeAccount:acct,mode:'live',profile:'full',listing:'catalog',
      context:'customer',rtcLiveOwnerApproved:true,moneyLimitCents:0},
    services:{stripeForConnection:async()=>sdk}};
}
let intentSeq=0;
// The owner's LIVE approval, simulated through the same decision-intent
// path the protected owner page uses in production (db.approveMoneyRequest
// is the TEST-only direct route in both the real and fake databases).
async function approveFor(db,ctx,tool,args,kind='approve'){
  const key=idempotencyKey(ctx.connection,tool,args);
  const id='V2LIVE'+String(++intentSeq).padStart(26,'0');
  expect(await db.requestMoneyDecisionIntent({id,account:acct,
    idempotencyKey:key,kind,
    expiresAt:new Date(Date.now()+600000)})).toBe(true);
  expect(await db.consumeMoneyDecisionIntent(id)).toBe(true);
}

function payoutCreateSdk({readBackLive=true}={}){
  const provider={writes:[],afterCalls:0};
  let dest={object:'bank_account',id:bank,account:acct,currency:'usd',
    country:'US',status:'verified',last4:'1234'};
  let created=null;
  const sdk={
    accounts:{retrieve:async()=>({object:'account',id:acct,livemode:true,country:'US'}),
      retrieveExternalAccount:async()=>dest},
    balance:{retrieve:async()=>({object:'balance',livemode:true,available:[
      {currency:'usd',amount:20000,source_types:{card:20000}}]})},
    payouts:{
      async create(payload,opts){
        provider.writes.push({payload,idempotencyKey:opts.idempotencyKey});
        created={id:'po_NEW1234',object:'payout',automatic:false,
          livemode:readBackLive,status:'pending',amount:payload.amount,
          currency:payload.currency,method:payload.method,
          source_type:payload.source_type,destination:payload.destination};
        return created;
      },
      async retrieve(){provider.afterCalls++;return created;}
    }};
  return {provider,sdk,setBank:x=>{dest={...dest,...x};}};
}

describe('V2 Money LIVE payout creation (owner connection, fake provider)',()=>{
  it('preview discloses LIVE facts and fingerprint; confirm still needs the exact owner approval (ruling 1(b), half ii)',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const {provider,sdk}=payoutCreateSdk();
    const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={amountCents:8500,destinationId:bank,sourceType:'card'};
    const preview=parse(await createHandlers.money_create_payout(
      {...args,dryRun:true},ctx));
    expect(preview.done).toBe(false);
    expect(preview.mode).toBe('LIVE');
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('$85.00');
    expect(preview.preview).toContain('ending 1234');
    expect(preview.preview).toContain('cannot be pulled back');
    expect(preview.previewFingerprint).toMatch(/^WRITE-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/);
    expect(provider.writes).toHaveLength(0);
    // The funded-term change removes a blanket block; it approves nothing.
    const confirmArgs={...args,confirm:true,requestKey:'live-create-1',
      previewFingerprint:preview.previewFingerprint};
    const refused=parse(await createHandlers.money_create_payout(confirmArgs,ctx));
    expect(refused.done).toBe(false);
    expect(refused.error).toMatch(/explicit approval is required/);
    expect(provider.writes).toHaveLength(0);
  });
  // The reservation binds a non-pass approval's mode to the mode stored
  // on the caller's own connection row (reserve_money_out_guarded in
  // src/db.js, mirrored by the fake): a LIVE approval recorded for the
  // owner's own LIVE connection now reserves, executes exactly once,
  // consumes the approval and settles against the daily usage. Before
  // the 2026-11-03 coordinator ruling this leg was blocked on a
  // hardcoded 'test' fallback; see the card's resume note.
  it('a fully approved LIVE payout reserves, executes once, consumes the approval and reads back',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const {provider,sdk}=payoutCreateSdk();
    const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={amountCents:8500,destinationId:bank,sourceType:'card',
      confirm:true,requestKey:'live-approved'};
    const first=parse(await createHandlers.money_create_payout(args,ctx));
    expect(first.error).toMatch(/explicit approval is required/);
    expect(provider.writes).toHaveLength(0);
    await approveFor(db,ctx,'money_create_payout',args);
    const rows=await db.listMoneyApprovalsForTest();
    expect(rows).toHaveLength(1);
    expect(rows[0].mode).toBe('live');
    expect(rows[0].approvedAt).not.toBeNull();
    const done=parse(await createHandlers.money_create_payout(args,ctx));
    expect(done.done).toBe(true);
    expect(done.confirmed).toBe(true);
    expect(provider.writes).toHaveLength(1);
    expect(provider.afterCalls).toBeGreaterThan(0);
    expect((await db.listMoneyApprovalsForTest())[0].consumedAt).not.toBeNull();
    expect((await db.getMoneyUsage({account:acct,
      connection:ctx.connectionId})).used_cents).toBe(8500);
  });
  it('a state change between preview and confirm voids the fingerprint and executes nothing',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const {provider,sdk,setBank}=payoutCreateSdk();
    const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={amountCents:8500,destinationId:bank,sourceType:'card'};
    const preview=parse(await createHandlers.money_create_payout(
      {...args,dryRun:true},ctx));
    setBank({last4:'9999'});
    const stale=parse(await createHandlers.money_create_payout(
      {...args,confirm:true,requestKey:'live-drift',
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(stale.done).toBe(false);
    expect(stale.error).toMatch(/changed since that preview/);
    expect(stale.previewFingerprint).not.toBe(preview.previewFingerprint);
    expect(stale.preview).toContain('ending 9999');
    expect(provider.writes).toHaveLength(0);
    const confirmArgs={...args,confirm:true,requestKey:'live-drift',
      previewFingerprint:stale.previewFingerprint};
    const needsApproval=parse(await createHandlers.money_create_payout(confirmArgs,ctx));
    expect(needsApproval.error).toMatch(/explicit approval is required/);
    await approveFor(db,ctx,'money_create_payout',confirmArgs);
    // The fresh fingerprint is accepted (no fingerprint error) and, with
    // the exact owner approval in place, the payout executes.
    const done=parse(await createHandlers.money_create_payout(confirmArgs,ctx));
    expect(done.done).toBe(true);
    expect(provider.writes).toHaveLength(1);
  });
});

function payoutSdk(){
  const provider={writes:[],afterCalls:0};
  let current={id:payoutId,object:'payout',livemode:true,currency:'usd',
    amount:8500,automatic:false,status:'pending',metadata:{}};
  const sdk={
    accounts:{retrieve:async()=>({object:'account',id:acct,livemode:true,country:'US'})},
    balance:{retrieve:async()=>({object:'balance',livemode:true,available:[]})},
    payouts:{
      async retrieve(){if(provider.writes.length)provider.afterCalls++;
        return {...current,metadata:{...current.metadata}};},
      async update(_id,body,opts){
        provider.writes.push({idempotencyKey:opts?.idempotencyKey,body});
        current={...current,metadata:{...current.metadata,...body.metadata}};
        return current;
      },
      async cancel(_id,_body,opts){
        provider.writes.push({idempotencyKey:opts?.idempotencyKey});
        current={...current,status:'canceled'};
        return current;
      }}};
  return {provider,sdk,setPayout:x=>{current={...current,...x};}};
}

describe('V2 Money LIVE payout update/cancel (owner connection, fake provider)',()=>{
  it('updates metadata and cancels a pending payout in LIVE, with mode-bound previews',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const {provider,sdk}=payoutSdk();
    const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const preview=parse(await payoutHandlers.money_update_payout(
      {payoutId,metadata:{label:'live'},dryRun:true},ctx));
    expect(preview.preview).toContain('LIVE MODE');
    const updated=parse(await payoutHandlers.money_update_payout(
      {payoutId,metadata:{label:'live'},confirm:true,requestKey:'live-upd'},ctx));
    expect(updated.done).toBe(true);
    const canceled=parse(await payoutHandlers.money_cancel_payout(
      {payoutId,confirm:true,requestKey:'live-cancel'},ctx));
    expect(canceled.done).toBe(true);
    expect(provider.writes).toHaveLength(2);
  });
  it('refuses a TEST payout object in LIVE and a LIVE payout object in TEST',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const {provider,sdk,setPayout}=payoutSdk();
    const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    setPayout({livemode:false});
    await expect(payoutHandlers.money_update_payout(
      {payoutId,metadata:{label:'x'},confirm:true},ctx))
      .rejects.toThrow(/Verified USD LIVE payout/);
    setPayout({livemode:true});
    const testCtx={db,connectionId:'test-money-fixture',
      connection:{stripeAccount:acct,mode:'test',profile:'full'},
      services:{stripeForConnection:async()=>sdk}};
    await expect(payoutHandlers.money_update_payout(
      {payoutId,metadata:{label:'x'},confirm:true},testCtx))
      .rejects.toThrow(/Verified USD TEST payout/);
    expect(provider.writes).toHaveLength(0);
  });
});

function reverseSdk(){
  const provider={writes:[],afterCalls:0};
  let old={id:payoutId,object:'payout',livemode:true,currency:'usd',amount:8500,
    status:'paid',automatic:false,destination:bank,reversed_by:null,
    original_payout:null,metadata:{}};
  let reversal=null;
  const sdk={
    accounts:{retrieve:async()=>({id:acct,object:'account',livemode:true,country:'US'}),
      retrieveExternalAccount:async()=>({id:bank,object:'bank_account',
        account:acct,country:'US',last4:'4567'})},
    balance:{retrieve:async()=>({object:'balance',livemode:true,available:[]})},
    payouts:{
      async retrieve(id){
        if(id==='po_REVERSE1234'){provider.afterCalls++;return reversal;}
        return {...old};
      },
      async reverse(id,_params,opts){
        provider.writes.push({id,idempotencyKey:opts.idempotencyKey});
        reversal={id:'po_REVERSE1234',object:'payout',livemode:true,
          original_payout:payoutId,destination:bank,currency:'usd',amount:-8500};
        old={...old,reversed_by:reversal.id};
        return {...reversal};
      }}};
  return {provider,sdk};
}

describe('V2 Money LIVE payout reversal (owner connection, fake provider)',()=>{
  it('a paid LIVE payout reversal requires the exact owner approval, then reserves, executes and reads back',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const {provider,sdk}=reverseSdk();
    const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const args={payoutId,confirm:true,requestKey:'live-reverse'};
    const refused=parse(await reverseHandlers.money_reverse_payout(args,ctx));
    expect(refused.done).toBe(false);
    expect(refused.error).toMatch(/explicit approval is required/);
    expect(provider.writes).toHaveLength(0);
    await approveFor(db,ctx,'money_reverse_payout',args);
    const done=parse(await reverseHandlers.money_reverse_payout(args,ctx));
    expect(done.done).toBe(true);
    expect(done.confirmed).toBe(true);
    expect(provider.writes).toHaveLength(1);
    expect(provider.afterCalls).toBeGreaterThan(0);
    expect((await db.listMoneyApprovalsForTest())[0].consumedAt).not.toBeNull();
  });
  it('over the shared daily cap, a LIVE reversal stops for the separate owner override, then executes with it',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const {provider,sdk}=reverseSdk();
    const db=await liveDb({limitCents:8000});
    const ctx=await liveCtx(db,sdk);
    const args={payoutId,confirm:true,requestKey:'live-over-cap'};
    const first=parse(await reverseHandlers.money_reverse_payout(args,ctx));
    expect(first.error).toMatch(/explicit approval is required/);
    await approveFor(db,ctx,'money_reverse_payout',args);
    // The approval is now mode-bound and accepted; the cap is the leg
    // that refuses, and it executes nothing.
    const capped=parse(await reverseHandlers.money_reverse_payout(args,ctx));
    expect(capped.done).toBe(false);
    expect(capped.error).toMatch(/daily limit exceeded/);
    expect(provider.writes).toHaveLength(0);
    await approveFor(db,ctx,'money_reverse_payout',args,'override');
    const done=parse(await reverseHandlers.money_reverse_payout(args,ctx));
    expect(done.done).toBe(true);
    expect(provider.writes).toHaveLength(1);
  });
});

function scheduleSdk({deny=false}={}){
  const provider={writes:[],afterCalls:0};
  let own={id:acct,object:'account',livemode:true,metadata:{},
    settings:{payouts:{schedule:{interval:'manual'}}}};
  const sdk={accounts:{
      async retrieve(){if(provider.writes.length)provider.afterCalls++;return own;},
      async update(_id,params,opts){
        provider.writes.push({idempotencyKey:opts.idempotencyKey,payload:params});
        if(deny)throw Object.assign(new Error('restricted'),{statusCode:403});
        own={...own,settings:{payouts:{schedule:params.settings.payouts.schedule}}};
        return own;
      }},
    balance:{retrieve:async()=>({object:'balance',livemode:true,available:[]})}};
  return {provider,sdk};
}

describe('V2 Money reservation approval-mode binding (fake DB ledger)',()=>{
  async function approveKey(db,key,kind='approve'){
    const id='V2DB'+String(++intentSeq).padStart(28,'0');
    expect(await db.requestMoneyDecisionIntent({id,account:acct,
      idempotencyKey:key,kind,
      expiresAt:new Date(Date.now()+600000)})).toBe(true);
    expect(await db.consumeMoneyDecisionIntent(id)).toBe(true);
  }
  const request=(db,key,cents,mode)=>db.requestMoneyApproval({account:acct,
    idempotencyKey:key,tool:'money_create_payout',
    description:'Owner-reviewed payout',target:bank,
    amountCents:cents,currency:'usd',mode});
  it('a LIVE approval reserves on the owner LIVE connection, settles, and reads back in usage',async()=>{
    const db=await liveDb();
    const scope=(await db.tokenRowsForTest())
      .find(t=>t.kind==='connector').result_scope;
    expect(await request(db,'live-ledger',8500,'live')).toBe(true);
    await approveKey(db,'live-ledger');
    const reserved=await db.reserveMoneyOut({account:acct,connection:scope,
      idempotencyKey:'live-ledger',amountCents:8500,currency:'usd'});
    expect(reserved.decision).toBe('reserved');
    expect(await db.settleMoneyReservation({account:acct,connection:scope,
      idempotencyKey:'live-ledger',state:'confirmed'})).toBe(true);
    expect((await db.getMoneyUsage({account:acct,connection:scope}))
      .used_cents).toBe(8500);
    expect((await db.listMoneyApprovalsForTest())[0].consumedAt)
      .not.toBeNull();
  });
  it('over the $500 daily cap a LIVE reservation needs the separate override, then reserves',async()=>{
    const db=await liveDb({limitCents:50000});
    const scope=(await db.tokenRowsForTest())
      .find(t=>t.kind==='connector').result_scope;
    expect(await request(db,'cap-first',45000,'live')).toBe(true);
    await approveKey(db,'cap-first');
    expect((await db.reserveMoneyOut({account:acct,connection:scope,
      idempotencyKey:'cap-first',amountCents:45000,currency:'usd'})).decision)
      .toBe('reserved');
    expect(await request(db,'cap-second',10000,'live')).toBe(true);
    await approveKey(db,'cap-second');
    expect((await db.reserveMoneyOut({account:acct,connection:scope,
      idempotencyKey:'cap-second',amountCents:10000,currency:'usd'})).decision)
      .toBe('limit_exceeded_override_required');
    await approveKey(db,'cap-second','override');
    expect((await db.reserveMoneyOut({account:acct,connection:scope,
      idempotencyKey:'cap-second',amountCents:10000,currency:'usd'})).decision)
      .toBe('reserved');
    expect((await db.getMoneyUsage({account:acct,connection:scope}))
      .used_cents).toBe(55000);
  });
  it('the mode binding cuts both ways: a TEST approval cannot satisfy a LIVE connection, nor a LIVE approval a TEST one',async()=>{
    const db=await liveDb();
    await db.saveTestKey({account:acct,label:acct,
      ciphertext:'fake-cipher',kind:'restricted',last4:'FAKE'});
    await db.createAccessToken({accessToken:'owner-test-access',
      clientId:'owner-client',stripeAccount:acct,mode:'test',
      profile:'full'});
    const rows=await db.tokenRowsForTest();
    const liveScope=rows.find(t=>t.kind==='connector'&&t.mode==='live')
      .result_scope;
    const testScope=rows.find(t=>t.kind==='connector'&&t.mode==='test')
      .result_scope;
    expect(await request(db,'cross-test',1000,'test')).toBe(true);
    expect(await db.approveMoneyRequest({account:acct,
      idempotencyKey:'cross-test'})).toBe(true);
    expect((await db.reserveMoneyOut({account:acct,connection:liveScope,
      idempotencyKey:'cross-test',amountCents:1000,currency:'usd'})).decision)
      .toBe('owner_approval_required');
    expect(await request(db,'cross-live',1000,'live')).toBe(true);
    await approveKey(db,'cross-live');
    expect((await db.reserveMoneyOut({account:acct,connection:testScope,
      idempotencyKey:'cross-live',amountCents:1000,currency:'usd'})).decision)
      .toBe('owner_approval_required');
    // Each approval still satisfies its own mode's connection, unconsumed
    // by the cross-mode refusals above.
    expect((await db.reserveMoneyOut({account:acct,connection:testScope,
      idempotencyKey:'cross-test',amountCents:1000,currency:'usd'})).decision)
      .toBe('reserved');
    expect((await db.reserveMoneyOut({account:acct,connection:liveScope,
      idempotencyKey:'cross-live',amountCents:1000,currency:'usd'})).decision)
      .toBe('reserved');
  });
});

describe('V2 Money LIVE payout schedule, both exposures (ruling 6)',()=>{
  it('money_set_payout_schedule and setup_set_payout_schedule both complete in LIVE',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const {provider,sdk}=scheduleSdk();
    const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const viaMoney=parse(await scheduleHandlers.money_set_payout_schedule(
      {interval:'daily',confirm:true,requestKey:'live-sched-1'},ctx));
    expect(viaMoney.done).toBe(true);
    const viaSetup=parse(await brandHandlers.setup_set_payout_schedule(
      {interval:'weekly',weeklyAnchor:'monday',confirm:true,
        requestKey:'live-sched-2'},ctx));
    expect(viaSetup.done).toBe(true);
    expect(provider.writes).toHaveLength(2);
  });
  it('a refused LIVE schedule update falls back to the LIVE dashboard, never claiming success',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const {sdk}=scheduleSdk({deny:true});
    const db=await liveDb();
    const ctx=await liveCtx(db,sdk);
    const res=parse(await scheduleHandlers.money_set_payout_schedule(
      {interval:'daily',confirm:true},ctx));
    expect(res.done).toBe(false);
    expect(res.verified).toBe(false);
    expect(res.manualSettingsUrl).toBe('https://dashboard.stripe.com/settings/payouts');
    expect(res.manualSteps[0]).toContain('LIVE mode');
  });
});

describe('V2 Money: synthetic top-ups stay exactly as reachable as before (ruling 2)',()=>{
  it('the LIVE handler refusal is unchanged, on a fully enabled owner connection',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const db=await liveDb();
    const ctx=await liveCtx(db,{});
    expect((await topupHandlers.money_create_topup({amountCents:8500},ctx)).isError)
      .toBe(true);
    expect((await topupHandlers.money_cancel_topup(
      {topupId:'tu_FAKE1234'},ctx)).isError).toBe(true);
    const res=parse(await topupHandlers.money_create_topup({amountCents:8500},ctx));
    expect(res.error).toMatch(/TEST mode/);
  });
});

describe('V2 Money: a zero-limit delegated pass still cannot execute a payout (ruling 1(b), half i)',()=>{
  function req(token,method='GET',body,query={}){
    const text=body===undefined?undefined:JSON.stringify(body);
    return {method,query,body,headers:{authorization:'Bearer '+token,
      ...(text?{'content-length':String(Buffer.byteLength(text))}:{})}};
  }
  function res(){return {statusCode:200,headers:{},body:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(n){this.statusCode=n;return this;},
    send(x){this.body=JSON.parse(x);return this;}};}
  async function passFixture(moneyLimitCents){
    const db=await liveDb();
    await db.saveLiveKey({account:acct,ciphertext:'v1.fake',
      kind:'restricted',last4:'FAKE'});
    const token='rtc_pass_'+randomBytes(32).toString('base64url');
    expect(await db.createRtcPass({id:'rtc-agent-moneyproof',account:acct,
      token,mode:'live',profile:'full',areas:['money'],allowWrites:true,
      moneyLimitCents,rateLimitPerMinute:120,
      expiresAt:new Date(Date.now()+86400000)})).toBe(true);
    const {provider,sdk}=payoutCreateSdk();
    const handler=createRtcReadOnlyHttpHandler({db,registry,
      services:{stripeForConnection:async()=>sdk}});
    return {handler,token,provider};
  }
  it('the pass door refuses the payout call and never lists the tool; the account being enabled changes nothing',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const {handler,token,provider}=await passFixture(0);
    const call=res();
    await handler(req(token,'POST',{amountCents:8500,destinationId:bank,
      sourceType:'card',confirm:true,requestKey:'pass-attempt'}),
      call,'call','stripe_money_create_payout');
    expect(call.statusCode).toBe(403);
    expect(call.body.ok).toBe(false);
    expect(provider.writes).toHaveLength(0);
    const catalog=res();
    await handler(req(token,'GET',undefined,{listing:'catalog'}),
      catalog,'catalog');
    expect(catalog.body.result.tools.map(t=>t.name))
      .not.toContain('stripe_money_create_payout');
  });
  it('a funded pass keeps exactly its previous door admission (catalog listing only; execution still needs owner approval)',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const {handler,token}=await passFixture(10000);
    const catalog=res();
    await handler(req(token,'GET',undefined,{listing:'catalog'}),
      catalog,'catalog');
    expect(catalog.body.result.tools.map(t=>t.name))
      .toContain('stripe_money_create_payout');
  });
});
