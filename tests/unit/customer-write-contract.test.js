// The real nine customer operations, not illustrative mock defineWrite adapters.
import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makeCustomerWrite} from '../../src/tools/customer-writes.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {idempotencyKey} from '../../src/stripe/client.js';

const customerId='cus_FAKE123',paymentMethodId='pm_FAKE123',taxId='txi_FAKE123';
const cases=[
  {name:'customer_create',args:{name:'New customer'},createOnly:true},
  {name:'customer_update',args:{customerId,name:'Changed customer'}},
  {name:'customer_delete',args:{customerId}},
  {name:'customer_remove_payment_method',args:{customerId,paymentMethodId}},
  {name:'customer_set_default_payment_method',args:{customerId,paymentMethodId}},
  {name:'customer_add_balance_credit',args:{customerId,creditCents:8500,
    description:'Owner-approved TEST customer credit'},withMoney:true},
  {name:'customer_add_tax_id',args:{customerId,type:'eu_vat',value:'DE123456789'}},
  {name:'customer_delete_tax_id',args:{customerId,taxId}},
  {name:'customer_remove_discount',args:{customerId}}
];
function fixture({appOwned,readBackMatches,limitCents}){
  const provider={writes:[],afterCalls:0};
  const db=createFakeDb({accounts:[{id:'acct_safefixture',
    label:'Fixture',money_limit_cents:limitCents}]});
  let applied=false,created=null,balance=null,tax=null;
  const customer={id:customerId,object:'customer',name:'Original customer',
    metadata:appOwned?{agreementId:'ag_APP123'}:{},deleted:false,
    invoice_settings:{default_payment_method:null},discount:{id:'di_FAKE'}};
  const paymentMethod={id:paymentMethodId,customer:customerId};
  const savedTax={id:taxId,deleted:false,type:'eu_vat',value:'DE123456789'};
  const write=opts=>{provider.writes.push(opts);applied=true;};
  const after=()=>{if(applied)provider.afterCalls++;};
  const stripe={
    customers:{
      async retrieve(id){
        after();
        if(id==='cus_CREATED123')return readBackMatches?
          {...created}: {...created,name:'Unexpected readback'};
        return {...customer};
      },
      async create(payload,opts){
        write(opts);
        created={id:'cus_CREATED123',object:'customer',metadata:{},
          ...payload};
        return {...created};
      },
      async update(id,payload,opts){
        write(opts);
        if(readBackMatches){
          Object.assign(customer,payload);
          if(payload.invoice_settings)customer.invoice_settings=payload.invoice_settings;
        }
        return {...customer};
      },
      async del(id,_params,opts){
        write(opts);if(readBackMatches)customer.deleted=true;
        return {id,deleted:true};
      },
      async createBalanceTransaction(id,payload,opts){
        write(opts);balance={id:'cbtxn_CREATED123',...payload};
        return {...balance};
      },
      async retrieveBalanceTransaction(){
        after();return readBackMatches?{...balance}:{...balance,amount:0};
      },
      async createTaxId(id,payload,opts){
        write(opts);tax={id:'txi_CREATED123',...payload};return {...tax};
      },
      async retrieveTaxId(){
        after();
        if(tax)return readBackMatches?{...tax}:{...tax,value:'OTHER'};
        return {...savedTax};
      },
      async deleteTaxId(id,other,_params,opts){
        write(opts);if(readBackMatches)savedTax.deleted=true;
        return {id:other,deleted:true};
      },
      async deleteDiscount(id,_params,opts){
        write(opts);if(readBackMatches)customer.discount=null;
        return {deleted:true};
      }
    },
    paymentMethods:{
      async retrieve(){
        after();return {...paymentMethod};
      },
      async detach(id,_params,opts){
        write(opts);if(readBackMatches)paymentMethod.customer=null;
        return {id,customer:null};
      }
    }
  };
  const connection={stripeAccount:'acct_safefixture',mode:'test',profile:'full',
    clientId:'contract-test'};
  const ctx={db,connection,connectionId:'owner-client-fixture',
    services:{stripeForConnection:async()=>stripe},
    getCustomer:async()=>({...customer})};
  return {provider,db,ctx};
}
for(const entry of cases){
  runWriteContract({
    withMoney:entry.withMoney===true,strictArgs:true,
    createOnly:entry.createOnly===true,args:entry.args,
    fixtures:settings=>fixture(settings),
    tool:()=>makeCustomerWrite(entry.name)
  });
}
describe('D-1 all nine write doors',()=>{
  it.each(cases)('$name: read-only, LIVE and batch doors reject before a provider write',
    async({name,args})=>{
      const f=fixture({appOwned:false,readBackMatches:true,limitCents:50000});
      const services=f.ctx.services,db=f.db;
      const deny=async(tool,args,connection)=>dispatchReadOnlyTool({
        registry,name:tool,args,connection,db,services});
      const restricted={...f.ctx.connection,profile:'read_only'};
      expect((await deny(name,{...args,confirm:true},restricted)).isError).toBe(true);
      expect((await deny('stripe_call',{name,args:{...args,confirm:true}},restricted))
        .isError).toBe(true);
      expect((await deny(name,{...args,confirm:true},
        {...f.ctx.connection,mode:'live'})).isError).toBe(true);
      expect((await deny('stripe_batch',{calls:[{name,args:{...args,confirm:true}}]},
        f.ctx.connection)).isError).toBe(true);
      expect(f.provider.writes).toHaveLength(0);
    });
});

