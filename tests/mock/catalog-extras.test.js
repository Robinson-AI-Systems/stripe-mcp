import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},
  {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
const options={idempotencyKey:'rmcp_e2_stripe_mock_123'};
describe('E-2 pinned Stripe SDK provider request contracts (no real account)',()=>{
  it('sends current coupons, promotion codes and tax rates to official typed paths',async()=>{
    const s=sdk();
    expect((await s.coupons.list({limit:2})).object).toBe('list');
    expect((await s.coupons.retrieve('TESTCOUPON')).object).toBe('coupon');
    expect((await s.coupons.create({percent_off:15,duration:'once'},options)).object)
      .toBe('coupon');
    expect((await s.coupons.update('TESTCOUPON',{name:'Updated'},options)).object)
      .toBe('coupon');
    expect((await s.coupons.del('TESTCOUPON',{},options)).deleted).toBe(true);
    expect((await s.promotionCodes.list({limit:2,code:'SUMMER'})).object).toBe('list');
    expect((await s.promotionCodes.retrieve('promo_FAKE123')).object)
      .toBe('promotion_code');
    expect((await s.promotionCodes.create({coupon:'TESTCOUPON',code:'SUMMER'},options))
      .object).toBe('promotion_code');
    expect((await s.promotionCodes.update('promo_FAKE123',{active:false},options))
      .object).toBe('promotion_code');
    expect((await s.taxRates.list({limit:2})).object).toBe('list');
    expect((await s.taxRates.retrieve('txr_FAKE123')).object).toBe('tax_rate');
    expect((await s.taxRates.create({
      display_name:'Sales',percentage:7.5,inclusive:false},options)).object)
      .toBe('tax_rate');
    expect((await s.taxRates.update('txr_FAKE123',{active:false},options)).object)
      .toBe('tax_rate');
  });
  it('sends feature and active-entitlement requests to current SDK resources',async()=>{
    const s=sdk();
    expect((await s.entitlements.features.list({limit:2})).object).toBe('list');
    expect((await s.entitlements.features.retrieve('feat_FAKE123')).object)
      .toBe('entitlements.feature');
    expect((await s.entitlements.features.create({
      name:'Premium access',lookup_key:'premium_access'},options)).object)
      .toBe('entitlements.feature');
    expect((await s.products.listFeatures('prod_FAKE123',{limit:2})).object)
      .toBe('list');
    expect((await s.products.createFeature('prod_FAKE123',{
      entitlement_feature:'feat_FAKE123'},options)).object).toBe('product_feature');
    expect((await s.products.deleteFeature('prod_FAKE123','feat_FAKE123',options))
      .deleted).toBe(true);
    expect((await s.entitlements.activeEntitlements.list({
      customer:'cus_FAKE123',limit:2})).object).toBe('list');
  });
});
