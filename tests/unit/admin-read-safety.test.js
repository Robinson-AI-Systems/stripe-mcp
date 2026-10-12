import {describe,it,expect,vi} from 'vitest';
import {requireAdminTestAccount,validateAdminArgs,parseAdminReply,readAdminTool}
  from '../../src/tools/admin-read-safety.js';
const ctx={connection:{mode:'test',stripeAccount:'acct_EFFTEST'}};
describe('shared TEST administrative read safety',()=>{
  it('rejects LIVE and invalid selected identities',()=>{
    expect(requireAdminTestAccount(ctx)).toBe('acct_EFFTEST');
    for(const c of [null,{}, {connection:{mode:'live',stripeAccount:'acct_EFFTEST'}},
      {connection:{mode:'test',stripeAccount:'acct_bad-hyphen'}}])
      expect(()=>requireAdminTestAccount(c)).toThrow(TypeError);
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
  it('treats reader error and thrown permissions as unavailable',async()=>{
    const fn=vi.fn(async()=>({content:[{text:'{"observed":true}'}]}));
    expect(await readAdminTool(fn,{},ctx)).toEqual({observed:true});
    expect(fn).toHaveBeenCalledWith({},ctx);
    expect(await readAdminTool(async()=>{throw Error('permission');},{},ctx)).toBeNull();
    expect(await readAdminTool(async()=>({isError:true}),{},ctx)).toBeNull();
  });
});
