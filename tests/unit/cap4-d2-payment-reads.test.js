// CAP-4 D-2 — payment READ tools (payment intents, charges,
// refunds, setup intents) serve the connection's own mode with
// per-object mode verification. At the pre-D-2 baseline the module's
// local guard refused every non-TEST connection before any provider
// call (throwing its TEST-only refusal), and the four projections
// verified nothing in either direction: on a TEST connection a LIVE
// intent, charge, refund or setup intent projected without
// complaint. The tests below record that split: the LIVE happy
// paths and the TEST-direction wrong-mode refusals fail at baseline,
// and the LIVE-direction wrong-mode cases fail there too — refused
// by the thrown gate then, refused by verification now.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {tools,handlers,paymentSafe,chargeSafe,refundSafe,setupSafe}
  from '../../src/tools/payments.js';

const acct='acct_D2FAKE',piId='pi_D2FAKE',chId='ch_D2FAKE',
  reId='re_D2FAKE',siId='seti_D2FAKE',cusId='cus_D2FAKE';
const parse=r=>JSON.parse(r.content[0].text);
const listOf=v=>({object:'list',data:[v],has_more:false});

function testCtx(sdk){
  return {connection:{stripeAccount:acct,mode:'test',profile:'read_only'},
    services:{stripeForConnection:async()=>sdk}};
}
async function liveCtx(sdk){
  vi.stubEnv('VERCEL_ENV','production');
  const db=createFakeDb({accounts:[{id:acct,live_enabled:true,
    live_connected:true,money_limit_cents:0}]});
  return {db,connection:{stripeAccount:acct,mode:'live',
    profile:'read_only'},services:{stripeForConnection:async()=>sdk}};
}
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});

// --- Fixtures -----------------------------------------------------------
// The raw fixtures carry a client_secret and (on the charge) a card
// fingerprint: the projections' established field sets never surface
// either, in any mode, and the tests assert that below.
const intent=(livemode,over={})=>({id:piId,object:'payment_intent',
  livemode,status:'succeeded',amount:2000,amount_received:2000,
  currency:'usd',customer:cusId,payment_method:'pm_D2FAKE',
  latest_charge:chId,description:'D-2 fixture payment',
  receipt_email:'buyer@example.test',
  client_secret:piId+'_secret_DO_NOT_EXPOSE',created:1760000000,
  ...over});
const charge=(livemode,over={})=>({id:chId,object:'charge',livemode,
  status:'succeeded',paid:true,amount:2000,amount_refunded:250,
  currency:'usd',customer:cusId,payment_intent:piId,
  description:'D-2 fixture charge',refunded:false,disputed:false,
  outcome:{type:'authorized',reason:null,
    network_status:'approved_by_network'},
  billing_details:{card:{fingerprint:'fp_DO_NOT_EXPOSE'}},
  created:1760000000,...over});
const refund=(livemode,over={})=>({id:reId,object:'refund',livemode,
  amount:250,currency:'usd',status:'succeeded',
  reason:'requested_by_customer',charge:chId,payment_intent:piId,
  created:1760000000,...over});
const setup=(livemode,over={})=>({id:siId,object:'setup_intent',
  livemode,status:'succeeded',customer:cusId,
  payment_method:'pm_D2FAKE',usage:'off_session',
  client_secret:siId+'_secret_DO_NOT_EXPOSE',created:1760000000,
  ...over});

// On a LIVE connection the shared seam first demands independent
// account-mode evidence (verified account + a livemode:true
// balance); the payment surfaces themselves answer the read.
function paySdk(connLive,{piMode,chMode,reMode,siMode}={}){
  return {
    accounts:{retrieve:async()=>({object:'account',id:acct,
      livemode:true})},
    balance:{retrieve:async()=>({object:'balance',livemode:true})},
    paymentIntents:{list:async()=>listOf(intent(piMode??connLive)),
      retrieve:async()=>intent(piMode??connLive),
      search:async()=>listOf(intent(piMode??connLive))},
    charges:{list:async()=>listOf(charge(chMode??connLive)),
      retrieve:async()=>charge(chMode??connLive),
      search:async()=>listOf(charge(chMode??connLive))},
    refunds:{list:async()=>listOf(refund(reMode??connLive)),
      retrieve:async()=>refund(reMode??connLive)},
    setupIntents:{list:async()=>listOf(setup(siMode??connLive)),
      retrieve:async()=>setup(siMode??connLive)}
  };
}

