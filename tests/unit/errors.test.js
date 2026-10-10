import { describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { describeStripeFailure, isStripeFailure, toStripeToolError } from
  '../../src/tools/errors.js';
import { dispatchReadOnlyTool } from '../../src/core/mcp-server.js';
import { defineWrite } from '../../src/tools/write.js';

const failure=(Ctor,raw={})=>new Ctor({type:'invalid_request_error',...raw});
const requestId='req_abcdef123456789';
const options={mode:'test',requiredPermission:'refunds'};
const details=(ctor,data,extra=options)=>describeStripeFailure(failure(ctor,{
  requestId,...data
}),extra);
const textOf=result=>JSON.parse(result.content[0].text);

describe('B-4 safe Stripe error translation',()=>{
  const e=Stripe.errors;
  it('formats known card declines by decline_code without leaking raw text',()=>{
    const result=details(e.StripeCardError,{type:'card_error',statusCode:402,
      decline_code:'insufficient_funds',message:'private card 4242 declined'});
    expect(result.whatHappened).toMatch(/insufficient funds/);
    expect(result.whatToDo).toMatch(/another payment method/);
    expect(JSON.stringify(result)).not.toContain('4242');
    expect(result.technical).toContain(requestId);
  });
  it('handles the expired-card and unknown-bank-decline categories',()=>{
    expect(details(e.StripeCardError,{type:'card_error',decline_code:'expired_card'})
      .whatToDo).toMatch(/update their card/);
    expect(details(e.StripeCardError,{type:'card_error',decline_code:'something_new'})
      .whatToDo).toMatch(/contact their bank/);
  });
  it('names safe restricted-key permission and explains where to change it',()=>{
    const result=details(e.StripePermissionError,{type:'invalid_request_error',statusCode:403});
    expect(result.likelyCause).toContain('refunds');
    expect(result.whatToDo).toMatch(/Developers/);
    expect(result.technical).toContain(requestId);
  });
  it('explains revoked or rotated key without printing secret text',()=>{
    const result=details(e.StripeAuthenticationError,{type:'invalid_request_error',
      statusCode:401,message:'sk_live_SECRET_VALUE'});
    expect(result.whatToDo).toMatch(/private owner setup page/);
    expect(JSON.stringify(result)).not.toContain('SECRET_VALUE');
  });
  it('handles idempotency conflicts and rate limits without unsafe retry advice',()=>{
    const clash=details(e.StripeIdempotencyError,{type:'idempotency_error'});
    expect(clash.whatToDo).toMatch(/Inspect the original operation/);
    const limited=details(e.StripeRateLimitError,{type:'rate_limit_error',statusCode:429});
    expect(limited.whatToDo).toMatch(/same idempotency key/);
  });
  it('suggests checking account and mode without inventing a confirmed object',()=>{
    const missing=details(e.StripeInvalidRequestError,{type:'invalid_request_error',
      code:'resource_missing',statusCode:404,param:'customer'}, {mode:'test'});
    expect(missing.whatHappened).toMatch(/account or mode/);
    expect(missing.likelyCause).toMatch(/may be incorrect/);
    expect(missing.likelyCause).not.toContain('verified');
    const confirmed=details(e.StripeInvalidRequestError,{code:'resource_missing',statusCode:404},
      {mode:'test',otherModeObjectVerified:true});
    expect(confirmed.likelyCause).toMatch(/independently verified/);
  });
  it('explains invalid parameters, sanitizes unsafe paths and request identifiers',()=>{
    const result=details(e.StripeInvalidRequestError,{statusCode:400,param:'items[0].price',
      code:'parameter_invalid_integer',message:'sk_test_EXFILTRATE'});
    expect(result.likelyCause).toContain('items[0].price');
    const unsafe=details(e.StripeInvalidRequestError,{statusCode:400,param:'key=<secret>',
      requestId:'req_X\nSecret'});
    expect(JSON.stringify(unsafe)).not.toContain('key=<secret>');
    expect(unsafe.technical).toMatch(/request unavailable/);
  });
  it('explains account activation requirements without leaking arbitrary provider messages',()=>{
    const result=details(e.StripeInvalidRequestError,{statusCode:400,code:'account_invalid',
      message:'private extra fields'}, {requirementsDue:['business_profile.url','payouts_enabled']});
    expect(result.likelyCause).toContain('business_profile.url');
    expect(result.whatToDo).toContain('Account requirements');
    expect(JSON.stringify(result)).not.toContain('private extra fields');
  });
  it('leaves unknown non-Stripe errors for the preexisting fallback',()=>{
    expect(isStripeFailure(new Error('internal secret'))).toBe(false);
    expect(describeStripeFailure(new Error('internal secret'))).toBeNull();
    expect(toStripeToolError(new Error('internal secret'))).toBeNull();
  });
  it('makes a safely formatted MCP read error and preserves existing unknown fallback',async()=>{
    const connection={profile:'read_only',mode:'test',stripeAccount:'acct_fixture'};
    const registry={tools:[{name:'stripe_failing_read',writes:false,
      profiles:['read_only']}],handlers:{
      stripe_failing_read:async()=>{throw failure(e.StripePermissionError,{
        requestId, type:'invalid_request_error',statusCode:403,message:'private-key-secret'
      });}
    }};
    const out=await dispatchReadOnlyTool({registry,name:'stripe_failing_read',
      args:{},connection,db:{}});
    expect(textOf(out).whatHappened).toMatch(/cannot perform/);
    expect(JSON.stringify(out)).not.toContain('private-key-secret');
    registry.handlers.stripe_failing_read=async()=>{throw Error('internal secret')};
    const fallback=await dispatchReadOnlyTool({registry,name:'stripe_failing_read',
      args:{},connection,db:{}});
    expect(fallback.content[0].text).toMatch(/Could not read account details/);
  });
  it('formats official Stripe failures from the write adapter without hiding non-Stripe defects',async()=>{
    const op=defineWrite({name:'stripe_error_fixture',
      read:async()=>{throw failure(e.StripeInvalidRequestError,{
        statusCode:400,param:'customer',requestId
      });},
      summarize:async()=> 'Update isolated fixture', apply:async()=>{},
      readAfter:async()=>({}),verify:async()=>true
    });
    const ctx={db:{recordChange:async()=>1},
      connection:{stripeAccount:'acct_safe',mode:'test',profile:'full'}};
    const out=textOf(await op.handler({confirm:true},ctx));
    expect(out.whatHappened).toMatch(/rejected a field/);
    expect(out.technical).toContain(requestId);
    const broken=defineWrite({name:'stripe_non_stripe_error_fixture',
      read:async()=>{throw Error('internal validation failed');},
      summarize:async()=> 'Update isolated fixture',apply:async()=>{},
      readAfter:async()=>({}),verify:async()=>true});
    await expect(broken.handler({confirm:true},ctx)).rejects.toThrow(/internal validation/);
  });
});
