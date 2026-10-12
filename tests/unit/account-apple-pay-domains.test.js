import {describe,it,expect,vi} from 'vitest';
import {tools,handlers,safeDomain} from '../../src/tools/account-apple-pay-domains.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const account='acct_TESTDOMAIN',privateValue='PRIVATE_SIGNING_SECRET';
const domain={id:'pmd_DOMAIN1',object:'payment_method_domain',domain_name:'checkout.example.com',
  enabled:true,apple_pay:{status:'active'},livemode:false,metadata:{secret:privateValue}};
const parse=x=>JSON.parse(x.content[0].text);
function fixture({record=domain,identity={object:'account',id:account,livemode:false},
    error,hasMore=false}={}){
  const sdk={accounts:{retrieve:vi.fn(async()=>identity)},
    paymentMethodDomains:{list:vi.fn(async()=>{if(error)throw error;
      return {object:'list',data:[record],has_more:hasMore};})}};
  const ctx={connection:{stripeAccount:account,mode:'test',profile:'read_only'},
    services:{stripeForConnection:async()=>sdk}};
  return {sdk,ctx,run:a=>handlers.account_list_apple_pay_domains(a,ctx)};
}
describe('G-5d1 Apple Pay domain read evidence',()=>{
  it('reads native TEST state and returns only safe verified fields',async()=>{
    expect(tools[0]).toMatchObject({writes:false,name:'account_list_apple_pay_domains'});
    expect(registry.tools.filter(x=>x.name===tools[0].name)).toHaveLength(1);
    const f=fixture();
    const r=parse(await f.run({}));
    expect(r).toMatchObject({account,available:true,hasMore:false,
      domains:[{id:domain.id,domain:domain.domain_name,enabled:true,applePayReady:true}]});
    expect(JSON.stringify(r)).not.toContain(privateValue);
    expect(f.sdk.paymentMethodDomains.list).toHaveBeenCalledWith({limit:10});
  });
  it('handles opaque paging without claiming completion',async()=>{
    const f=fixture({hasMore:true});
    const r=parse(await f.run({limit:1,starting_after:'pmd_PREVIOUS'}));
    expect(r).toMatchObject({hasMore:true,nextCursor:'pmd_DOMAIN1'});
    expect(f.sdk.paymentMethodDomains.list).toHaveBeenCalledWith({limit:1,
      starting_after:'pmd_PREVIOUS'});
  });
  it('marks disabled/inactive domains unready; rejects fabricated flags',async()=>{
    expect(safeDomain({...domain,enabled:false}).applePayReady).toBe(false);
    expect(safeDomain({...domain,apple_pay:{status:'inactive'}}).applePayReady).toBe(false);
    expect(()=>safeDomain({...domain,livemode:true})).toThrow();
    expect(()=>safeDomain({...domain,apple_pay:{status:'unknown'}})).toThrow();
  });
  it('permission denial is unreadable, not active; foreign/LIVE reject',async()=>{
    const out=parse(await fixture({error:{statusCode:403}}).run({}));
    expect(out).toMatchObject({available:false,verification:'not_readable',domains:null});
    expect((await fixture({identity:{object:'account',id:'acct_FOREIGN'}}).run({})).isError)
      .toBe(true);
    for(const livemode of [undefined,null,'false']){
      const f=fixture({identity:{object:'account',id:account,livemode}});
      expect((await f.run({})).isError).toBe(true);
      expect(f.sdk.paymentMethodDomains.list).not.toHaveBeenCalled();
    }
    const f=fixture();
    expect((await handlers.account_list_apple_pay_domains({},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    for(const a of [{limit:0},{starting_after:'nope'},{domain:'evil.com'}])
      expect((await f.run(a)).isError).toBe(true);
  });
  it('works through indirect read-only dispatch without raw domain metadata',async()=>{
    const f=fixture();
    const result=await dispatchReadOnlyTool({registry,name:tools[0].name,args:{},
      connection:f.ctx.connection,services:f.ctx.services,db:{}});
    expect(result.isError).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(privateValue);
  });
});
