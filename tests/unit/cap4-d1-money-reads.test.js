// CAP-4 D-1 — money READ tools (balance, balance transactions,
// payouts, payout transactions, top-ups, bank accounts, payout
// schedule) serve the connection's own mode with per-object mode
// verification. At the pre-D-1 baseline every one of these handlers
// refused LIVE outright (the money-reads wrapper, the two bank-read
// gates), and none of them verified returned objects on a TEST
// connection either: a LIVE object projected without complaint on a
// TEST connection, and the automatic-payout proof rejected any
// payout with `livemode === true` instead of checking the
// connection's mode. The tests below record that split: the LIVE
// happy paths and the TEST-direction wrong-mode refusals fail at
// baseline; the LIVE-direction wrong-mode refusals pass at baseline
// only because the wrapper refused everything, and now refuse by
// verification instead.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {tools as moneyTools,handlers as moneyReads}
  from '../../src/tools/money-reads.js';
import {tools as bankTools,handlers as bankReads}
  from '../../src/tools/money-bank-reads.js';

const acct='acct_D1FAKE',txId='txn_D1FAKE',payoutId='po_D1FAKE',
  topupId='tu_D1FAKE',bankId='ba_D1FAKE';
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
const balanceObj=(livemode)=>({object:'balance',livemode,
  available:[{currency:'usd',amount:3600}],
  pending:[{currency:'usd',amount:1200}]});
const tx=(livemode,over={})=>({id:txId,object:'balance_transaction',
  livemode,currency:'usd',amount:3600,fee:110,net:3490,
  source:'ch_D1FAKE',type:'charge',status:'available',
  created:1760000000,available_on:1760000000,...over});
const payout=(livemode,over={})=>({id:payoutId,object:'payout',livemode,
  currency:'usd',amount:3490,status:'paid',automatic:true,
  created:1760000000,arrival_date:1760010000,destination:bankId,
  failure_code:null,...over});
const topup=(livemode,over={})=>({id:topupId,object:'topup',livemode,
  currency:'usd',amount:5000,status:'pending',created:1760000000,
  ...over});
const bank=(livemode,over={})=>({id:bankId,object:'bank_account',
  livemode,last4:'6789',currency:'usd',country:'US',
  bank_name:'STRIPE TEST BANK',status:'new',account:acct,
  default_for_currency:true,...over});
const account=(livemode,over={})=>({id:acct,object:'account',
  ...(livemode!==undefined?{livemode}:{}),
  settings:{payouts:{schedule:{interval:'weekly',delay_days:2,
    weekly_anchor:'monday'}}},...over});

// On a LIVE connection the shared seam first demands independent
// account-mode evidence (verified account + a livemode:true balance);
// the first balance.retrieve answers that, the read itself sees the
// fixture the test chose.
function moneySdk(connLive,{balanceMode,txMode,payoutMode,
    topupMode,readMode}={}){
  const rm=readMode??connLive;
  const balRetrieve=vi.fn(async()=>balanceObj(balanceMode??rm));
  if(connLive)balRetrieve.mockResolvedValueOnce(
    {object:'balance',livemode:true});
  return {
    accounts:{retrieve:async()=>({object:'account',id:acct,
      livemode:true})},
    balance:{retrieve:balRetrieve},
    balanceTransactions:{list:async()=>listOf(tx(txMode??rm)),
      retrieve:async()=>tx(txMode??rm)},
    payouts:{list:async()=>listOf(payout(payoutMode??rm)),
      retrieve:async()=>payout(payoutMode??rm)},
    topups:{list:async()=>listOf(topup(topupMode??rm)),
      retrieve:async()=>topup(topupMode??rm)}
  };
}
function bankSdk({accountObj,bankObj,balanceMode,deny=false}={}){
  return {
    accounts:{retrieve:vi.fn(async()=>accountObj),
      listExternalAccounts:deny?
        vi.fn(async()=>{throw Object.assign(new Error('forbidden'),
          {statusCode:403});}):
        vi.fn(async()=>({object:'list',data:[bankObj],
          has_more:false}))},
    balance:{retrieve:vi.fn(async()=>({object:'balance',
      livemode:balanceMode}))}
  };
}

