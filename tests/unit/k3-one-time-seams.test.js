import {describe,it,expect} from 'vitest';
import {stripeOneTimeSeams} from '../../src/core/k3-one-time-seams.js';
describe('K-3 Stripe-owned one-time secret seams',()=>{
  it('retains original Stripe AAD, query route and SQL account column',()=>{
    const db={addOneTimeSecret(){},consumeOneTimeSecret(){}};
    const seams=stripeOneTimeSeams(db);
    expect(seams.db).toBe(db);
    expect(seams.contextFor({id:'abc',account:'acct_ONE',mode:'test',
      kind:'webhook-secret'})).toBe('stripe-once/abc/acct_ONE/test/webhook-secret');
    expect(seams.contextFor({id:'abc',account:null,mode:'test',
      kind:'webhook-secret'})).toBe('stripe-once/abc//test/webhook-secret');
    expect(seams.setupPathFor('foo')).toBe('/api/stripe/setup?show=foo');
    expect(seams.accountFromRow({stripe_account:'acct_ONE'})).toBe('acct_ONE');
    expect(Object.isFrozen(seams)).toBe(true);
  });
  it('never treats an in-memory fake or missing durable consume as a valid adapter',()=>{
    for(const db of [{},{addOneTimeSecret(){}},{consumeOneTimeSecret(){}}]){
      expect(()=>stripeOneTimeSeams(db)).toThrow('Stripe durable atomic secret store required');
    }
  });
});
