import { describe, expect, it } from 'vitest';
import { makeStripeClient, idempotencyKey, listAll, STRIPE_API_VERSION } from '../../src/stripe/client.js';
const key = ['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
describe('Stripe client safety and idempotency', () => {
  it('pins the stable API version', () => {
    expect(STRIPE_API_VERSION).toBe('2026-09-30.endive');
    expect(makeStripeClient({ key, mode: 'test' }).getApiField('version')).toBe(STRIPE_API_VERSION);
  });
  it('refuses live keys on preview and mismatched credentials', () => {
    const previous = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = 'preview';
    try {
      expect(() => makeStripeClient({ key: ['sk','live','FAKEFAKEFAKEFAKEFAKE'].join('_'), mode: 'live' })).toThrow(/refused/);
      expect(() => makeStripeClient({ key, mode: 'live' })).toThrow(/does not match/);
    } finally {
      if (previous === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previous;
    }
  });
  it('keeps a stable key across confirmation, field selection and property order', () => {
    const ctx = { account: 'acct_fixture', mode: 'test' }, now = 1900000000000;
    const a = idempotencyKey(ctx,'stripe_update',{amount:100,nested:{a:1,b:2},dryRun:true},{now});
    const b = idempotencyKey(ctx,'stripe_update',{nested:{b:2,a:1},amount:100,confirm:true,detail:'full'},{now});
    expect(a).toBe(b);
    expect(a).toMatch(/^rmcp_stripe_update_[a-f0-9]{64}$/);
    expect(idempotencyKey(ctx,'stripe_update',{amount:100,nested:{a:1,b:2}},{now:now+600000})).not.toBe(a);
    const persistent = idempotencyKey(ctx,'stripe_update',{amount:100,requestKey:'retry-name'},{now});
    expect(idempotencyKey(ctx,'stripe_update',{amount:100,requestKey:'retry-name'},{now:now+86400000})).toBe(persistent);
    expect(persistent).not.toContain('retry-name');
    expect(idempotencyKey(ctx,'stripe_update',{amount:100,requestKey:'different'},{now})).not.toBe(persistent);
  });
  it('uses true cursor paging and reports when capped', async () => {
    const seen = [];
    const results = [{data:[{id:'a'},{id:'b'}],has_more:true},{data:[{id:'c'}],has_more:true}];
    const input = {limit:2};
    const value = await listAll(async p => { seen.push(p); return results.shift(); },input,{max:3});
    expect(value.items.map(x=>x.id)).toEqual(['a','b','c']);
    expect(value.capped).toBe(true);
    expect(seen[1]).toEqual({limit:1,starting_after:'b'});
    expect(input).toEqual({limit:2});
  });
  it('rejects missing data instead of claiming all pages were read', async () => {
    await expect(listAll(async () => ({data:[],has_more:true}))).rejects.toThrow(/cannot advance/);
  });
});
