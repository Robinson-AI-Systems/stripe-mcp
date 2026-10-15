import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const client=()=>makeStripeClient({key,mode:'test'},
  {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
const opts={idempotencyKey:'rmcp_project_portal_create_mock_123'};
describe('P-4 pinned Stripe Portal creation contract',()=>{
  it('creates a native Billing Portal config using four exact feature names',async()=>{
    const s=client(),res=await s.billingPortal.configurations.create({features:{
      payment_method_update:{enabled:true},invoice_history:{enabled:true},
      subscription_cancel:{enabled:false},subscription_update:{enabled:false}
    }},opts);
    expect(res.object).toBe('billing_portal.configuration');
    expect((await s.billingPortal.configurations.retrieve('bpc_FAKE123')).object)
      .toBe('billing_portal.configuration');
  });
});