// --- Payment intents ------------------------------------------------------
describe('CAP-4 D-2 payment intent reads verify returned objects',()=>{
  it('list/get/search project LIVE intents on LIVE, secret-free',
    async()=>{
      const ctx=await liveCtx(paySdk(true));
      const list=await handlers.payment_list({},ctx);
      expect(list.isError).toBeFalsy();
      expect(parse(list).data[0]).toMatchObject({id:piId,
        status:'succeeded',amount:2000,paymentMethod:'pm_D2FAKE',
        latestCharge:chId});
      const get=await handlers.payment_get({paymentId:piId},
        await liveCtx(paySdk(true)));
      expect(get.isError).toBeFalsy();
      expect(parse(get)).toMatchObject({id:piId,amount_received:2000});
      const search=await handlers.payment_search(
        {query:"status:'succeeded'"},await liveCtx(paySdk(true)));
      expect(search.isError).toBeFalsy();
      expect(parse(search).data[0]).toMatchObject({id:piId});
      for(const r of [list,get,search])
        expect(JSON.stringify(parse(r))).not.toMatch(
          /client_secret|DO_NOT_EXPOSE/);
    });
  it('a TEST intent is refused on LIVE on list, get and search',
    async()=>{
      const sdk=paySdk(true,{piMode:false});
      const list=await handlers.payment_list({},
        await liveCtx(sdk));
      expect(list.isError).toBe(true);
      expect(list.content[0].text).toMatch(/mode mismatch/);
      const get=await handlers.payment_get({paymentId:piId},
        await liveCtx(paySdk(true,{piMode:false})));
      expect(get.isError).toBe(true);
      expect(get.content[0].text).toMatch(/mode mismatch/);
      const search=await handlers.payment_search(
        {query:"status:'succeeded'"},
        await liveCtx(paySdk(true,{piMode:false})));
      expect(search.isError).toBe(true);
      expect(search.content[0].text).toMatch(/mode mismatch/);
    });
  it('a LIVE intent is refused on TEST on list, get and search',
    async()=>{
      const list=await handlers.payment_list({},
        testCtx(paySdk(false,{piMode:true})));
      expect(list.isError).toBe(true);
      const get=await handlers.payment_get({paymentId:piId},
        testCtx(paySdk(false,{piMode:true})));
      expect(get.isError).toBe(true);
      expect(get.content[0].text).toMatch(/mode mismatch/);
      const search=await handlers.payment_search(
        {query:"status:'succeeded'"},
        testCtx(paySdk(false,{piMode:true})));
      expect(search.isError).toBe(true);
    });
});

// --- Charges ---------------------------------------------------------------
describe('CAP-4 D-2 charge reads verify returned objects',()=>{
  it('list/get/search project LIVE charges on LIVE, with no card '+
    'fingerprint anywhere in the output',async()=>{
      const list=await handlers.charge_list({},
        await liveCtx(paySdk(true)));
      expect(list.isError).toBeFalsy();
      expect(parse(list).data[0]).toMatchObject({id:chId,paid:true,
        amount_refunded:250,paymentIntent:piId,
        outcome:{type:'authorized',
          networkStatus:'approved_by_network'}});
      const get=await handlers.charge_get({chargeId:chId},
        await liveCtx(paySdk(true)));
      expect(get.isError).toBeFalsy();
      expect(parse(get)).toMatchObject({id:chId,status:'succeeded'});
      const search=await handlers.charge_search(
        {query:"status:'succeeded'"},await liveCtx(paySdk(true)));
      expect(search.isError).toBeFalsy();
      expect(parse(search).data[0]).toMatchObject({id:chId});
      for(const r of [list,get,search])
        expect(JSON.stringify(parse(r))).not.toMatch(
          /fingerprint|DO_NOT_EXPOSE/);
    });
  it('charge list/get/search refuse wrong-mode in both directions',
    async()=>{
      const liveList=await handlers.charge_list({},
        await liveCtx(paySdk(true,{chMode:false})));
      expect(liveList.isError).toBe(true);
      const liveGet=await handlers.charge_get({chargeId:chId},
        await liveCtx(paySdk(true,{chMode:false})));
      expect(liveGet.isError).toBe(true);
      expect(liveGet.content[0].text).toMatch(/mode mismatch/);
      const liveSearch=await handlers.charge_search(
        {query:"status:'succeeded'"},
        await liveCtx(paySdk(true,{chMode:false})));
      expect(liveSearch.isError).toBe(true);
      const testList=await handlers.charge_list({},
        testCtx(paySdk(false,{chMode:true})));
      expect(testList.isError).toBe(true);
      const testGet=await handlers.charge_get({chargeId:chId},
        testCtx(paySdk(false,{chMode:true})));
      expect(testGet.isError).toBe(true);
      const testSearch=await handlers.charge_search(
        {query:"status:'succeeded'"},
        testCtx(paySdk(false,{chMode:true})));
      expect(testSearch.isError).toBe(true);
    });
});

