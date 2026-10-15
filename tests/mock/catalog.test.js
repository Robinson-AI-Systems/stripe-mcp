import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},
  {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
const opts={idempotencyKey:'rmcp_catalog_mock_contract_123'};
const prod='prod_FAKE123',price='price_FAKE123';
describe('E-1 official pinned Stripe SDK catalog paths (stripe-mock)',()=>{
  it('reads bounded product and price list/get/search responses',async()=>{
    const s=sdk();
    expect((await s.products.list({limit:2})).object).toBe('list');
    expect((await s.products.retrieve(prod)).object).toBe('product');
    expect((await s.products.search({query:"name:'Catalog'",limit:2})).object).toBe('search_result');
    expect((await s.prices.list({product:prod,limit:2})).object).toBe('list');
    expect((await s.prices.list({lookup_keys:['standing_month'],limit:2})).object).toBe('list');
    expect((await s.prices.retrieve(price)).object).toBe('price');
    expect((await s.prices.search({query:"lookup_key:'standing_month'",limit:2})).object).toBe('search_result');
  });
  it('validates TEST product lifecycle payload and Stripe method paths',async()=>{
    const s=sdk();
    expect((await s.products.create({name:'Safe catalog item',
      metadata:{source:'catalog-test'}},opts)).object).toBe('product');
    expect((await s.products.update(prod,{name:'Safe updated item'},opts)).object).toBe('product');
    expect((await s.products.update(prod,{active:false},opts)).object).toBe('product');
    expect((await s.products.update(prod,{active:true},opts)).object).toBe('product');
    expect((await s.products.del(prod,{},opts)).deleted).toBe(true);
  });
  it('uses only current supported price create/update fields',async()=>{
    const s=sdk();
    expect((await s.prices.create({product:prod,lookup_key:'standing_month',
      currency:'usd',unit_amount:3600,
      recurring:{interval:'month',interval_count:1,usage_type:'licensed'}},opts))
      .object).toBe('price');
    expect((await s.prices.update(price,{nickname:'Safe nickname',active:false},opts))
      .object).toBe('price');
  });
});
