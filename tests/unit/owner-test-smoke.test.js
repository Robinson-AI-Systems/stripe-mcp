import {describe,it,expect,vi} from 'vitest';
import {runOwnerTestSmoke,ownerSmokeCases} from '../../src/acceptance/owner-test-smoke.js';
const account='acct_SMOKETEST',key=['sk','test','FAKEFAKEFAKEFAKEFAKE'].join('_');
const identity={object:'account',id:account,livemode:false,
  charges_enabled:true,payouts_enabled:false,details_submitted:true};
const reply=body=>({content:[{type:'text',text:JSON.stringify(body)}]});
function fixture(record=identity){
  const sdk={accounts:{retrieve:vi.fn(async()=>record)}};
  const makeClient=vi.fn(()=>sdk);
  const dispatch=vi.fn(async()=>reply({available:true,complete:true}));
  return {sdk,makeClient,dispatch};
}
describe('opt-in custom MCP TEST provider smoke',()=>{
  it('uses only registered read-only calls through actual custom dispatch contract',async()=>{
    const f=fixture();
    const report=await runOwnerTestSmoke({account,key,...f});
    expect(f.sdk.accounts.retrieve).toHaveBeenCalledTimes(1);
    expect(report).toMatchObject({account,mode:'test',source:'custom_mcp_dispatch',
      verifiedIdentity:true,dashboardVerified:false,writeOperations:0,
      errors:0,observed:ownerSmokeCases.length});
    expect(f.dispatch).toHaveBeenCalledTimes(ownerSmokeCases.length);
    for(const [args] of f.dispatch.mock.calls){
      expect(args).toMatchObject({connection:{mode:'test',stripeAccount:account,
        profile:'read_only'},services:{stripeForConnection:expect.any(Function)}});
      expect(args.registry.tools.find(x=>x.name===args.name).writes).toBe(false);
    }
    expect(JSON.stringify(report)).not.toContain(key);
    expect(report.records.some(x=>x.batch==='G-4')).toBe(true);
    expect(report.records.some(x=>x.batch==='G-5')).toBe(true);
    expect(report.records.some(x=>x.batch==='G-6')).toBe(true);
  });
  it('refuses missing keys, live secrets and foreign or incomplete account preflight',async()=>{
    const f=fixture();
    for(const badKey of [undefined,'', ['sk','live','FAKEFAKEFAKEFAKE'].join('_')])
      await expect(runOwnerTestSmoke({account,key:badKey,...f})).rejects.toThrow();
    for(const record of [{...identity,id:'acct_OTHER'},
      {...identity,charges_enabled:null},{...identity,livemode:true}]){
      const v=fixture(record);
      await expect(runOwnerTestSmoke({account,key,...v})).rejects.toThrow(/verification failed/);
      expect(v.dispatch).not.toHaveBeenCalled();
    }
  });
  it('distinguishes observed, partial, unreadable and errors without raw payloads',async()=>{
    const f=fixture();
    const values=[{available:true},{has_more:true},{available:false},
      {isError:true,content:[{type:'text',text:'secret_private'}]}];
    let i=0;
    f.dispatch=vi.fn(async()=>values[i++%values.length].isError?
      values[(i-1)%values.length]:reply(values[(i-1)%values.length]));
    const result=await runOwnerTestSmoke({account,key,...f});
    expect(result.observed).toBeGreaterThan(0);
    expect(result.partial).toBeGreaterThan(0);
    expect(result.notReadable).toBeGreaterThan(0);
    expect(result.errors).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain('secret_private');
  });
});
