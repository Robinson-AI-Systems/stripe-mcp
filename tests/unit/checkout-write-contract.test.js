// Every native hosted mutation executes the real seven-case guarded lifecycle.
import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makeCheckoutWrite} from '../../src/tools/checkout-writes.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const customerId='cus_FAKE1234',priceId='price_FAKE1234',
  sessionId='cs_test_FAKE1234',linkId='plink_FAKE1234',configId='bpc_FAKE1234';
const cases=[
  {name:'checkout_create_payment_link_for_customer',
    args:{customerId,amountCents:8500,productName:'Test service'}},
  {name:'checkout_create_setup_link',args:{customerId}},
  {name:'checkout_expire',args:{sessionId}},
  {name:'paylink_create',args:{priceId,quantity:1}},
  {name:'paylink_update',args:{linkId,metadata:{department:'test'}}},
  {name:'paylink_deactivate',args:{linkId}},
  {name:'paylink_activate',args:{linkId}},
  {name:'portal_create_session',args:{customerId,configId}},
  {name:'portal_update_configuration',args:{configId,subscriptionCancel:true}}
];
function fixture({appOwned,readBackMatches,limitCents},name){
  const provider={writes:[],afterCalls:0};
  const db=createFakeDb({accounts:[{id:'acct_safefixture',
    label:'Fixture',money_limit_cents:limitCents}]});
  const marker=appOwned?{agreementId:'ag_FAKE1234'}:{};
  const customer={id:customerId,object:'customer',metadata:marker};
  const price={id:priceId,object:'price',active:true,currency:'usd',
    unit_amount:8500,metadata:marker};
  const session={id:sessionId,object:'checkout.session',status:'open',
    mode:'payment',customer:customerId,url:'https://checkout.stripe.com/test_FAKE1234'};
  const link={id:linkId,object:'payment_link',active:name!=='paylink_activate',
    url:'https://buy.stripe.com/test_FAKE1234',metadata:marker};
  const config={id:configId,object:'billing_portal.configuration',active:true,
    metadata:marker,features:{subscription_cancel:{enabled:false}}};
  let newSession=null,newLink=null,portalSession=null;
  const record=opts=>provider.writes.push({idempotencyKey:opts?.idempotencyKey});
  const after=()=>{if(provider.writes.length>0)provider.afterCalls++;};
  const sdk={
    customers:{async retrieve(){return {...customer};}},
    prices:{async retrieve(){return {...price};}},
    checkout:{sessions:{
      async create(args,opts){
        record(opts);newSession={id:'cs_test_NEW1234',object:'checkout.session',
          status:'open',mode:args.mode,customer:args.customer,
          url:'https://checkout.stripe.com/test_NEW1234'};return {...newSession};
      },
      async retrieve(id){
        after();
        if(id==='cs_test_NEW1234')return readBackMatches?{...newSession}:
          {...newSession,mode:'unexpected'};
        return {...session};
      },
      async expire(_id,_args,opts){
        record(opts);if(readBackMatches)session.status='expired';
        return {...session};
      }
    }},
    paymentLinks:{
      async retrieve(id){
        after();
        if(id==='plink_NEW1234')return readBackMatches?{...newLink}:
          {...newLink,active:false};
        return {...link};
      },
      async create(args,opts){
        record(opts);newLink={id:'plink_NEW1234',object:'payment_link',active:true,
          url:'https://buy.stripe.com/test_NEW1234',metadata:args.metadata??{}};
        return {...newLink};
      },
      async update(_id,args,opts){
        record(opts);
        if(readBackMatches){
          if(args.active!==undefined)link.active=args.active;
          if(args.metadata)link.metadata={...link.metadata,...args.metadata};
          if(args.allow_promotion_codes!==undefined)
            link.allow_promotion_codes=args.allow_promotion_codes;
        }
        return {...link};
      }
    },
    billingPortal:{
      configurations:{
        async retrieve(){
          after();
          if(name==='portal_create_session'&&provider.writes.length>0&&!readBackMatches)
            return {...config,id:'bpc_MISMATCH'};
          return {...config};
        },
        async update(_id,args,opts){
          record(opts);
          if(readBackMatches)
            config.features={...config.features,...args.features};
          return {...config};
        }
      },
      sessions:{
        async create(args,opts){
          record(opts);
          portalSession={id:'bps_NEW1234',object:'billing_portal.session',
            customer:args.customer,configuration:args.configuration||configId,
            url:'https://billing.stripe.com/p/test_NEW1234'};
          return {...portalSession};
        }
      }
    }
  };
  const connection={stripeAccount:'acct_safefixture',mode:'test',profile:'full'};
  const ctx={db,connection,connectionId:'owner-client-fixture',
    getCustomer:async()=>({...customer}),
    services:{stripeForConnection:async()=>sdk,
      hostedReturnUrls:{
        success:'https://example.test/payments/success',
        cancel:'https://example.test/payments/cancel',
        portal:'https://example.test/customer/return'
      }}};
  return {provider,db,ctx};
}
for(const entry of cases){
  runWriteContract({withMoney:false,strictArgs:true,args:entry.args,
    fixtures:settings=>fixture(settings,entry.name),
    tool:()=>makeCheckoutWrite(entry.name)});
}
describe('D-3 hosted write doors and redirect controls',()=>{
  it.each(cases)('$name rejects read_only, LIVE and batch operations',async({name,args})=>{
    const f=fixture({appOwned:false,readBackMatches:true,limitCents:50000},name);
    const call=(tool,values,connection,services=f.ctx.services)=>dispatchReadOnlyTool({
      registry,name:tool,args:values,connection,db:f.db,services});
    const readOnly={...f.ctx.connection,profile:'read_only'};
    expect((await call(name,{...args,confirm:true},readOnly)).isError).toBe(true);
    expect((await call('stripe_call',{name,args:{...args,confirm:true}},readOnly))
      .isError).toBe(true);
    expect((await call(name,{...args,confirm:true},
      {...f.ctx.connection,mode:'live'})).isError).toBe(true);
    expect((await call('stripe_batch',{calls:[{name,args:{...args,confirm:true}}]},
      f.ctx.connection)).isError).toBe(true);
    expect(f.provider.writes).toHaveLength(0);
  });
  it('rejects AI-chosen redirect URLs and missing owner-approved return destinations',async()=>{
    const f=fixture({appOwned:false,readBackMatches:true,limitCents:50000},
      'checkout_create_setup_link');
    const input={customerId,success_url:'https://evil.example/',confirm:true};
    const result=await dispatchReadOnlyTool({registry,name:'checkout_create_setup_link',
      args:input,connection:f.ctx.connection,db:f.db,services:f.ctx.services});
    expect(result.isError).toBe(true);
    expect(f.provider.writes).toHaveLength(0);
    const without=await dispatchReadOnlyTool({registry,name:'checkout_create_setup_link',
      args:{customerId,confirm:true},connection:f.ctx.connection,db:f.db,
      services:{stripeForConnection:f.ctx.services.stripeForConnection}});
    expect(without.isError).toBe(true);
    expect(f.provider.writes).toHaveLength(0);
  });
});
