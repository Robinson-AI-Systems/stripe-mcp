import {describe,it,expect,vi} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
import {verifyInboundTestEvent,makeTestWebhookReceiver} from '../../src/webhooks/test-receiver.js';
const account='acct_TESTRECEIPT',endpoint='we_TESTRECEIPT';
const secret='whsec_'+'X'.repeat(40),sdk=makeStripeClient({key:'sk_test_FAKEWEBHOOKRECEIVER',mode:'test'});
const event={id:'evt_TESTRECEIPT',object:'event',livemode:false,type:'invoice.paid',
  data:{object:{object:'invoice',id:'in_PRIVATEPAYLOAD'}}};
const bytes=e=>Buffer.from(JSON.stringify(e));
const signed=(payload,t=Math.floor(Date.now()/1000),s=secret)=>
  sdk.webhooks.generateTestHeaderString({payload:payload.toString(),secret:s,timestamp:t});
function request(payload,signature,extra={}){
  return {method:'POST',query:{account,endpoint},headers:{
    'content-type':'application/json','stripe-signature':signature,
    ...extra.headers},async *[Symbol.asyncIterator](){yield payload;},...extra};
}
function response(){return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;}};}
const store={load:vi.fn(async()=>secret)};
const fixture=()=>{
  const ids=new Set(),db={recordTestWebhookReceipt:vi.fn(async({account:a,endpoint:e,eventId})=>{
    const id=a+'|'+e+'|'+eventId;
    if(ids.has(id))return false;
    ids.add(id);return true;
  })};
  return {db,handler:makeTestWebhookReceiver({db,signatureStore:store})};
};
describe('Sandbox-only signed Stripe webhook HTTP receiver',()=>{
  it('verifies SDK-generated exact-byte HMAC and records one idempotent TEST receipt',async()=>{
    const raw=bytes(event),sig=signed(raw);
    expect(verifyInboundTestEvent({payload:raw,signature:sig,secret}))
      .toEqual({eventId:event.id,eventType:event.type});
    const {handler,db}=fixture();
    const first=response(),duplicate=response();
    await handler(request(raw,sig),first);
    await handler(request(raw,sig),duplicate);
    expect(first.body).toEqual({accepted:true,duplicate:false,mode:'test'});
    expect(duplicate.body).toEqual({accepted:true,duplicate:true,mode:'test'});
    expect(db.recordTestWebhookReceipt).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(first.body)).not.toContain('in_PRIVATEPAYLOAD');
    expect(JSON.stringify(first.body)).not.toContain(secret);
  });
  it('refuses wrong HMAC, changed body, timestamp replay, LIVE and Connect before storage',async()=>{
    const raw=bytes(event);
    const {handler,db}=fixture();
    for(const [body,signature] of [
      [raw,signed(raw,Math.floor(Date.now()/1000),'whsec_'+'Y'.repeat(40))],
      [bytes({...event,type:'invoice.updated'}),signed(raw)],
      [raw,signed(raw,Math.floor(Date.now()/1000)-301)],
      [bytes({...event,livemode:true}),signed(bytes({...event,livemode:true}))],
      [bytes({...event,account:'acct_ANOTHER'}),signed(bytes({...event,account:'acct_ANOTHER'}))]
    ]){
      const res=response();await handler(request(body,signature),res);
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({error:'unverified_test_delivery'});
    }
    expect(db.recordTestWebhookReceipt).not.toHaveBeenCalled();
  });
  it('rejects unknown endpoint, missing signature, non-JSON, oversized and non-POST',async()=>{
    const raw=bytes(event),sig=signed(raw),{handler,db}=fixture();
    for(const req of [
      request(raw,sig,{query:{account,endpoint:'we_!'}}),
      request(raw,sig,{headers:{'stripe-signature':undefined}}),
      request(raw,sig,{headers:{'content-type':'text/plain'}}),
      request(raw,sig,{headers:{'content-length':'999999'}}),
      request(Buffer.alloc(65537,65),sig),
      {...request(raw,sig),method:'GET'}
    ]){
      const res=response();await handler(req,res);
      expect([400,405]).toContain(res.statusCode);
      expect(JSON.stringify(res.body)).not.toContain(account);
    }
    expect(db.recordTestWebhookReceipt).not.toHaveBeenCalled();
  });
  it('fails closed if storage fails or no secret is provisioned',async()=>{
    const raw=bytes(event),sig=signed(raw),res=response();
    const handler=makeTestWebhookReceiver({db:{recordTestWebhookReceipt:async()=>{throw Error('db');}},
      signatureStore:{load:async()=>secret}});
    await handler(request(raw,sig),res);
    expect(res.statusCode).toBe(400);
    const r=response();
    await makeTestWebhookReceiver({db:{recordTestWebhookReceipt:async()=>true},
      signatureStore:{load:async()=>null}})(request(raw,sig),r);
    expect(r.statusCode).toBe(400);
  });
});