describe('verified customer resource receipts',()=>{
  const parse=result=>JSON.parse(result.content[0].text);
  it('returns a verified creation ID only after the confirmed TEST write',async()=>{
    const f=fixture({appOwned:false,readBackMatches:true,limitCents:50000});
    const op=makeCustomerWrite('customer_create');
    const args={name:'Disposable TEST fixture',requestKey:'test-customer-receipt'};
    expect(parse(await op.handler({...args,dryRun:true},f.ctx)).resourceId).toBeUndefined();
    expect(f.provider.writes).toHaveLength(0);
    const result=parse(await op.handler({...args,confirm:true},f.ctx));
    expect(result).toMatchObject({done:true,confirmed:true,mode:'test',resourceId:'cus_CREATED123'});
    expect(result).not.toHaveProperty('name');
    expect(result).not.toHaveProperty('metadata');
    expect(f.provider.writes).toHaveLength(1);
  });
  it('never emits an ID on unverified provider readback',async()=>{
    const f=fixture({appOwned:false,readBackMatches:false,limitCents:50000});
    const result=parse(await makeCustomerWrite('customer_create').handler({
      name:'Disposable TEST fixture',confirm:true,requestKey:'unverified-customer-receipt'
    },f.ctx));
    expect(result.done).toBe(false);
    expect(result.confirmed).toBe(false);
    expect(result.resourceId).toBeUndefined();
    expect(result.warning).toMatch(/Read-back/);
  });
  it('returns only the independently confirmed deleted customer ID',async()=>{
    const f=fixture({appOwned:false,readBackMatches:true,limitCents:50000});
    const result=parse(await makeCustomerWrite('customer_delete').handler({
      customerId,confirm:true,requestKey:'verified-delete-receipt'
    },f.ctx));
    expect(result).toMatchObject({done:true,confirmed:true,resourceId:customerId});
    expect(result).not.toHaveProperty('email');
    expect(f.provider.writes).toHaveLength(1);
  });
});


describe('customer receipts route to the same customer across all nine operations',()=>{
  const parse=result=>JSON.parse(result.content[0].text);
  it.each(cases)('$name: verified receipt is a customer_get ID, never a child resource',
    async({name,args,withMoney,createOnly})=>{
      const f=fixture({appOwned:false,readBackMatches:true,limitCents:50000});
      const request={...args,confirm:true,requestKey:'receipt-routing-'+name};
      const op=makeCustomerWrite(name);
      if(withMoney){
        const approved=await f.db.approveMoneyRequest({account:f.ctx.connection.stripeAccount,
          idempotencyKey:idempotencyKey(f.ctx.connection,name,request)});
        expect(approved).toBe(true);
      }
      const result=parse(await op.handler(request,f.ctx));
      expect(result).toMatchObject({done:true,confirmed:true,
        resourceId:createOnly?'cus_CREATED123':customerId});
      expect(result.resourceId).toMatch(/^cus_[A-Za-z0-9]+$/);
      expect(result).not.toHaveProperty('customer');
      expect(JSON.stringify(result)).not.toMatch(/pm_FAKE123|txi_CREATED123|cbtxn_CREATED123/);
      expect(f.provider.writes).toHaveLength(1);
    });
});
