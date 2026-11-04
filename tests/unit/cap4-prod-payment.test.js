// CAP-4 PROD-PAYMENT — payment-area coverage completion. The card's
// four claimed operations carry dispositions, and this suite pins the
// three that are door-behavior facts:
//
//   * confirmation_tokens GET — NO native read, and NOT door-served.
//     At baseline the door served it: the sensitive-family screen's
//     "tokens" alternative never matches "confirmation_tokens" (the
//     underscore is a word character, so no word boundary precedes
//     "tokens"), and at detail:'full' the door returned the token's
//     whole pre-confirmation payload — card fingerprint, billing
//     name/email/phone/address, and the customer acceptance IP and
//     user agent — under credential redaction only. The two refusal
//     tests below FAIL at baseline (the read succeeds there) and
//     pass with the family's explicit screen entry.
//   * mandates GET — door-sufficiency. The pinned catalog holds no
//     mandate list operation, so the door's per-object mode check is
//     complete for this family; the serve/refuse tests below pass
//     at baseline by design (they pin existing door behavior).
//   * payment_records GETs — native coverage deliberately out
//     (third-party subject, no consumer; the family closes with
//     D-9's write refusal under one reason), guarded universal read
//     serves. The tests below pass at baseline by design: single
//     reads are mode-verified by the door, and the list serves (the
//     door does not mode-verify list items — the recorded door
//     limitation the financial-connections census rows share).
import {describe,expect,it} from 'vitest';
import {handlers} from '../../src/tools/universal.js';
import {registry} from '../../src/tools/index.js';

const acct='acct_PRODPAY';
const parse=r=>{try{return JSON.parse(r.content[0].text);}
  catch{return r.content[0].text;}};
function ctx(mode,fixture){
  const calls=[];
  const stripe={rawRequest:async(method,path,_params,_opts)=>{
    calls.push({method,path});
    return JSON.parse(JSON.stringify(fixture));}};
  return {calls,ctx:{connection:{mode,profile:'full',stripeAccount:acct},
    services:{stripeForConnection:async()=>stripe}}};
}
const mandate=(livemode,over={})=>({id:'mandate_PRODPAY',object:'mandate',
  livemode,status:'active',type:'single_use',payment_method:'pm_PRODPAY',
  payment_method_details:{type:'sepa_debit',
    sepa_debit:{reference:'PRODPAYREF',url:'https://example.test/mandate'}},
  ...over});
const record=(livemode,over={})=>({id:'payr_PRODPAY',object:'payment_record',
  livemode,amount:{value:2000,currency:'usd'},reported_by:'PRODPAY',
  processor_details:{type:'custom'},...over});
const ctoken=(livemode,over={})=>({id:'ctoken_PRODPAY',
  object:'confirmation_token',livemode,expires_at:1999999999,
  payment_intent:'pi_PRODPAY',
  payment_method_preview:{type:'card',card:{brand:'visa',last4:'4242',
    exp_month:12,exp_year:2030,fingerprint:'fp_PRODPAY'},
    billing_details:{email:'payer@example.test',name:'Payer Fixture',
      phone:'+15555550100'}},
  mandate_data:{customer_acceptance:{type:'online',
    online:{ip_address:'203.0.113.9',user_agent:'prod-pay-fixture'}}},
  ...over});
const SENSITIVE='Sensitive universal family requires specialized original native reader';

describe('CAP-4 PROD-PAYMENT — confirmation token GET stays refused',()=>{
  it('refuses in TEST before any provider call',async()=>{
    const {ctx:c,calls}=ctx('test',ctoken(false));
    const r=parse(await handlers.api_read(
      {op:'GetConfirmationTokensConfirmationToken',
        pathParams:{confirmation_token:'ctoken_PRODPAY'}},c));
    expect(r).toBe(SENSITIVE);
    expect(calls).toHaveLength(0);
  });
  it('refuses in LIVE before any provider call',async()=>{
    const {ctx:c,calls}=ctx('live',ctoken(true));
    const r=parse(await handlers.api_read(
      {op:'GetConfirmationTokensConfirmationToken',
        pathParams:{confirmation_token:'ctoken_PRODPAY'},detail:'full'},c));
    expect(r).toBe(SENSITIVE);
    expect(calls).toHaveLength(0);
  });
  it('registers no native confirmation-token or payment-record tool',()=>{
    const names=registry.tools.map(t=>t.name);
    expect(names.some(n=>/confirmation_token|payment_record/.test(n)))
      .toBe(false);
  });
});

describe('CAP-4 PROD-PAYMENT — mandate GET is door-sufficient',()=>{
  it('serves a TEST mandate on a TEST connection',async()=>{
    const {ctx:c}=ctx('test',mandate(false));
    const r=parse(await handlers.api_read(
      {op:'GetMandatesMandate',pathParams:{mandate:'mandate_PRODPAY'}},c));
    expect(r.provider.id).toBe('mandate_PRODPAY');
    expect(r.mode).toBe('test');
  });
  it('serves a LIVE mandate on a LIVE connection',async()=>{
    const {ctx:c}=ctx('live',mandate(true));
    const r=parse(await handlers.api_read(
      {op:'GetMandatesMandate',pathParams:{mandate:'mandate_PRODPAY'}},c));
    expect(r.provider.id).toBe('mandate_PRODPAY');
    expect(r.mode).toBe('live');
  });
  it('refuses a LIVE mandate on a TEST connection',async()=>{
    const {ctx:c}=ctx('test',mandate(true));
    const r=parse(await handlers.api_read(
      {op:'GetMandatesMandate',pathParams:{mandate:'mandate_PRODPAY'}},c));
    expect(r).toBe('Provider response does not match authenticated account mode');
  });
  it('refuses a TEST mandate on a LIVE connection',async()=>{
    const {ctx:c}=ctx('live',mandate(false));
    const r=parse(await handlers.api_read(
      {op:'GetMandatesMandate',pathParams:{mandate:'mandate_PRODPAY'}},c));
    expect(r).toBe('Provider response does not match authenticated account mode');
  });
});

describe('CAP-4 PROD-PAYMENT — payment record GETs stay door-served',()=>{
  it('serves a TEST payment record by id',async()=>{
    const {ctx:c}=ctx('test',record(false));
    const r=parse(await handlers.api_read(
      {op:'GetPaymentRecordsId',pathParams:{id:'payr_PRODPAY'}},c));
    expect(r.provider.id).toBe('payr_PRODPAY');
    expect(r.mode).toBe('test');
  });
  it('refuses a LIVE payment record on a TEST connection',async()=>{
    const {ctx:c}=ctx('test',record(true));
    const r=parse(await handlers.api_read(
      {op:'GetPaymentRecordsId',pathParams:{id:'payr_PRODPAY'}},c));
    expect(r).toBe('Provider response does not match authenticated account mode');
  });
  it('serves the TEST payment record list',async()=>{
    const list={object:'list',has_more:false,
      data:[record(false),record(false,{id:'payr_PRODPAY2'})]};
    const {ctx:c}=ctx('test',list);
    const r=parse(await handlers.api_read({op:'GetPaymentRecords'},c));
    expect(r.provider.data).toHaveLength(2);
    expect(r.complete).toBe(true);
  });
});
