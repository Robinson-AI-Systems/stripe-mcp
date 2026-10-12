import {describe,it,expect,vi} from 'vitest';
import {tools,handlers,verifiedTestAccountRecord} from '../../src/tools/account-profile.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const id='acct_ACCOUNTSAFE',privacy='PRIVATE_TAX_AND_BANK_VALUE';
const record={id,object:'account',livemode:false,country:'US',
  default_currency:'usd',charges_enabled:true,payouts_enabled:false,
  details_submitted:true,business_type:'company',
  email:privacy,individual:{first_name:privacy,ssn_last_4:privacy},
  external_accounts:{data:[{account_number:privacy,routing_number:privacy}]},
  requirements:{currently_due:['representative.'+privacy,'company.tax_id'],
    past_due:[],pending_verification:[],current_deadline:1790000000,
    errors:[{code:privacy,reason:privacy}]}};
const parse=v=>JSON.parse(v.content[0].text);
function fixture({value=record,error}={}){
  const sdk={accounts:{retrieve:vi.fn(async()=>{
    if(error)throw error;return value;})}};
  const ctx={connection:{stripeAccount:id,mode:'test',profile:'read_only'},
    services:{stripeForConnection:async()=>sdk}};
  return {sdk,ctx,run:a=>handlers.account_get(a,ctx)};
}
describe('G-5a safe account profile',()=>{
  it('has one registered read-only TEST tool and safe summary/full projections',async()=>{
    expect(tools.map(x=>x.name)).toEqual(['account_get']);
    expect(tools[0].writes).toBe(false);
    expect(registry.tools.filter(x=>x.name==='account_get')).toHaveLength(1);
    const f=fixture();
    const summary=parse(await f.run({}));
    expect(summary).toMatchObject({id,country:'US',defaultCurrency:'usd',
      chargesEnabled:true,payoutsEnabled:false,verification:'needs_attention'});
    expect(summary).not.toHaveProperty('dueCount');
    const full=parse(await f.run({detail:'full'}));
    expect(full).toMatchObject({id,dueCount:2,pastDueCount:0,
      pendingCount:0,businessType:'company'});
    expect(JSON.stringify(full)).not.toContain(privacy);
    expect(JSON.stringify(full)).not.toContain('tax_id');
    expect(JSON.stringify(full)).not.toContain('external_accounts');
    expect(f.sdk.accounts.retrieve).toHaveBeenCalledTimes(2);
  });
  it('never interprets unreadable provider requirements as clear',async()=>{
    const f=fixture({value:{...record,requirements:null}});
    const v=parse(await f.run({detail:'full'}));
    expect(v.verification).toBe('not_readable');
    expect(v.dueCount).toBeNull();
    const zero=fixture({value:{...record,requirements:{currently_due:[],past_due:[]}}});
    expect(parse(await zero.run({})).verification).toBe('ok');
  });
  it('rejects LIVE, foreign identity, unknown arguments, malformed values and unsafe fields',async()=>{
    const f=fixture();
    for(const args of [{fields:['email']},{detail:'raw'},{foo:1},{fields:['id','id']}])
      expect((await f.run(args)).isError).toBe(true);
    expect((await handlers.account_get({},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    for(const val of [{...record,id:'acct_FOREIGN'}, {...record,livemode:true},
      {...record,livemode:undefined},{...record,livemode:null},
      {...record,livemode:'false'},
      {...record,charges_enabled:'yes'}, {...record,requirements:{
        currently_due:['x'],past_due:'none'}}]){
      expect((await fixture({value:val}).run({detail:'full'})).isError).toBe(true);
    }
  });
  it('requires explicit provider TEST identity rather than a missing mode',()=>{
    expect(verifiedTestAccountRecord(record,id)).toBe(true);
    for(const livemode of [undefined,null,'false',true])
      expect(verifiedTestAccountRecord({...record,livemode},id)).toBe(false);
    expect(verifiedTestAccountRecord({...record,id:'acct_OTHER'},id)).toBe(false);
  });
  it('reports permissions unreadable without inventing empty verification state',async()=>{
    const f=fixture({error:{statusCode:403,code:'permission_denied'}});
    const v=parse(await f.run({}));
    expect(v).toMatchObject({id,available:false,verification:'not_readable'});
    expect(v).not.toHaveProperty('chargesEnabled');
  });
  it('indirect dispatch remains safe and TEST-only under read-only connection',async()=>{
    const f=fixture();
    const r=await dispatchReadOnlyTool({registry,name:'account_get',args:{detail:'full'},
      connection:f.ctx.connection,db:{},services:f.ctx.services});
    expect(r.isError).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain(privacy);
  });
});
