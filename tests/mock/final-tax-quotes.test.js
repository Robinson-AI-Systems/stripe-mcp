import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},
  {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
const opts={idempotencyKey:'rmcp_e4_mock_123'};
describe('E-4 pinned official Stripe SDK Tax and Quote request contracts',()=>{
  it('uses modern Tax settings, calculations, registrations, codes and transaction routes',async()=>{
    const s=sdk();
    expect((await s.tax.settings.retrieve()).object).toBe('tax.settings');
    expect((await s.tax.settings.update({defaults:{tax_behavior:'exclusive'}},opts))
      .object).toBe('tax.settings');
    expect((await s.tax.calculations.create({currency:'usd',
      customer_details:{address:{country:'US'},address_source:'billing'},
      line_items:[{amount:100,reference:'one'}]},opts)).object)
      .toBe('tax.calculation');
    expect((await s.tax.calculations.retrieve('taxcalc_FAKE123')).object)
      .toBe('tax.calculation');
    expect((await s.tax.registrations.list({limit:2})).object).toBe('list');
    expect((await s.tax.registrations.retrieve('taxreg_FAKE123')).object)
      .toBe('tax.registration');
    expect((await s.taxCodes.list({limit:2})).object).toBe('list');
    expect((await s.taxCodes.retrieve('txcd_FAKE123')).object).toBe('tax_code');
    expect((await s.tax.transactions.retrieve('tax_FAKE123')).object)
      .toBe('tax.transaction');
  });
  it('uses original native quote draft, lifecycle, listing and line-item APIs',async()=>{
    const s=sdk();
    expect((await s.quotes.list({limit:2})).object).toBe('list');
    expect((await s.quotes.retrieve('qt_FAKE123')).object).toBe('quote');
    expect((await s.quotes.create({customer:'cus_FAKE123',
      line_items:[{price:'price_FAKE123',quantity:1}]},opts)).object).toBe('quote');
    expect((await s.quotes.update('qt_FAKE123',{description:'Draft'},opts)).object)
      .toBe('quote');
    expect((await s.quotes.finalizeQuote('qt_FAKE123',{},opts)).object).toBe('quote');
    expect((await s.quotes.accept('qt_FAKE123',{},opts)).object).toBe('quote');
    expect((await s.quotes.cancel('qt_FAKE123',{},opts)).object).toBe('quote');
    expect((await s.quotes.listLineItems('qt_FAKE123',{limit:2})).object).toBe('list');
  });
});
