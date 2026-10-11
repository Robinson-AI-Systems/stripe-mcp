// V-5a: Stripe-published public TEST PaymentMethod references only.
// No card PAN, bank account number, token creation, SDK operation, or secret.
import {reply,allProfiles} from './billing-shared.js';
import {gone} from './write.js';
const source='https://docs.stripe.com/testing';
const entry=(scenario,method,category,paymentMethod,expected,note)=>Object.freeze({
  scenario,method,category,paymentMethod,expected,note
});
const fixtures=Object.freeze([
  entry('visa-success','card','success','pm_card_visa','succeeded',
    'Successful test Visa; available for card payment testing.'),
  entry('mastercard-success','card','success','pm_card_mastercard','succeeded',
    'Successful test Mastercard.'),
  entry('amex-success','card','success','pm_card_amex','succeeded',
    'Successful test American Express.'),
  entry('card-generic-decline','card','decline','pm_card_visa_chargeDeclined',
    'card_declined / generic_decline','Issuer decline; not attachable to a Customer.'),
  entry('card-insufficient-funds','card','decline',
    'pm_card_visa_chargeDeclinedInsufficientFunds',
    'card_declined / insufficient_funds',
    'Insufficient funds; not attachable to a Customer.'),
  entry('card-attached-failure','card','decline','pm_card_chargeCustomerFail',
    'card_declined after attachment',
    'Attaches successfully, then charging the Customer fails.'),
  entry('card-authentication-required','card','authentication',
    'pm_card_authenticationRequired','requires_action (3DS)',
    'Requires authentication on every transaction.'),
  entry('card-authentication-on-setup','card','authentication',
    'pm_card_authenticationRequiredOnSetup','requires_action until setup',
    'Off-session authentication requirement changes after setup for future use.'),
  entry('card-3ds-required','card','authentication',
    'pm_card_threeDSecure2Required','requires_action (3DS)',
    'A 3D Secure authentication challenge must be completed.'),
  entry('card-3ds-decline','card','authentication',
    'pm_card_threeDSecureRequiredChargeDeclined',
    'card_declined after 3DS',
    '3DS completes but the card is declined afterwards.'),
  entry('ach-success','us_bank_account','success',
    'pm_usBankAccount_success','payment_intent.succeeded after processing',
    'Test bank debit succeeds; verification/mandate rules still apply.'),
  entry('ach-account-closed','us_bank_account','decline',
    'pm_usBankAccount_accountClosed','payment_intent.payment_failed',
    'Test bank account is closed.'),
  entry('ach-insufficient-funds','us_bank_account','decline',
    'pm_usBankAccount_insufficientFunds','payment_intent.payment_failed',
    'Bank debit fails due to insufficient funds.'),
  entry('ach-not-authorized','us_bank_account','decline',
    'pm_usBankAccount_debitNotAuthorized','payment_intent.payment_failed',
    'Bank debit authorization refused.'),
  entry('ach-dispute','us_bank_account','dispute',
    'pm_usBankAccount_dispute','dispute',
    'Test bank debit triggers a dispute; use TEST only.'),
  entry('ach-processing','us_bank_account','pending',
    'pm_usBankAccount_processing','processing',
    'Remains in processing indefinitely; useful for cancellation testing.')
]);
const keys=new Set(['scenario','method','category','limit','offset']);
const categories=new Set(['success','decline','authentication','dispute','pending']);
export const tools=[{
  name:'dev_test_cards',area:'developer',writes:false,profiles:allProfiles,
  description:'Find documented TEST-only Stripe PaymentMethod IDs for success, card declines, 3DS and ACH cases; public reference data, no PAN or provider operation.',
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties:{
    scenario:{type:'string',maxLength:80},
    method:{type:'string',enum:['card','us_bank_account']},
    category:{type:'string',enum:[...categories]},
    limit:{type:'integer',minimum:1,maximum:30},
    offset:{type:'integer',minimum:0,maximum:500}
  },additionalProperties:false}
}];
export const handlers={
  dev_test_cards:async(args={},ctx)=>{
    if(ctx?.connection?.mode!=='test')
      return gone('Test fixtures are only available in TEST mode');
    if(!args||typeof args!=='object'||Array.isArray(args)||
      Object.keys(args).some(k=>!keys.has(k))||
      (args.scenario!==undefined&&(!/^[a-z][a-z0-9-]{0,79}$/.test(args.scenario)))||
      (args.method!==undefined&&!['card','us_bank_account'].includes(args.method))||
      (args.category!==undefined&&!categories.has(args.category)))
      return gone('Invalid exact TEST fixture filter');
    const {limit=20,offset=0,scenario,method,category}=args;
    if(!Number.isInteger(limit)||limit<1||limit>30||
      !Number.isInteger(offset)||offset<0||offset>500)
      return gone('Bounded TEST fixture pagination required');
    const matched=fixtures.filter(x=>
      (scenario===undefined||x.scenario===scenario)&&
      (method===undefined||x.method===method)&&
      (category===undefined||x.category===category));
    const data=matched.slice(offset,offset+limit);
    return reply({mode:'test',source,
      usage:'Use these published TEST PaymentMethod IDs with TEST API keys only. No real cards or bank details. This reference tool never creates a payment.',
      data,total:matched.length,hasMore:offset+data.length<matched.length,
      nextOffset:offset+data.length<matched.length?offset+data.length:null});
  }
};
