import {describe,it,expect} from 'vitest';
import {makeStripeClient,idempotencyKey} from '../../src/stripe/client.js';
const fakeKey=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key:fakeKey,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
const customer='cus_FAKE123',method='pm_FAKE123',tax='txi_FAKE123';
const options={idempotencyKey:'rmcp_customer_mock_12345'};
describe('D-1 real pinned Stripe SDK request shape through stripe-mock',()=>{
  it('uses existing customer read/list/search methods and paginated request parameters',async()=>{
    const s=stripe();
    expect((await s.customers.list({limit:2})).object).toBe('list');
    expect((await s.customers.retrieve(customer)).object).toBe('customer');
    expect((await s.customers.search({query:"email:'fixture@example.test'",limit:2})).object).toBe('search_result');
  });
  it('uses masked payment methods and nested customer balance/tax methods',async()=>{
    const s=stripe();
    expect((await s.customers.listPaymentMethods(customer,{type:'card',limit:2})).object).toBe('list');
    expect((await s.customers.retrievePaymentMethod(customer,method)).object).toBe('payment_method');
    expect((await s.customers.listBalanceTransactions(customer,{limit:2})).object).toBe('list');
    expect((await s.customers.listTaxIds(customer,{limit:2})).object).toBe('list');
  });
  it('submits valid customer create, update, delete and saved method mutations',async()=>{
    const s=stripe();
    expect((await s.customers.create({name:'Fixture Customer',email:'fixture@example.test'},options)).object)
      .toBe('customer');
    expect((await s.customers.update(customer,{description:'Fixture update'},options)).object)
      .toBe('customer');
    expect((await s.customers.update(customer,{
      invoice_settings:{default_payment_method:method}},options)).object).toBe('customer');
    expect((await s.customers.del(customer,options)).deleted).toBe(true);
    expect((await s.paymentMethods.detach(method,{},options)).object).toBe('payment_method');
  });
  it('submits money credit with integer cents, tax and discount methods',async()=>{
    const s=stripe();
    expect((await s.customers.createBalanceTransaction(customer,{
      amount:-1,currency:'usd',description:'Approved fixture credit'},options)).object)
      .toBe('customer_balance_transaction');
    expect((await s.customers.retrieveBalanceTransaction(customer,'cbtxn_FAKE123')).object)
      .toBe('customer_balance_transaction');
    expect((await s.customers.createTaxId(customer,{
      type:'eu_vat',value:'DE123456789'},options)).object).toBe('tax_id');
    expect((await s.customers.retrieveTaxId(customer,tax)).object).toBe('tax_id');
    expect((await s.customers.deleteTaxId(customer,tax,options)).deleted).toBe(true);
    expect((await s.customers.deleteDiscount(customer,options)).deleted).toBe(true);
  });
  it('binds idempotency to a single account, target and body regardless of confirm',()=>{
    const a={stripeAccount:'acct_FIXTURE1',mode:'test'};
    const input={customerId:customer,name:'Name',requestKey:'fixed1'};
    const first=idempotencyKey(a,'customer_update',input);
    expect(first).toBe(idempotencyKey(a,'customer_update',{...input,confirm:true}));
    expect(first).not.toBe(idempotencyKey(a,'customer_update',{...input,name:'Other'}));
    expect(first).not.toBe(idempotencyKey({...a,stripeAccount:'acct_OTHER'},'customer_update',input));
  });
});
