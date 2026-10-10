import {describe,it,expect} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const connection={stripeAccount:'acct_TEST123',mode:'test',profile:'read_only',
  resultScope:'11111111-1111-4111-8111-111111111111'};
function fixture(){
  const pi={id:'pi_FAKE1234',object:'payment_intent',status:'succeeded',
    amount:1000,amount_received:1000,currency:'usd',customer:'cus_FAKE1234',
    client_secret:'pi_FAKE_secret_DO_NOT_EXPOSE',latest_charge:'ch_FAKE1234'};
  const ch={id:'ch_FAKE1234',object:'charge',amount:1000,paid:true,
    amount_refunded:0,currency:'usd',customer:'cus_FAKE1234',status:'succeeded'};
  const re={id:'re_FAKE1234',object:'refund',status:'succeeded',amount:1000,
    currency:'usd',charge:'ch_FAKE1234'};
  const si={id:'seti_FAKE1234',object:'setup_intent',status:'succeeded',
    client_secret:'seti_FAKE_secret_DO_NOT_EXPOSE'};
  let captured=null;
  const list=v=>({data:[v],has_more:false});
  const stripe={
    paymentIntents:{list:async p=>{captured=p;return list(pi);},
      retrieve:async()=>pi,search:async()=>list(pi)},
    charges:{list:async()=>list(ch),retrieve:async()=>ch,
      search:async()=>list(ch)},
    refunds:{list:async()=>list(re),retrieve:async()=>re},
    setupIntents:{list:async()=>list(si),retrieve:async()=>si}
  };
  const call=(name,args={},conn=connection)=>dispatchReadOnlyTool({registry,name,args,
    connection:conn,db:{},services:{stripeForConnection:async()=>stripe}});
  return {call,getCaptured:()=>captured};
}
const data=r=>JSON.parse(r.content[0].text);
describe('D-2 TEST payment readers and secret-safe summaries',()=>{
  it('lists payment intents with bounded paging and hides every client secret',async()=>{
    const f=fixture();
    const v=data(await f.call('payment_list',{limit:20,customer:'cus_FAKE1234'}));
    expect(v.data[0]).toMatchObject({id:'pi_FAKE1234',amount:1000,status:'succeeded'});
    expect(JSON.stringify(v)).not.toMatch(/client.secret|DO_NOT_EXPOSE/i);
    expect(f.getCaptured()).toEqual({limit:20,customer:'cus_FAKE1234'});
    expect((await f.call('payment_list',{limit:101})).isError).toBe(true);
    expect((await f.call('payment_get',{paymentId:'invalid'})).isError).toBe(true);
  });
  it('reports charge status and refundable cents without sensitive payment data',async()=>{
    const f=fixture();
    const ch=data(await f.call('charge_get',{chargeId:'ch_FAKE1234'}));
    expect(ch).toMatchObject({id:'ch_FAKE1234',paid:true,amount_refunded:0});
    const refunds=data(await f.call('payment_list_refunds',{charge:'ch_FAKE1234'}));
    expect(refunds.data[0]).toMatchObject({id:'re_FAKE1234',status:'succeeded'});
  });
  it('handles setup intents and search with read_only isolation',async()=>{
    const f=fixture();
    const setup=data(await f.call('setup_get',{setupId:'seti_FAKE1234'}));
    expect(setup.status).toBe('succeeded');
    expect(JSON.stringify(setup)).not.toContain('client_secret');
    expect(data(await f.call('payment_search',{query:"status:'succeeded'"})).data)
      .toHaveLength(1);
    expect((await f.call('payment_search',{query:'hello;DROP'})).isError).toBe(true);
    expect((await f.call('payment_get',{paymentId:'pi_FAKE1234'},
      {...connection,mode:'live'})).isError).toBe(true);
    expect((await f.call('payment_create_refund',{chargeId:'ch_FAKE1234',confirm:true}))
      .isError).toBe(true);
  });
});
