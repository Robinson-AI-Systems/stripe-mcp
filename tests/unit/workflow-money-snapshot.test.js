import {describe,it,expect,vi,afterEach} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {calculateRecurring} from '../../src/tools/workflow-money-snapshot.js';
import {civilStart,dateWindow} from '../../src/tools/workflow-read-common.js';

afterEach(()=>vi.useRealTimers());
const coupon={object:'discount',livemode:false,coupon:{object:'coupon',
  livemode:false,duration:'forever',percent_off:20,amount_off:null,currency:null},
  end:null};
const item=(id,currency,unit,interval,intervalCount=1,quantity=1,usage='licensed',
  scheme='per_unit')=>({id,quantity,
  price:{id:'price_'+id,unit_amount:unit,currency,billing_scheme:scheme,
    recurring:{interval,interval_count:intervalCount,usage_type:usage}},
  discounts:[]});
const sub=(id,status,items,discounts=[])=>({
  object:'subscription',id,status,customer:'cus_WTEST',currency:items[0]?.price.currency,
  items:{data:items,has_more:false},discounts,metadata:{},pause_collection:null
});
const parse=o=>JSON.parse(o.content[0].text);
const txn=(id,amount,currency,iso,fee=0)=>({object:'balance_transaction',
  id,amount,fee,net:amount-fee,currency,
  created:Math.floor(Date.parse(iso)/1000)});