// --- Balance and balance transactions -----------------------------------
describe('CAP-4 D-1 balance reads verify returned objects',()=>{
  it('money_get_balance projects a LIVE balance on LIVE',async()=>{
    const r=await moneyReads.money_get_balance({},
      await liveCtx(moneySdk(true)));
    expect(r.isError).toBeFalsy();
    expect(parse(r)).toMatchObject({livemode:true,
      available:[{amountMinor:3600,currency:'usd'}]});
  });
  it('money_get_balance refuses a TEST balance on LIVE',async()=>{
    const r=await moneyReads.money_get_balance({},
      await liveCtx(moneySdk(true,{balanceMode:false})));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/mode mismatch/);
  });
  it('money_get_balance refuses a LIVE balance on TEST',async()=>{
    const r=await moneyReads.money_get_balance({},
      testCtx(moneySdk(false,{balanceMode:true})));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/mode mismatch/);
  });
  it('balance transaction list/get refuse wrong-mode in both directions',
    async()=>{
      const liveList=await moneyReads.money_list_balance_transactions({},
        await liveCtx(moneySdk(true,{txMode:false})));
      expect(liveList.isError).toBe(true);
      const testList=await moneyReads.money_list_balance_transactions({},
        testCtx(moneySdk(false,{txMode:true})));
      expect(testList.isError).toBe(true);
      const liveGet=await moneyReads.money_get_balance_transaction(
        {transactionId:txId},
        await liveCtx(moneySdk(true,{txMode:false})));
      expect(liveGet.isError).toBe(true);
      const testGet=await moneyReads.money_get_balance_transaction(
        {transactionId:txId},testCtx(moneySdk(false,{txMode:true})));
      expect(testGet.isError).toBe(true);
    });
  it('balance transaction list/get project LIVE transactions on LIVE',
    async()=>{
      const ctx=await liveCtx(moneySdk(true));
      const list=await moneyReads.money_list_balance_transactions({},ctx);
      expect(list.isError).toBeFalsy();
      expect(parse(list).data[0]).toMatchObject({id:txId,netMinor:3490});
      const get=await moneyReads.money_get_balance_transaction(
        {transactionId:txId},await liveCtx(moneySdk(true)));
      expect(get.isError).toBeFalsy();
      expect(parse(get)).toMatchObject({id:txId,feeMinor:110});
    });
});

// --- Payouts and top-ups --------------------------------------------------
describe('CAP-4 D-1 payout and top-up reads verify returned objects',()=>{
  it('payout list/get project LIVE payouts on LIVE',async()=>{
    const list=await moneyReads.money_list_payouts({},
      await liveCtx(moneySdk(true)));
    expect(list.isError).toBeFalsy();
    expect(parse(list).data[0]).toMatchObject({id:payoutId,
      destinationId:bankId});
    const get=await moneyReads.money_get_payout({payoutId},
      await liveCtx(moneySdk(true)));
    expect(get.isError).toBeFalsy();
    expect(parse(get)).toMatchObject({id:payoutId,amountMinor:3490});
  });
  it('payout list/get refuse wrong-mode in both directions',async()=>{
    const liveList=await moneyReads.money_list_payouts({},
      await liveCtx(moneySdk(true,{payoutMode:false})));
    expect(liveList.isError).toBe(true);
    const testList=await moneyReads.money_list_payouts({},
      testCtx(moneySdk(false,{payoutMode:true})));
    expect(testList.isError).toBe(true);
    const liveGet=await moneyReads.money_get_payout({payoutId},
      await liveCtx(moneySdk(true,{payoutMode:false})));
    expect(liveGet.isError).toBe(true);
    const testGet=await moneyReads.money_get_payout({payoutId},
      testCtx(moneySdk(false,{payoutMode:true})));
    expect(testGet.isError).toBe(true);
  });
  it('top-up list/get project LIVE top-ups on LIVE',async()=>{
    const list=await moneyReads.money_list_topups({},
      await liveCtx(moneySdk(true)));
    expect(list.isError).toBeFalsy();
    expect(parse(list).data[0]).toMatchObject({id:topupId,
      amountMinor:5000});
    const get=await moneyReads.money_get_topup({topupId},
      await liveCtx(moneySdk(true)));
    expect(get.isError).toBeFalsy();
  });
  it('top-up list/get refuse wrong-mode in both directions',async()=>{
    const liveList=await moneyReads.money_list_topups({},
      await liveCtx(moneySdk(true,{topupMode:false})));
    expect(liveList.isError).toBe(true);
    const testGet=await moneyReads.money_get_topup({topupId},
      testCtx(moneySdk(false,{topupMode:true})));
    expect(testGet.isError).toBe(true);
  });
});

