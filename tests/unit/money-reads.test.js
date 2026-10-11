import {describe,it,expect,vi} from 'vitest';
import {tools,handlers} from '../../src/tools/money-reads.js';
import {registry} from '../../src/tools/index.js';
const acct='acct_MONEYREADS',payoutId='po_FAKE1234';
const conn={mode:'test',stripeAccount:acct,profile:'read_only'};
const tx={id:'txn_FAKE1234',object:'balance_transaction',currency:'usd',
  amount:3600,fee:110,net:3490,source:'ch_FAKE1234',
  type:'charge',status:'available',created:1760000000,available_on:1760000000};
const payout={id:payoutId,object:'payout',currency:'usd',amount:3490,
  status:'paid',automatic:true,arrival_date:1760010000,
  destination:{id:'ba_FAKE1234',last4:'1234',account_number:'RAW_BANK_NEVER'},
  failure_code:null};
const topup={id:'tu_FAKE1234',object:'topup',currency:'usd',amount:5000,
  source:{account_number:'RAW_BANK_NEVER'},status:'pending'};
const list=v=>({object:'list',data:[v],has_more:false});
function mock(){
  const stripe={
    balance:{retrieve:vi.fn(async()=>({
      object:'balance',livemode:false,
      available:[{currency:'usd',amount:3600}],
      pending:[{currency:'usd',amount:1200}]}))},
    balanceTransactions:{list:vi.fn(async()=>list(tx)),
      retrieve:vi.fn(async()=>tx)},
    payouts:{list:vi.fn(async()=>list(payout)),retrieve:vi.fn(async()=>payout)},
    topups:{list:vi.fn(async()=>list(topup)),retrieve:vi.fn(async()=>topup)}
  };
  const ctx={connection:conn,services:{stripeForConnection:async()=>stripe}};
  return {stripe,ctx,call:(name,a={})=>handlers[name](a,ctx)};
}
const result=x=>JSON.parse(x.content[0].text);
describe('G-1a account-scoped TEST balance/payout/top-up readers',()=>{
  it('registers exact native tool names as read-only and profile-safe',()=>{
    const names=['money_get_balance','money_list_balance_transactions',
      'money_get_balance_transaction','money_list_payouts','money_get_payout',
      'money_list_payout_transactions','money_list_topups','money_get_topup'];
    expect(tools.map(x=>x.name)).toEqual(names);
    expect(tools.every(x=>x.writes===false&&x.profiles.includes('read_only')))
      .toBe(true);
    for(const name of names)expect(registry.tools.filter(x=>x.name===name))
      .toHaveLength(1);
  });
  it('reads USD minor units without rounding or exposing raw account fields',async()=>{
    const f=mock();
    const balance=result(await f.call('money_get_balance'));
    expect(balance).toMatchObject({available:[{amountMinor:3600,currency:'usd'}],
      pending:[{amountMinor:1200,currency:'usd'}]});
    expect(JSON.stringify(balance)).not.toMatch(/RAW_BANK_NEVER/);
    expect(f.stripe.balance.retrieve).toHaveBeenCalledWith();
  });
  it('lists balance transactions and exact fee/net with bounded paging',async()=>{
    const f=mock();
    const read=result(await f.call('money_list_balance_transactions',{
      limit:7,type:'charge'}));
    expect(read.data[0]).toMatchObject({amountMinor:3600,feeMinor:110,
      netMinor:3490,currency:'usd'});
    expect(f.stripe.balanceTransactions.list)
      .toHaveBeenCalledWith({limit:7,type:'charge'});
    expect(result(await f.call('money_get_balance_transaction',{
      transactionId:tx.id}))).toMatchObject({id:tx.id,netMinor:3490});
    expect((await f.call('money_list_balance_transactions',{
      limit:101})).isError).toBe(true);
    expect((await f.call('money_get_balance_transaction',{
      transactionId:'not-id'})).isError).toBe(true);
  });
  it('payout and top-up projections contain IDs but never source bank numbers',async()=>{
    const f=mock();
    for(const [name,args] of [
      ['money_list_payouts',{}],['money_get_payout',{payoutId}],
      ['money_list_topups',{}],['money_get_topup',{topupId:topup.id}]])
      expect(JSON.stringify(result(await f.call(name,args))))
        .not.toContain('RAW_BANK_NEVER');
    expect(result(await f.call('money_get_payout',{payoutId})))
      .toMatchObject({id:payoutId,destinationId:'ba_FAKE1234'});
    expect(result(await f.call('money_get_topup',{topupId:topup.id})))
      .toMatchObject({id:topup.id,amountMinor:5000});
  });
  it('payout reconciliation refuses manual payouts rather than silently misreporting',async()=>{
    const f=mock();
    const v=result(await f.call('money_list_payout_transactions',{
      payoutId,limit:10}));
    expect(v).toMatchObject({payoutId,scope:'automatic_payout_only',
      data:[{id:tx.id,feeMinor:110}]});
    expect(f.stripe.balanceTransactions.list).toHaveBeenCalledWith({
      payout:payoutId,limit:10});
    f.stripe.payouts.retrieve.mockResolvedValueOnce({...payout,automatic:false});
    expect((await f.call('money_list_payout_transactions',{payoutId}))
      .isError).toBe(true);
  });
  it('blocks LIVE and refuses unexpected args or malformed provider results',async()=>{
    const f=mock();
    const live={...f.ctx,connection:{...conn,mode:'live'}};
    expect((await handlers.money_get_balance({},live)).isError).toBe(true);
    expect((await f.call('money_get_balance',{extra:true})).isError).toBe(true);
    expect((await f.call('money_get_topup',{topupId:'tu_FAKE1234',
      extra:1})).isError).toBe(true);
    f.stripe.balanceTransactions.list.mockResolvedValueOnce(
      list({...tx,net:2000}));
    expect((await f.call('money_list_balance_transactions',{})).isError)
      .toBe(true);
    f.stripe.balance.retrieve.mockResolvedValueOnce({object:'balance',
      available:[{currency:'usd',amount:'3600'}],pending:[]});
    expect((await f.call('money_get_balance',{})).isError).toBe(true);
  });
});
