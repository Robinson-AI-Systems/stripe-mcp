import {describe,it,expect,vi} from 'vitest';
import {handlers,safeConfiguration,tools} from '../../src/tools/account-payment-settings.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const acct='acct_TESTPAYMENT',privateData='VERY_PRIVATE_CUSTOMER_VALUE';
const base={object:'payment_method_configuration',id:'pmc_ABC123',active:true,
  card:{available:true,display_preference:{value:'on',preference:'on'}},
  us_bank_account:{available:false,display_preference:{value:'off',preference:'off'}},
  metadata:{secret:privateData}};
const parse=x=>JSON.parse(x.content[0].text);
function fixture({cfg=base,pageMore=false,error,identity={object:'account',id:acct,livemode:false}}={}){
  const sdk={accounts:{retrieve:vi.fn(async()=>identity)},
    paymentMethodConfigurations:{list:vi.fn(async()=>{if(error)throw error;
      return {object:'list',data:[cfg],has_more:pageMore};})}};
  const ctx={connection:{stripeAccount:acct,mode:'test',profile:'read_only'},
    services:{stripeForConnection:async()=>sdk}};
  return {sdk,ctx,run:a=>handlers.account_list_payment_method_settings(a,ctx)};
}
describe('G-5c1 TEST native payment method configuration inspection',()=>{
  it('registered read-only, verifies owner TEST identity and safe projection',async()=>{
    expect(tools[0].writes).toBe(false);
    expect(registry.tools.filter(x=>x.name===tools[0].name)).toHaveLength(1);
    const f=fixture();
    const result=parse(await f.run({}));
    expect(result).toMatchObject({account:acct,available:true,hasMore:false});
    expect(result.configurations[0].methods.us_bank_account).toEqual({
      available:false,preference:'off',effective:'off'});
    expect(JSON.stringify(result)).not.toContain(privateData);
    expect(f.sdk.paymentMethodConfigurations.list).toHaveBeenCalledWith({limit:10});
  });
  it('uses native pagination with an actual cursor, no silent truncation',async()=>{
    const f=fixture({pageMore:true});
    const p=parse(await f.run({limit:1,starting_after:'pmc_OLD123'}));
    expect(p).toMatchObject({hasMore:true,nextCursor:base.id});
    expect(f.sdk.paymentMethodConfigurations.list).toHaveBeenCalledWith({
      limit:1,starting_after:'pmc_OLD123'});
  });
  it('refuses foreign account, LIVE, unexpected or malformed data, unsupported args',async()=>{
    expect((await fixture({identity:{object:'account',id:'acct_FOREIGN'}}).run({})).isError).toBe(true);
    expect((await fixture({identity:{object:'account',id:acct,livemode:true}}).run({})).isError).toBe(true);
    for(const a of [{limit:0},{limit:50},{starting_after:'abc'},{account:'foreign'}])
      expect((await fixture().run(a)).isError).toBe(true);
    expect(()=>safeConfiguration({...base,card:{available:false,display_preference:{
      value:'surprise',preference:'off'}}})).toThrow();
    const f=fixture();
    expect((await handlers.account_list_payment_method_settings({},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
  });
  it('403/404 is unreadable, never false disabled, and only allowed for listing',async()=>{
    for(const statusCode of [403,404]){
      const r=parse(await fixture({error:{statusCode}}).run({}));
      expect(r).toMatchObject({available:false,verification:'not_readable',
        configurations:null});
      expect(r.note).toContain('does not prove');
    }
    await expect(fixture({error:{statusCode:500}}).run({})).rejects.toMatchObject({statusCode:500});
  });
  it('indirect read-only dispatch preserves whitelist and scoped permissions',async()=>{
    const f=fixture();
    const p=await dispatchReadOnlyTool({registry,name:tools[0].name,args:{},
      connection:f.ctx.connection,services:f.ctx.services,db:{}});
    expect(p.isError).toBeUndefined();
    expect(JSON.stringify(p)).not.toContain(privateData);
  });
});
