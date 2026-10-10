// All nine native payment writes must pass the seven real-handler guard cases.
import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makePaymentWrite} from '../../src/tools/payment-writes.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const customerId='cus_FAKE1234',paymentId='pi_FAKE1234',chargeId='ch_FAKE1234',
  refundId='re_FAKE1234',setupId='seti_FAKE1234';
const cases=[
  {name:'payment_charge_saved_method',args:{customerId,amountCents:8500,description:'One-off TEST charge'}},
  {name:'payment_capture',args:{paymentId,amountCents:8500}},
  {name:'payment_cancel',args:{paymentId}},
  {name:'payment_update',args:{paymentId,description:'Updated TEST payment'}},
  {name:'charge_update',args:{chargeId,description:'Updated TEST charge'}},
  {name:'payment_create_refund',args:{chargeId,amountCents:8500,reason:'requested_by_customer'},
    withMoney:true,appOwnedAllowed:true},
  {name:'payment_update_refund',args:{refundId,metadata:{case:'updated'}}},
  {name:'payment_cancel_refund',args:{refundId}},
  {name:'setup_cancel',args:{setupId}}
];
function fixture({appOwned,readBackMatches,limitCents}){
  const provider={writes:[],afterCalls:0};
  const db=createFakeDb({accounts:[{id:'acct_safefixture',label:'Fixture',money_limit_cents:limitCents}]});
  const customer={id:customerId,object:'customer',metadata:appOwned?{agreementId:'ag_FAKE'}:{},
    invoice_settings:{default_payment_method:'pm_FAKE1234'}};
  const intent={id:paymentId,object:'payment_intent',status:'requires_capture',amount:8500,
    amount_capturable:8500,currency:'usd',customer:customerId,metadata:{},description:'Before'};
  const charge={id:chargeId,object:'charge',paid:true,amount:8500,amount_refunded:0,
    refunded:false,currency:'usd',customer:customerId,metadata:{},description:'Before'};
  const refund={id:refundId,object:'refund',charge:chargeId,amount:8500,
    status:'requires_action',metadata:{}};
  const setup={id:setupId,object:'setup_intent',status:'requires_action',
    customer:customerId,metadata:{}};
  let createdIntent=null,createdRefund=null;
  const wrote=opts=>{provider.writes.push({idempotencyKey:opts?.idempotencyKey});};
  const after=()=>{if(provider.writes.length>0)provider.afterCalls++;};
  const sdk={
    customers:{async retrieve(){return {...customer};}},
    paymentMethods:{async retrieve(){return {id:'pm_FAKE1234',customer:customerId};}},
    paymentIntents:{
      async retrieve(id){
        after();
        if(id==='pi_NEW1234')return readBackMatches?{...createdIntent}:
          {...createdIntent,status:'requires_payment_method'};
        return {...intent};
      },
      async create(params,opts){
        wrote(opts);
        createdIntent={id:'pi_NEW1234',object:'payment_intent',status:'succeeded',
          ...params,customer:customerId};
        return {...createdIntent};
      },
      async capture(_id,_params,opts){
        wrote(opts);if(readBackMatches)intent.status='succeeded';
        return {...intent};
      },
      async cancel(_id,_params,opts){
        wrote(opts);if(readBackMatches)intent.status='canceled';
        return {...intent};
      },
      async update(_id,params,opts){
        wrote(opts);if(readBackMatches)Object.assign(intent,params);
        return {...intent};
      }
    },
    charges:{
      async retrieve(){return {...charge};},
      async update(_id,params,opts){
        wrote(opts);if(readBackMatches)Object.assign(charge,params);
        return {...charge};
      }
    },
    refunds:{
      async retrieve(id){
        after();
        if(id==='re_NEW1234')return readBackMatches?{...createdRefund}:
          {...createdRefund,amount:0};
        return {...refund};
      },
      async create(params,opts){
        wrote(opts);
        createdRefund={id:'re_NEW1234',object:'refund',amount:params.amount??8500,
          charge:params.charge,status:'succeeded',metadata:{}};
        return {...createdRefund};
      },
      async update(_id,params,opts){
        wrote(opts);if(readBackMatches)Object.assign(refund,params);
        return {...refund};
      },
      async cancel(_id,_params,opts){
        wrote(opts);if(readBackMatches)refund.status='canceled';
        return {...refund};
      }
    },
    setupIntents:{
      async retrieve(){
        after();return {...setup};
      },
      async cancel(_id,_params,opts){
        wrote(opts);if(readBackMatches)setup.status='canceled';
        return {...setup};
      }
    }
  };
  const connection={stripeAccount:'acct_safefixture',mode:'test',profile:'full'};
  const ctx={db,connection,connectionId:'owner-client-fixture',
    getCustomer:async()=>({...customer}),
    services:{stripeForConnection:async()=>sdk}};
  return {provider,db,ctx};
}
for(const entry of cases){
  runWriteContract({withMoney:entry.withMoney===true,
    appOwnedAllowed:entry.appOwnedAllowed===true,
    strictArgs:true,args:entry.args,fixtures:settings=>fixture(settings),
    tool:()=>makePaymentWrite(entry.name)});
}
describe('D-2 all nine payment write doors',()=>{
  it.each(cases)('$name refuses READ ONLY, LIVE, and mixed batches before provider writes',
    async ({name,args})=>{
      const f=fixture({appOwned:false,readBackMatches:true,limitCents:50000});
      const invoke=(tool,input,conn)=>dispatchReadOnlyTool({registry,name:tool,args:input,
        connection:conn,db:f.db,services:f.ctx.services});
      const readOnly={...f.ctx.connection,profile:'read_only'};
      expect((await invoke(name,{...args,confirm:true},readOnly)).isError).toBe(true);
      expect((await invoke('stripe_call',{name,args:{...args,confirm:true}},readOnly))
        .isError).toBe(true);
      expect((await invoke(name,{...args,confirm:true},
        {...f.ctx.connection,mode:'live'})).isError).toBe(true);
      expect((await invoke('stripe_batch',{calls:[{name,args:{...args,confirm:true}}]},
        f.ctx.connection)).isError).toBe(true);
      expect(f.provider.writes).toHaveLength(0);
    });
});
