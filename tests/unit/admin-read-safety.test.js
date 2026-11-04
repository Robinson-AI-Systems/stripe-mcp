import {describe,it,expect,vi} from 'vitest';
import {requireAdminAccount,validateAdminArgs,parseAdminReply,readAdminTool,verifiedAdminIdentity}
  from '../../src/tools/admin-read-safety.js';
const ctx={connection:{mode:'test',stripeAccount:'acct_EFFTEST'}};
describe('shared administrative read safety',()=>{
  it('accepts the connection mode and rejects invalid selected identities',()=>{
    // CAP-4 D-7: the shared admin gate is mode-aware — a connected
    // account in the connection's own mode (TEST or LIVE) qualifies.
    expect(requireAdminAccount(ctx)).toEqual({account:'acct_EFFTEST',mode:'test'});
    expect(requireAdminAccount({connection:{mode:'live',stripeAccount:'acct_EFFTEST'}}))
      .toEqual({account:'acct_EFFTEST',mode:'live'});
    for(const c of [null,{}, {connection:{mode:'other',stripeAccount:'acct_EFFTEST'}},
      {connection:{mode:'test',stripeAccount:'acct_bad-hyphen'}}])
      expect(()=>requireAdminAccount(c)).toThrow(TypeError);
    // The refusal names the connection's own mode; TEST is byte-identical
    // to the historical text.
    expect(()=>requireAdminAccount({connection:{mode:'test',stripeAccount:'bad'}}))
      .toThrow('Select a connected TEST Stripe account');
    expect(()=>requireAdminAccount({connection:{mode:'live',stripeAccount:'bad'}}))
      .toThrow('Select a connected LIVE Stripe account');
  });
  it('validates argument objects and unknown keys',()=>{
    expect(()=>validateAdminArgs({})).not.toThrow();
    expect(()=>validateAdminArgs({limit:2},['limit'])).not.toThrow();
    for(const a of [null,[],5,{limit:2,confirm:true}])
      expect(()=>validateAdminArgs(a,['limit'])).toThrow(TypeError);
  });
  it('accepts a single safe object but refuses invalid read payloads',()=>{
    const ok={content:[{text:'{"account":"acct_EFFTEST"}'}]};
    expect(parseAdminReply(ok)).toEqual({account:'acct_EFFTEST'});
    for(const a of [null,{...ok,isError:true},{content:[]},
      {content:[{text:'invalid'}]},{content:[{text:'[]'}]},
      {content:[{text:'{}'},{text:'{}'}]}])
      expect(parseAdminReply(a)).toBeNull();
  });
  it('requires a proven own TEST account ID before cross-surface observations',()=>{
    const observed={id:'acct_EFFTEST',verification:'not_readable',
      chargesEnabled:false,payoutsEnabled:false,detailsSubmitted:false};
    expect(verifiedAdminIdentity(observed,'acct_EFFTEST')).toBe(true);
    expect(verifiedAdminIdentity({id:'acct_EFFTEST',verification:'not_readable'},
      'acct_EFFTEST')).toBe(false);
    expect(verifiedAdminIdentity({...observed,chargesEnabled:'yes'},
      'acct_EFFTEST')).toBe(false);
    for(const v of [null,{}, {id:'acct_OTHER',verification:'ok'},
      {id:'acct_EFFTEST',verification:'ok',available:false},
      {id:'acct_EFFTEST',verification:'healthy'}])
      expect(verifiedAdminIdentity(v,'acct_EFFTEST')).toBe(false);
  });
  it('treats reader error and thrown permissions as unavailable',async()=>{
    const fn=vi.fn(async()=>({content:[{text:'{"observed":true}'}]}));
    expect(await readAdminTool(fn,{},ctx)).toEqual({observed:true});
    expect(fn).toHaveBeenCalledWith({},ctx);
    expect(await readAdminTool(async()=>{throw Error('permission');},{},ctx)).toBeNull();
    expect(await readAdminTool(async()=>({isError:true}),{},ctx)).toBeNull();
  });
});
