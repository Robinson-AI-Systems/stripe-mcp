import {describe,it,expect} from 'vitest';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {registry} from '../../src/tools/index.js';
const conn={stripeAccount:'acct_TEST123',mode:'test',profile:'read_only'};
const sample={id:'cs_test_FAKE1234',object:'checkout.session',mode:'payment',
  status:'open',customer:'cus_FAKE1234',url:'https://checkout.stripe.com/test_FAKE',
  client_secret:'DO_NOT_EXPOSE'};
const list=x=>({data:[x],has_more:false});
const stripe={
  checkout:{sessions:{list:async()=>list(sample),retrieve:async()=>sample,
    listLineItems:async()=>list({id:'li_FAKE1234',object:'item',
      price:{id:'price_FAKE1234'},quantity:1,amount_total:1500})}},
  paymentLinks:{list:async()=>list({id:'plink_FAKE1234',active:true,
    url:'https://buy.stripe.com/test_FAKE'}),retrieve:async()=>({
      id:'plink_FAKE1234',active:true,url:'https://buy.stripe.com/test_FAKE'})},
  billingPortal:{configurations:{list:async()=>list({
    id:'bpc_FAKE1234',active:true,features:{subscription_cancel:{enabled:false}}}),
    retrieve:async()=>({id:'bpc_FAKE1234',active:true,
      features:{payment_method_update:{enabled:true}}})}}
};
const call=(name,args={},connection=conn)=>dispatchReadOnlyTool({
  registry,name,args,connection,db:{},
  services:{stripeForConnection:async()=>stripe}});
const data=x=>JSON.parse(x.content[0].text);
describe('D-3 hosted TEST safe readers',()=>{
  it('lists and gets checkout sessions with no client_secret',async()=>{
    const v=data(await call('checkout_list',{limit:20}));
    expect(v.data[0].id).toBe(sample.id);
    expect(JSON.stringify(v)).not.toContain('DO_NOT_EXPOSE');
    expect(data(await call('checkout_get',{sessionId:sample.id})).url)
      .toMatch(/^https:\/\/checkout.stripe.com/);
    expect((await call('checkout_get',{sessionId:'cs_live_FORBIDDEN'})).isError).toBe(true);
  });
  it('lists safe line items, paylinks, portal settings; refuses LIVE reads',async()=>{
    const items=data(await call('checkout_list_line_items',{sessionId:sample.id}));
    expect(items.data[0].amountTotal).toBe(1500);
    expect(data(await call('paylink_list')).data[0].active).toBe(true);
    expect(data(await call('portal_get_configuration',{configId:'bpc_FAKE1234'}))
      .features.paymentMethodUpdate).toBe(true);
    expect((await call('checkout_list',{}, {...conn,mode:'live'})).isError).toBe(true);
  });
});