// --- Payout transactions: the mode-parameterized automatic proof --------
describe('CAP-4 D-1 payout transactions follow the connection mode',()=>{
  it('an automatic LIVE payout verifies on a LIVE connection',async()=>{
    const r=await moneyReads.money_list_payout_transactions({payoutId},
      await liveCtx(moneySdk(true)));
    expect(r.isError).toBeFalsy();
    expect(parse(r)).toMatchObject({payoutId,
      scope:'automatic_payout_only',data:[{id:txId}]});
  });
  it('a TEST automatic payout is refused on LIVE and a LIVE one on TEST',
    async()=>{
      const live=await moneyReads.money_list_payout_transactions(
        {payoutId},await liveCtx(moneySdk(true,{payoutMode:false})));
      expect(live.isError).toBe(true);
      const test=await moneyReads.money_list_payout_transactions(
        {payoutId},testCtx(moneySdk(false,{payoutMode:true})));
      expect(test.isError).toBe(true);
    });
  it('manual payouts stay refused in both modes',async()=>{
    const sdk=moneySdk(true);
    sdk.payouts.retrieve=async()=>payout(true,{automatic:false});
    const live=await moneyReads.money_list_payout_transactions(
      {payoutId},await liveCtx(sdk));
    expect(live.isError).toBe(true);
    const sdkTest=moneySdk(false);
    sdkTest.payouts.retrieve=async()=>payout(false,{automatic:false});
    const manualTest=await moneyReads.money_list_payout_transactions(
      {payoutId},testCtx(sdkTest));
    expect(manualTest.isError).toBe(true);
  });
  it('a wrong-mode transaction inside the list refuses the read',
    async()=>{
      const r=await moneyReads.money_list_payout_transactions(
        {payoutId},testCtx(moneySdk(false,{txMode:true})));
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toMatch(/mode mismatch/);
    });
});

// --- Bank accounts and payout schedule ------------------------------------
describe('CAP-4 D-1 bank and schedule reads follow the connection mode',()=>{
  it('money_list_bank_accounts projects LIVE banks on LIVE, masked',
    async()=>{
      const sdk=bankSdk({accountObj:account(true),
        bankObj:bank(true),balanceMode:true});
      const r=await bankReads.money_list_bank_accounts({},
        await liveCtx(sdk));
      expect(r.isError).toBeFalsy();
      const v=parse(r);
      expect(v).toMatchObject({available:true,complete:true,
        data:[{id:bankId,last4:'6789'}]});
      expect(JSON.stringify(v)).not.toMatch(/"(routing_number|account_number)":/);
    });
  it('money_list_bank_accounts refuses a wrong-mode bank in both '+
    'directions',async()=>{
      const live=await bankReads.money_list_bank_accounts({},
        await liveCtx(bankSdk({accountObj:account(true),
          bankObj:bank(false),balanceMode:true})));
      expect(live.isError).toBe(true);
      const test=await bankReads.money_list_bank_accounts({},
        testCtx(bankSdk({accountObj:account(undefined),
          bankObj:bank(true),balanceMode:false})));
      expect(test.isError).toBe(true);
    });
  it('TEST evidence is refused when the provider balance says LIVE',
    async()=>{
      const r=await bankReads.money_list_bank_accounts({},
        testCtx(bankSdk({accountObj:account(undefined),
          bankObj:bank(false),balanceMode:true})));
      expect(r.isError).toBe(true);
    });
  it('a provider denial still reports unavailable, now on LIVE too',
    async()=>{
      const r=await bankReads.money_list_bank_accounts({},
        await liveCtx(bankSdk({accountObj:account(true),
          bankObj:bank(true),balanceMode:true,deny:true})));
      expect(r.isError).toBeFalsy();
      expect(parse(r)).toMatchObject({available:false,complete:false});
    });
  it('money_get_payout_schedule reads the LIVE schedule as LIVE',
    async()=>{
      const r=await bankReads.money_get_payout_schedule({},
        await liveCtx(bankSdk({accountObj:account(true),
          bankObj:bank(true),balanceMode:true})));
      expect(r.isError).toBeFalsy();
      expect(parse(r)).toMatchObject({available:true,
        interval:'weekly',weeklyAnchor:'monday',delayDays:2,
        accountId:acct,mode:'live'});
    });
  it('money_get_payout_schedule keeps its TEST result byte-identical',
    async()=>{
      const r=await bankReads.money_get_payout_schedule({},
        testCtx(bankSdk({accountObj:account(undefined),
          bankObj:bank(false),balanceMode:false})));
      expect(r.isError).toBeFalsy();
      expect(parse(r)).toEqual({available:true,interval:'weekly',
        delayDays:2,weeklyAnchor:'monday',monthlyAnchor:null,
        accountId:acct,mode:'test',source:'own_account_readback'});
    });
});

// --- Descriptions ---------------------------------------------------------
describe('CAP-4 D-1 money read descriptions',()=>{
  it('all ten descriptions name both modes and claim neither alone',()=>{
    for(const t of [...moneyTools,...bankTools]){
      expect(t.description).toMatch(/TEST or LIVE/);
      expect(t.description).not.toMatch(/TEST-only/);
    }
  });
});
