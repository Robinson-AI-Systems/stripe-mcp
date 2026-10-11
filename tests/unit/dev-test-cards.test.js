import {describe,it,expect} from 'vitest';
import {tools,handlers} from '../../src/tools/dev-test-cards.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import * as meta from '../../src/tools/meta.js';
const connection={mode:'test',profile:'read_only',
  stripeAccount:'acct_TEST_FIXTURES',resultScope:'public-fixtures'};
const parse=r=>JSON.parse(r.content[0].text);
const call=(args={},c=connection)=>handlers.dev_test_cards(args,{connection:c,
  services:{stripeForConnection:()=>{throw Error('Provider access forbidden');}}});
describe('V-5a public Stripe TEST fixture catalog',()=>{
  it('offers only Stripe published synthetic test PaymentMethod IDs, not PANs',async()=>{
    const out=parse(await call());
    expect(out).toMatchObject({mode:'test',total:16,hasMore:false});
    expect(out.data).toHaveLength(16);
    expect(out.data.every(x=>/^pm_(card|usBankAccount)_/.test(x.paymentMethod)))
      .toBe(true);
    expect(JSON.stringify(out)).not.toMatch(/\b[0-9]{12,19}\b/);
    expect(out.source).toBe('https://docs.stripe.com/testing');
    expect(tools[0]).toMatchObject({name:'dev_test_cards',writes:false});
  });
  it('uses documented decline, 3DS and ACH outcomes precisely',async()=>{
    const decline=parse(await call({scenario:'card-attached-failure'}));
    expect(decline.data[0].paymentMethod).toBe('pm_card_chargeCustomerFail');
    expect(decline.data[0].note).toMatch(/Attaches successfully/);
    const auth=parse(await call({scenario:'card-3ds-required'}));
    expect(auth.data[0].paymentMethod).toBe('pm_card_threeDSecure2Required');
    const bank=parse(await call({scenario:'ach-processing'}));
    expect(bank.data[0]).toMatchObject({method:'us_bank_account',
      paymentMethod:'pm_usBankAccount_processing',expected:'processing'});
  });
  it('filters and pages deterministically with no silent truncation',async()=>{
    const a=parse(await call({method:'card',limit:3,offset:0}));
    const b=parse(await call({method:'card',limit:3,offset:3}));
    expect(a.data).toHaveLength(3);
    expect(a.hasMore).toBe(true);
    expect(a.nextOffset).toBe(3);
    expect(b.data).toHaveLength(3);
    expect(new Set([...a.data,...b.data].map(x=>x.scenario)).size).toBe(6);
    const bank=parse(await call({method:'us_bank_account',category:'decline'}));
    expect(bank.total).toBe(3);
    expect(bank.data.every(x=>x.method==='us_bank_account')).toBe(true);
    expect(parse(await call({scenario:'not-listed'})).data).toEqual([]);
  });
  it('refuses LIVE and malformed selectors, including direct and wrapped paths',async()=>{
    const live=await call({}, {...connection,mode:'live'});
    expect(live.isError).toBe(true);
    for(const args of [{limit:0},{offset:-1},{category:'anything'},
      {scenario:'../../config'},{other:'ignored'},null]){
      const v=await call(args);
      expect(v.isError).toBe(true);
    }
    const registry={tools:[...tools,...meta.tools],
      handlers:{...handlers,...meta.handlers}};
    const allowed=await dispatchReadOnlyTool({
      registry,name:'dev_test_cards',args:{scenario:'visa-success'},
      connection,db:{},services:{}});
    expect(parse(allowed).data[0].paymentMethod).toBe('pm_card_visa');
    const denied=await dispatchReadOnlyTool({
      registry,name:'dev_test_cards',args:{},
      connection:{...connection,mode:'live'},db:{},services:{}});
    expect(denied.isError).toBe(true);
  });
});
