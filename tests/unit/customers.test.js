import {describe,it,expect} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {listingForConnection} from '../../src/core/profiles.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {idempotencyKey} from '../../src/stripe/client.js';
import {createStripeForConnection} from '../../src/stripe/provider.js';
const account='acct_CUSTOMERTEST';
const connection={stripeAccount:account,mode:'test',profile:'full',listing:'catalog',
  clientId:'agent',resultScope:'11111111-1111-4111-8111-111111111111'};
function fixture(){
  const customer={id:'cus_FAKE123',object:'customer',name:'Example',
    email:'owner@example.test',metadata:{},balance:0,
    invoice_settings:{default_payment_method:null},created:1600000000};
  const calls=[];let credit=null,methodCustomer=customer.id;
  const stripe={customers:{
    async list(p){calls.push(['list',p]);return {data:[{...customer}],has_more:false};},
    async retrieve(id){return {...customer};},
    async search(p){calls.push(['search',p]);return {data:[{...customer}],has_more:false};},
    async create(p,o){calls.push(['create',p,o]);customer.id='cus_CREATED';Object.assign(customer,p);return {...customer};},
    async update(id,p,o){calls.push(['update',p,o]);Object.assign(customer,p);return {...customer};},
    async del(id,p,o){calls.push(['delete',id,o]);customer.deleted=true;return {id,deleted:true};},
    async listPaymentMethods(id,p){calls.push(['methods',p]);return {data:[{
      id:'pm_FAKE123',type:'card',customer:id,
      card:{brand:'visa',last4:'4242',fingerprint:'never-expose'}}],has_more:false};},
    async retrievePaymentMethod(id,pm){return {id:pm,type:'card',customer:id,
      card:{brand:'visa',last4:'4242',fingerprint:'never-expose'}};},
    async listBalanceTransactions(id,p){return {data:[{
      id:'cbtxn_FAKE',amount:-100,currency:'usd',type:'adjustment'}],has_more:false};},
    async createBalanceTransaction(id,p,o){calls.push(['credit',p,o]);credit={id:'cbtxn_NEW',...p};return credit;},
    async retrieveBalanceTransaction(){return credit;},
    async listTaxIds(){return {data:[],has_more:false};},
    async retrieveTaxId(){return {id:'txi_FAKE',deleted:true};},
    async createTaxId(id,p){return {id:'txi_NEW',...p};},
    async deleteTaxId(){return {id:'txi_FAKE',deleted:true};},
    async deleteDiscount(){customer.discount=null;return {};}
  },paymentMethods:{
    async retrieve(pm){return {id:pm,customer:methodCustomer};},
    async detach(pm,p,o){calls.push(['detach',pm,o]);methodCustomer=null;return {id:pm,customer:null};}
  }};
  const db=createFakeDb({accounts:[{id:account,money_limit_cents:50000}]});
  const call=(name,args={},conn=connection)=>dispatchReadOnlyTool({
    registry,name,args,connection:conn,db,services:{stripeForConnection:async c=>{
      if(c.stripeAccount!==account)throw Error('Wrong account');return stripe;}}});
  return {customer,calls,call,db};
}
const data=r=>JSON.parse(r.content[0].text);
describe('D-1 Stripe TEST customers and guarded writes',()=>{
  it('pages and redacts customer/method records while labeling app ownership',async()=>{
    const f=fixture();
    const list=data(await f.call('customer_list',{limit:20,email:'owner@example.test'}));
    expect(list.data[0].name).toBe('Example');
    expect(f.calls[0][1]).toEqual({limit:20,email:'owner@example.test'});
    const methods=data(await f.call('customer_list_payment_methods',{customerId:'cus_FAKE123'}));
    expect(methods.data[0]).toMatchObject({brand:'visa',last4:'4242'});
    expect(JSON.stringify(methods)).not.toContain('fingerprint');
    f.customer.metadata={agreementId:'ag_test'};
    expect(data(await f.call('customer_get',{customerId:'cus_FAKE123'}))
      .appRecord.agreementId).toBe('ag_test');
    expect((await f.call('customer_list',{limit:101})).isError).toBe(true);
  });
  it('validates the plain finder and keeps clients on their selected TEST account',async()=>{
    const f=fixture();
    await f.call('customer_find',{term:'owner@example.test'});
    expect(f.calls.at(-1)[1].query).toBe("email:'owner@example.test'");
    expect((await f.call('customer_search',{query:'name:x; DROP'})).isError).toBe(true);
    expect((await f.call('customer_get',{customerId:'bad'})).isError).toBe(true);
    expect((await f.call('customer_get',{customerId:'cus_FAKE123'},
      {...connection,mode:'live'})).isError).toBe(true);
    expect((await f.call('customer_get',{customerId:'cus_FAKE123'},
      {...connection,stripeAccount:'acct_OTHER'})).isError).toBe(true);
  });
  it('previews, audits and checks app ownership before direct customer updates',async()=>{
    const f=fixture(),a={customerId:'cus_FAKE123',name:'New name',requestKey:'r1'};
    expect(data(await f.call('customer_update',{...a,dryRun:true})).done).toBe(false);
    expect(f.calls.some(c=>c[0]==='update')).toBe(false);
    f.customer.metadata={agreementId:'ag_test'};
    expect(data(await f.call('customer_update',{...a,confirm:true})).done).toBe(false);
    expect(f.calls.some(c=>c[0]==='update')).toBe(false);
    f.customer.metadata={};
    expect(data(await f.call('customer_update',{...a,confirm:true})).done).toBe(true);
    const updated=f.calls.filter(c=>c[0]==='update');
    expect(updated).toHaveLength(1);
    expect(updated[0][2].idempotencyKey).toBe(idempotencyKey(connection,'customer_update',a));
    expect((await f.call('customer_update',{...a,confirm:true},
      {...connection,profile:'read_only'})).isError).toBe(true);
  });
  it('cannot smuggle a write into a batch or a read-only indirect call',async()=>{
    const f=fixture(),a={customerId:'cus_FAKE123',name:'Test'};
    expect((await f.call('stripe_batch',{calls:[{name:'customer_get',args:{customerId:a.customerId}},
      {name:'customer_update',args:{...a,confirm:true}}]})).isError).toBe(true);
    expect(data(await f.call('stripe_call',{name:'customer_update',
      args:{...a,dryRun:true}})).done).toBe(false);
    expect(f.calls.some(c=>c[0]==='update')).toBe(false);
    expect(data(await f.call('stripe_call',{name:'customer_update',
      args:{...a,confirm:true}})).done).toBe(true);
    expect(f.calls.filter(c=>c[0]==='update')).toHaveLength(1);
    expect((await f.call('stripe_call',{name:'customer_update',
      args:{...a,confirm:true}},{...connection,profile:'read_only'})).isError).toBe(true);
    expect(listingForConnection(registry,{...connection,profile:'read_only'}).some(
      t=>t.name==='customer_update')).toBe(false);
  });
  it('requires independent approval even for a one-cent TEST customer credit',async()=>{
    const f=fixture(),a={customerId:'cus_FAKE123',creditCents:1,description:'Fixture adjustment',
      confirm:true,requestKey:'owner1'};
    const first=data(await f.call('customer_add_balance_credit',a));
    expect(first.error).toMatch(/explicit approval/);
    expect(f.calls.some(c=>c[0]==='credit')).toBe(false);
    const key=idempotencyKey(connection,'customer_add_balance_credit',a);
    expect(await f.db.approveMoneyRequest({account,idempotencyKey:key})).toBe(true);
    expect(data(await f.call('customer_add_balance_credit',a)).done).toBe(true);
    expect(f.calls.filter(c=>c[0]==='credit')).toHaveLength(1);
    expect(f.calls.find(c=>c[0]==='credit')[1].amount).toBe(-1);
  });
  it('loads a server-selected TEST key only, without trusting user arguments',async()=>{
    let received=null;
    const load=createStripeForConnection({db:{},keyStoreFactory:()=>({
      loadKey:async x=>{received=x;return 'test-fixture-key';}}),
      clientFactory:x=>({mode:x.mode})});
    await expect(load({...connection,mode:'live'})).rejects.toThrow(/TEST/);
    expect(received).toBeNull();
    expect((await load(connection)).mode).toBe('test');
    expect(received).toEqual({account,mode:'test'});
  });
});
