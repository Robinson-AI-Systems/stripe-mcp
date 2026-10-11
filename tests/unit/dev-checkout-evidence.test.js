import {describe,it,expect} from 'vitest';
import {verifyCheckoutSession,verifyCheckoutPayment,
  matchesCheckoutEvent,verifiedHostedCheckoutUrl}
  from '../../src/dev/triggers-checkout.js';
const plan={type:'checkout.session.completed',runId:'run_'+'a'.repeat(24)};
const rows=new Map([
  ['customer_1',{object_id:'cus_FAKE123'}],
  ['price_1',{object_id:'price_FAKE123'}]
]);
const session=(extra={})=>({
  id:'cs_test_FAKE123',object:'checkout.session',livemode:false,
  status:'open',payment_status:'unpaid',payment_intent:null,
  client_reference_id:plan.runId,metadata:{rtc_run:plan.runId},
  customer:'cus_FAKE123',mode:'payment',amount_total:3600,currency:'usd',
  url:'https://checkout.stripe.com/c/pay/cs_test_FAKE123',...extra
});
const paid=()=>session({status:'complete',payment_status:'paid',
  payment_intent:'pi_FAKE123',url:null});
const pi=(extra={})=>({
  id:'pi_FAKE123',object:'payment_intent',livemode:false,
  customer:'cus_FAKE123',amount:3600,currency:'usd',amount_received:3600,
  status:'succeeded',metadata:{rtc_run:plan.runId},...extra
});
describe('V-3c3d genuine hosted TEST Checkout provenance',()=>{
  it('accepts created Session as pending but not as completed payment',()=>{
    expect(()=>verifyCheckoutSession(plan,session(),rows)).not.toThrow();
    expect(()=>verifyCheckoutSession(plan,session(),rows,true))
      .toThrow(/not actually completed/);
    expect(verifiedHostedCheckoutUrl(session())).toContain('checkout.stripe.com');
    expect(verifiedHostedCheckoutUrl(paid())).toBeNull();
    expect(()=>verifiedHostedCheckoutUrl(session({
      url:'https://example.com/phishing'
    }))).toThrow(/authentic Stripe-hosted/);
  });
  it('only accepts Checkout completion with provider-created paid PI',()=>{
    expect(()=>verifyCheckoutSession(plan,paid(),rows,true)).not.toThrow();
    expect(()=>verifyCheckoutPayment(plan,pi(),rows)).not.toThrow();
    for(const altered of [
      {status:'requires_payment_method'}, {amount_received:0},
      {amount:4500},{customer:'cus_OTHER'},
      {metadata:{rtc_run:'run_FOREIGN'}},{livemode:true}
    ])expect(()=>verifyCheckoutPayment(plan,pi(altered),rows)).toThrow();
  });
  it('rejects wrong account/customer/price/metadata before URL exposure',()=>{
    for(const altered of [
      {customer:'cus_OTHER'},{amount_total:100},
      {client_reference_id:'run_FOREIGN'},
      {metadata:{rtc_run:'run_FOREIGN'}},{livemode:true},
      {mode:'subscription'}, {currency:'eur'}
    ])expect(()=>verifyCheckoutSession(plan,session(altered),rows)).toThrow();
  });
  it('matches exact native Checkout Event, not a fabricated paid response',()=>{
    const target={id:'cs_test_FAKE123',type:'checkout_session',
      customer:'cus_FAKE123',paymentIntent:'pi_FAKE123'};
    expect(matchesCheckoutEvent(plan,paid(),target)).toBe(true);
    for(const altered of [
      {id:'cs_test_FOREIGN'},{payment_intent:'pi_FOREIGN'},
      {payment_status:'unpaid'},{status:'open'}
    ])expect(matchesCheckoutEvent(plan,paid()&&{...paid(),...altered},
      target)).toBe(false);
  });
});
