import {describe,it,expect,vi} from 'vitest';
import {tools,handlers} from '../../src/tools/admin-overview.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const id='acct_OWNEROVERVIEW',pii='PERSONAL_PRIVATE_SENTINEL';
const parse=v=>JSON.parse(v.content[0].text);
function fixture({due=['company.tax_id','representative.verification.document'],
  past=[],refused=false,capRefused=false,unknown=false}={}){
  const sdk={accounts:{
    retrieve:vi.fn(async()=>{
      if(refused)throw {statusCode:403,code:'permission_denied'};
      return {object:'account',id,livemode:false,charges_enabled:true,
        payouts_enabled:false,details_submitted:true,
        requirements:unknown?null:{currently_due:due,past_due:past,
          pending_verification:[],eventually_due:[],current_deadline:1794000000},
        email:pii,tax_id:pii,individual:{first_name:pii}};
    }),
    listCapabilities:vi.fn(async()=>{
      if(capRefused)throw {statusCode:403,code:'permission_denied'};
      return {object:'list',has_more:false,data:[{object:'capability',
        id:'card_payments',status:'active'}]};
    })}};
  const ctx={connection:{mode:'test',stripeAccount:id,profile:'read_only'},
    services:{stripeForConnection:async()=>sdk}};
  return {sdk,ctx};
}
describe('G-6b owner overview and safe requirements',()=>{
  it('registers only TEST reads for all profiles',()=>{
    expect(tools.map(x=>x.name)).toEqual(['admin_list_requirements','stripe_admin_overview']);
    for(const t of tools){
      expect(t.writes).toBe(false);
      expect(t.profiles).toContain('read_only');
      expect(registry.tools.filter(v=>v.name===t.name)).toHaveLength(1);
    }
  });
  it('groups category counts and deadline without exposing requirement paths',async()=>{
    const f=fixture();
    const result=parse(await handlers.admin_list_requirements({},f.ctx));
    expect(result.status).toBe('needs_attention');
    expect(result.totals.currentlyDue).toBe(2);
    expect(result.groups.currentlyDue).toEqual([
      {category:'company',label:'Legal business information',count:1},
      {category:'representative',label:'Business representative verification',count:1}
    ]);
    expect(result.deadlineDenver).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain('tax_id');
    expect(JSON.stringify(result)).not.toContain('verification.document');
    expect(JSON.stringify(result)).not.toContain(pii);
    expect(f.sdk.accounts.retrieve).toHaveBeenCalledTimes(1);
  });
  it('does not confuse unreadable requirements with completed requirements',async()=>{
    expect(parse(await handlers.admin_list_requirements({},
      fixture({due:[],past:[]}).ctx)).status).toBe('ok');
    expect(parse(await handlers.admin_list_requirements({},
      fixture({unknown:true}).ctx)).status).toBe('not_readable');
    const denied=parse(await handlers.admin_list_requirements({},
      fixture({refused:true}).ctx));
    expect(denied).toMatchObject({status:'not_readable',observed:false,totals:null});
  });
  it('overview independently identifies observed and unreadable account sections',async()=>{
    const f=fixture();
    const v=parse(await handlers.stripe_admin_overview({},f.ctx));
    expect(v.sections.account).toMatchObject({status:'needs_attention',observed:true});
    expect(v.sections.capabilities).toMatchObject({status:'observed',observed:true});
    expect(v.sections.teamSecurity).toMatchObject({status:'not_readable',observed:false});
    expect(v.sections.fees.status).toBe('not_readable');
    expect(v.unreadable).toContain('tax');
    expect(JSON.stringify(v)).not.toContain(pii);
    expect(f.sdk.accounts.listCapabilities).toHaveBeenCalledTimes(1);
  });
  it('restricted capabilities and account reads never cause a healthy overview',async()=>{
    const v=parse(await handlers.stripe_admin_overview({},
      fixture({refused:true,capRefused:true}).ctx));
    expect(v.sections.account.status).toBe('not_readable');
    expect(v.sections.capabilities.status).toBe('not_readable');
  });
  it('fail closed on LIVE, invalid schema and foreign account',async()=>{
    const f=fixture();
    for(const name of ['admin_list_requirements','stripe_admin_overview']){
      expect((await handlers[name]({unknown:true},f.ctx)).isError).toBe(true);
      expect((await handlers[name]({},{
        ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    }
    const indirect=await dispatchReadOnlyTool({registry,name:'admin_list_requirements',
      args:{},connection:f.ctx.connection,services:f.ctx.services,db:{}});
    expect(indirect.isError).toBeUndefined();
    expect(JSON.stringify(indirect)).not.toContain(pii);
    expect(f.sdk.accounts.retrieve).toHaveBeenCalledTimes(1);
  });
});