function fixture({subscriptions=[],tx=[],onBalance,account='acct_WTEST'}={}){
  const seen=[];
  const split=(records,params,type)=>{
    seen.push({type,params});
    const index=params.starting_after?
      records.findIndex(x=>x.id===params.starting_after)+1:0;
    const page=records.slice(index,index+params.limit);
    return {data:page,has_more:index+page.length<records.length};
  };
  const stripe={
    balanceTransactions:{list:async p=>{
      onBalance?.();
      return split(tx,p,'transactions');
    }},
    subscriptions:{list:async p=>split(subscriptions,p,'subscriptions')},
    subscriptionItems:{list:async()=>({data:[],has_more:false})}
  };
  const ctx={connection:{mode:'test',stripeAccount:account,profile:'read_only'},
    services:{stripeForConnection:async()=>stripe}};
  return {ctx,seen,call:a=>registry.handlers.workflow_money_snapshot(a,ctx)};
}
describe('W-1 recurring revenue precision and exclusion',()=>{
  it('quarterly quantity two minus 20%, yearly EUR and trialing do not mix',()=>{
    const rows=[
      {id:'sub_USD',status:'active',pauseCollection:null,discounts:[{
        verified:true,duration:'forever',percentOff:20,amountOffMinor:null,endUnix:null}],
      items:[{id:'si_U',currency:'usd',unitAmountCents:3000,quantity:2,
        billingScheme:'per_unit',usageType:'licensed',recurring:{interval:'month',intervalCount:3},
        discounts:[]}]},
      {id:'sub_EUR',status:'active',pauseCollection:null,discounts:[],
      items:[{id:'si_E',currency:'eur',unitAmountCents:12000,quantity:1,
        billingScheme:'per_unit',usageType:'licensed',recurring:{interval:'year',intervalCount:1},
        discounts:[]}]},
      {id:'sub_TRIAL',status:'trialing',pauseCollection:null,discounts:[],
      items:[{id:'si_T',currency:'usd',unitAmountCents:2500,quantity:1,
        billingScheme:'per_unit',usageType:'licensed',recurring:{interval:'month',intervalCount:1},
        discounts:[]}]}
    ];
    expect(calculateRecurring(rows)).toMatchObject({
      mrrMinorByCurrency:{usd:1600,eur:1000},
      trialingPotentialMonthlyMinorByCurrency:{usd:2500},
      activeSubscriptions:2,trialingSubscriptions:1,complete:true});
  });
  it('never guesses unknown discounts or counts tiered/metered as MRR',()=>{
    const s=[{id:'sub_BAD',status:'active',items:[{id:'si_B',quantity:1,
      currency:'usd',unitAmountCents:2000,billingScheme:'per_unit',usageType:'licensed',
      recurring:{interval:'month',intervalCount:1},discounts:[]}],
    discounts:[{verified:false}]},{id:'sub_TIER',status:'active',
      items:[{id:'si_C',quantity:1,currency:'usd',unitAmountCents:null,
        billingScheme:'tiered',usageType:'licensed',recurring:{interval:'month',intervalCount:1},
        discounts:[]}],discounts:[]}];
    const m=calculateRecurring(s);
    expect(m.complete).toBe(false);
    expect(m.mrrMinorByCurrency).toEqual({});
    expect(m.excluded).toMatchObject([{subscription:'sub_TIER'}]);
  });
});
describe('W-1 read-only provider orchestration',()=>{
  it('preserves Denver DST day boundaries instead of fixed days',()=>{
    expect(civilStart('2026-03-08')).toBe(Math.floor(Date.parse('2026-03-08T07:00:00Z')/1000));
    expect(civilStart('2026-03-09')).toBe(Math.floor(Date.parse('2026-03-09T06:00:00Z')/1000));
    const w=dateWindow('2026-03-08','2026-03-08');
    expect(w.until-w.from).toBe(23*3600);
    expect(()=>civilStart('2026-02-30')).toThrow();
  });
  it('reads real wrapped pages and separates calendar money and MRR currencies',async()=>{
    const f=fixture({
      tx:[txn('txn_01',8000,'usd','2026-03-09T12:00:00Z',100),
        txn('txn_02',6000,'usd','2026-03-08T13:00:00Z',200),
        txn('txn_03',-2000,'usd','2026-03-08T10:00:00Z',0),
        txn('txn_04',4000,'eur','2026-03-07T23:00:00Z',80)],
      subscriptions:[sub('sub_01','active',[item('si_USD','usd',3000,'month',3,2)],[coupon]),
        sub('sub_02','active',[item('si_EUR','eur',12000,'year')]),
        sub('sub_03','trialing',[item('si_TRIAL','usd',1000,'month')]) ]
    });
    const result=parse(await f.call({fromDate:'2026-03-08',toDate:'2026-03-08'}));
    expect(result.complete).toBe(true);
    expect(result.moneyFlowsByCurrency).toMatchObject({
      usd:{moneyInMinor:6000,moneyOutMinor:2000,feesMinor:200,netMinor:3800}});
    expect(result.recurring.mrrMinorByCurrency).toEqual({eur:1000,usd:1600});
    expect(result.recurring.trialingPotentialMonthlyMinorByCurrency).toEqual({usd:1000});
    expect(f.seen.find(x=>x.type==='subscriptions').params.expand)
      .toEqual(['data.discounts','data.items.data.discounts']);
  });
  it('denies LIVE before any provider call and exposes bounded partial when time expires',async()=>{
    let called=0;
    const f=fixture({tx:[txn('txn_05',1000,'usd','2026-03-08T10:00:00Z')],
      onBalance:()=>{called++;vi.setSystemTime(new Date('2026-03-08T09:02:00Z'));}});
    f.ctx.connection.mode='live';
    expect((await f.call({fromDate:'2026-03-08',toDate:'2026-03-08'})).isError).toBe(true);
    expect(called).toBe(0);
    f.ctx.connection.mode='test';
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-03-08T09:00:00Z'));
    const result=parse(await f.call({fromDate:'2026-03-08',toDate:'2026-03-08'}));
    expect(result.complete).toBe(false);
    expect(result.moneyFlowsComplete).toBe(false);
    expect(result.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({section:'balance_transactions'})]));
    expect(called).toBe(1);
  });
  it('rejects malformed or reversed Colorado dates without invoking Stripe',async()=>{
    const f=fixture();
    expect((await f.call({fromDate:'2026-04-10',toDate:'2026-04-09'})).isError).toBe(true);
    expect((await f.call({fromDate:'2026-01-10',toDate:'2026-01-10',mode:'live'})).isError).toBe(true);
    expect(f.seen).toEqual([]);
  });
});
