import {describe,it,expect,vi} from 'vitest';
import {runOwnerTestSmoke,ownerSmokeCases} from '../../src/acceptance/owner-test-smoke.js';
const account='acct_SMOKETEST',key=['sk','test','FAKEFAKEFAKEFAKEFAKE'].join('_');
const identity={object:'account',id:account,livemode:false,
  charges_enabled:true,payouts_enabled:false,details_submitted:true};
const reply=body=>({content:[{type:'text',text:JSON.stringify(body)}]});
function shape(name){
  switch(name){
    case 'account_get':return {id:account,chargesEnabled:true,
      payoutsEnabled:false,detailsSubmitted:true,verification:'ok'};
    case 'account_list_capabilities':return {account,available:true,
      capabilities:[],hasMore:false};
    case 'account_list_payment_method_settings':return {account,available:true,
      configurations:[],hasMore:false};
    case 'account_list_apple_pay_domains':return {account,available:true,
      domains:[],hasMore:false};
    case 'event_list':
    case 'webhook_list':return {data:[],has_more:false};
    case 'admin_list_requirements':return {account,mode:'test',status:'ok',observed:true};
    case 'admin_check_setting':return {account,setting:'payment_methods',
      status:'observed',observed:true};
    default:throw Error('unlisted');
  }
}
function fixture(record=identity){
  const sdk={accounts:{retrieve:vi.fn(async()=>record)}};
  const makeClient=vi.fn(()=>sdk);
  const dispatch=vi.fn(async ({name})=>reply(shape(name)));
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
  it('does not accept generic JSON, foreign results or fabricated readable sections',async()=>{
    const f=fixture();
    f.dispatch=vi.fn(async ({name})=>{
      if(name==='account_get')return reply({id:'acct_OTHER',verification:'ok'});
      if(name==='account_list_capabilities')
        return reply({account:'acct_OTHER',available:true,capabilities:[],hasMore:false});
      if(name==='event_list')return reply({success:true});
      return reply(shape(name));
    });
    const report=await runOwnerTestSmoke({account,key,...f});
    expect(report.records.find(x=>x.tool==='account_get').status).toBe('error');
    expect(report.records.find(x=>x.tool==='account_list_capabilities').status).toBe('error');
    expect(report.records.find(x=>x.tool==='event_list').status).toBe('error');
    expect(report.errors).toBeGreaterThanOrEqual(3);
    expect(report.dashboardVerified).toBe(false);
  });
  it('refuses missing keys, live secrets and foreign or incomplete account preflight',async()=>{
    const f=fixture();
    for(const badKey of [undefined,'', ['sk','live','FAKEFAKEFAKEFAKE'].join('_')])
      await expect(runOwnerTestSmoke({account,key:badKey,...f})).rejects.toThrow();
    for(const record of [{...identity,id:'acct_OTHER'},
      {...identity,charges_enabled:null},{...identity,livemode:true},
      {...identity,livemode:undefined},{...identity,livemode:null},
      {...identity,livemode:'false'}]){
      const v=fixture(record);
      await expect(runOwnerTestSmoke({account,key,...v})).rejects.toThrow(/verification failed/);
      expect(v.dispatch).not.toHaveBeenCalled();
    }
  });
  it('distinguishes observed, partial, unreadable and errors without raw payloads',async()=>{
    const f=fixture();
    let i=0;
    f.dispatch=vi.fn(async ({name})=>{
      const n=i++,v=shape(name);
      if(n===1)return reply({...v,hasMore:true});
      if(n===2)return reply({...v,hasMore:false});
      if(n===3)return reply({...v,available:false,verification:'not_readable',
        domains:null,hasMore:null});
      if(n===4)return {isError:true,content:[{type:'text',text:'secret_private'}]};
      return reply(v);
    });
    const result=await runOwnerTestSmoke({account,key,...f});
    expect(result.observed).toBeGreaterThan(0);
    expect(result.partial).toBeGreaterThan(0);
    expect(result.notReadable).toBeGreaterThan(0);
    expect(result.errors).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain('secret_private');
  });
});
