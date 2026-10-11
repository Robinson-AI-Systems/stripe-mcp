import {describe,it,expect,vi} from 'vitest';
import {capabilitySafe,tools,handlers} from '../../src/tools/account-capabilities.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const account='acct_TESTCAPABILITY',secret='PRIVATE_OWNER_TAX_VALUE';
const record={object:'account',id:account,livemode:false};
const caps=[
  {id:'card_payments',object:'capability',account,status:'active',requested:true,
    requirements:{currently_due:[],pending_verification:[]},owner:secret,metadata:{private:secret}},
  {id:'us_bank_account_ach_payments',object:'capability',account,status:'pending',
    requested:true,requirements:{currently_due:['company.'+secret],pending_verification:[]},
    documents:[secret]},
  {id:'transfers',object:'capability',account,status:'inactive',requested:false,
    requirements:{currently_due:[],pending_verification:['representative.'+secret]}}
];
const parse=x=>JSON.parse(x.content[0].text);
function fixture({records=caps,identity=record,error,hasMore=false}={}){
  const sdk={accounts:{
    retrieve:vi.fn(async()=>identity),
    listCapabilities:vi.fn(async()=>{
      if(error)throw error;
      return {object:'list',data:records,has_more:hasMore};
    })}};
  const ctx={connection:{mode:'test',profile:'read_only',stripeAccount:account},
    services:{stripeForConnection:async()=>sdk}};
  return {sdk,ctx,run:a=>handlers.account_list_capabilities(a,ctx)};
}
describe('G-5b safe own-account TEST capabilities',()=>{
  it('registers one safe reader and projects only capability status and counts',async()=>{
    expect(tools[0]).toMatchObject({name:'account_list_capabilities',writes:false});
    expect(registry.tools.filter(x=>x.name==='account_list_capabilities')).toHaveLength(1);
    const f=fixture();
    const basic=parse(await f.run({}));
    expect(basic).toMatchObject({account,available:true,totalObserved:3,hasMore:false});
    expect(basic.capabilities[0]).toEqual({id:'card_payments',status:'active'});
    expect(JSON.stringify(basic)).not.toContain(secret);
    const full=parse(await f.run({detail:'full'}));
    expect(full.capabilities[1]).toEqual({id:'us_bank_account_ach_payments',
      status:'pending',requested:true,dueCount:1,pendingCount:0});
    expect(JSON.stringify(full)).not.toContain(secret);
    expect(f.sdk.accounts.retrieve).toHaveBeenCalledTimes(2);
    expect(f.sdk.accounts.listCapabilities).toHaveBeenCalledWith(account);
  });
  it('returns bounded pages without losing provider rows',async()=>{
    const f=fixture();
    const page=parse(await f.run({limit:1,offset:1,detail:'full'}));
    expect(page).toMatchObject({totalObserved:3,hasMore:true,nextOffset:2});
    expect(page.capabilities).toHaveLength(1);
    expect(page.capabilities[0].id).toBe('us_bank_account_ach_payments');
    expect(parse(await f.run({limit:2,offset:2}))).toMatchObject({
      hasMore:false,nextOffset:null});
  });
  it('rejection and own-account permissions never masquerade as disabled ACH',async()=>{
    const forbidden=fixture({error:{statusCode:403,code:'permission_denied'}});
    const v=parse(await forbidden.run({}));
    expect(v).toMatchObject({account,available:false,verification:'not_readable',
      capabilities:null});
    expect(v.note).toContain('NOT proof');
    expect((await fixture({identity:{...record,id:'acct_FOREIGN'}}).run({})).isError)
      .toBe(true);
    expect((await fixture({identity:{...record,livemode:true}}).run({})).isError)
      .toBe(true);
    expect((await fixture({hasMore:true}).run({})).isError).toBe(true);
    expect((await fixture({records:[{...caps[0],account:'acct_FOREIGN'}]}).run({})).isError)
      .toBe(true);
  });
  it('invalid args, LIVE or private fields fail closed',async()=>{
    const f=fixture();
    for(const a of [{limit:100},{offset:-1},{detail:'raw'},
      {fields:['owner']},{fields:['id','id']},{account:'acct_FOREIGN'}])
      expect((await f.run(a)).isError).toBe(true);
    const live=await handlers.account_list_capabilities({},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
    expect(live.isError).toBe(true);
    expect(()=>capabilitySafe({...caps[0],status:'unknown'},account)).toThrow();
  });
  it('honors indirect read-only dispatch and never leaks provider requirements',async()=>{
    const f=fixture();
    const r=await dispatchReadOnlyTool({registry,name:'account_list_capabilities',
      args:{detail:'full'},connection:f.ctx.connection,db:{},services:f.ctx.services});
    expect(r.isError).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain(secret);
  });
});