// --- Refunds ---------------------------------------------------------------
describe('CAP-4 D-2 refund reads verify returned objects',()=>{
  it('list/get project LIVE refunds on LIVE with exact amounts',
    async()=>{
      const list=await handlers.payment_list_refunds(
        {charge:chId},await liveCtx(paySdk(true)));
      expect(list.isError).toBeFalsy();
      expect(parse(list).data[0]).toMatchObject({id:reId,amount:250,
        status:'succeeded',charge:chId,paymentIntent:piId});
      const get=await handlers.payment_get_refund({refundId:reId},
        await liveCtx(paySdk(true)));
      expect(get.isError).toBeFalsy();
      expect(parse(get)).toMatchObject({id:reId,
        reason:'requested_by_customer'});
    });
  it('refund list/get refuse wrong-mode in both directions',async()=>{
    const liveList=await handlers.payment_list_refunds({},
      await liveCtx(paySdk(true,{reMode:false})));
    expect(liveList.isError).toBe(true);
    const liveGet=await handlers.payment_get_refund({refundId:reId},
      await liveCtx(paySdk(true,{reMode:false})));
    expect(liveGet.isError).toBe(true);
    expect(liveGet.content[0].text).toMatch(/mode mismatch/);
    const testList=await handlers.payment_list_refunds({},
      testCtx(paySdk(false,{reMode:true})));
    expect(testList.isError).toBe(true);
    const testGet=await handlers.payment_get_refund({refundId:reId},
      testCtx(paySdk(false,{reMode:true})));
    expect(testGet.isError).toBe(true);
  });
});

// --- Setup intents -----------------------------------------------------------
describe('CAP-4 D-2 setup intent reads verify returned objects',()=>{
  it('list/get project LIVE setup intents on LIVE, secret-free',
    async()=>{
      const list=await handlers.setup_list({},
        await liveCtx(paySdk(true)));
      expect(list.isError).toBeFalsy();
      expect(parse(list).data[0]).toMatchObject({id:siId,
        status:'succeeded',paymentMethod:'pm_D2FAKE',
        usage:'off_session'});
      const get=await handlers.setup_get({setupId:siId},
        await liveCtx(paySdk(true)));
      expect(get.isError).toBeFalsy();
      expect(parse(get)).toMatchObject({id:siId,customer:cusId});
      for(const r of [list,get])
        expect(JSON.stringify(parse(r))).not.toMatch(
          /client_secret|DO_NOT_EXPOSE/);
    });
  it('setup list/get refuse wrong-mode in both directions',async()=>{
    const liveList=await handlers.setup_list({},
      await liveCtx(paySdk(true,{siMode:false})));
    expect(liveList.isError).toBe(true);
    const liveGet=await handlers.setup_get({setupId:siId},
      await liveCtx(paySdk(true,{siMode:false})));
    expect(liveGet.isError).toBe(true);
    expect(liveGet.content[0].text).toMatch(/mode mismatch/);
    const testList=await handlers.setup_list({},
      testCtx(paySdk(false,{siMode:true})));
    expect(testList.isError).toBe(true);
    const testGet=await handlers.setup_get({setupId:siId},
      testCtx(paySdk(false,{siMode:true})));
    expect(testGet.isError).toBe(true);
  });
});

// --- Projection contract -----------------------------------------------------
describe('CAP-4 D-2 payment projections keep their contract',()=>{
  it('field sets are exactly the historical ones, in both modes',()=>{
    expect(Object.keys(paymentSafe(intent(true))).sort()).toEqual([
      'amount','amount_received','canceledAt','created_local',
      'currency','customer','declineCode','description',
      'failureCode','id','latestCharge','metadata','object',
      'paymentMethod','receiptEmail','status']);
    expect(Object.keys(chargeSafe(charge(false))).sort()).toEqual([
      'amount','amount_refunded','created_local','currency',
      'customer','description','disputed','failureCode','id',
      'metadata','object','outcome','paid','paymentIntent',
      'refunded','status']);
    expect(Object.keys(refundSafe(refund(true))).sort()).toEqual([
      'amount','charge','created_local','currency','id','metadata',
      'object','paymentIntent','reason','status']);
    expect(Object.keys(setupSafe(setup(false))).sort()).toEqual([
      'cancellationReason','created_local','customer','id',
      'metadata','object','paymentMethod','status','usage']);
  });
  it('a supplied mode verifies; no mode is the historical behavior',
    ()=>{
      expect(()=>paymentSafe(intent(false),'live')).toThrow(
        /mode mismatch/);
      expect(()=>paymentSafe(intent(true),'test')).toThrow(
        /mode mismatch/);
      expect(()=>chargeSafe(charge(true),'test')).toThrow(
        /mode mismatch/);
      expect(()=>refundSafe(refund(false),'live')).toThrow(
        /mode mismatch/);
      expect(()=>setupSafe(setup(true),'test')).toThrow(
        /mode mismatch/);
      // No mode: a fixture with no livemode projects exactly as
      // before, and even a mode-carrying object passes unverified —
      // the historical contract no-mode callers rely on.
      const bare=intent(undefined);delete bare.livemode;
      expect(paymentSafe(bare)).toMatchObject({id:piId,
        status:'succeeded'});
      expect(paymentSafe(intent(true))).toMatchObject({id:piId});
    });
});

// --- Descriptions ------------------------------------------------------------
describe('CAP-4 D-2 payment read descriptions',()=>{
  it('all ten descriptions name both modes and claim neither alone',
    ()=>{
      expect(tools).toHaveLength(10);
      for(const t of tools){
        expect(t.description).toMatch(/TEST or LIVE/);
        expect(t.description).not.toMatch(/TEST-only/);
        expect(t.description.length).toBeLessThanOrEqual(160);
      }
    });
});
