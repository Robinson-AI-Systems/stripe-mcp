import {describe,it,expect,vi} from 'vitest';
import {DASHBOARD_SETTINGS,SETTING_READERS,whereIsSetting} from '../../src/data/dashboard-map.js';
import {handlers,tools} from '../../src/tools/admin-guided.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const acct='acct_GUIDEDTEST',secret='PRIVATE_ACCOUNT_PII';
const parse=x=>JSON.parse(x.content[0].text);
function fixture({due=0,refused=false}={}){
  const sdk={accounts:{retrieve:vi.fn(async()=>{
    if(refused)throw {statusCode:403,code:'permission_denied'};
    return {object:'account',id:acct,livemode:false,charges_enabled:true,
      payouts_enabled:false,details_submitted:true,country:'US',
      requirements:{currently_due:due?['person.'+secret]:[],past_due:[],
        pending_verification:[],current_deadline:1794000000},
      email:secret,address:{line1:secret}};
  })}};
  const ctx={connection:{mode:'test',profile:'read_only',stripeAccount:acct},
    services:{stripeForConnection:async()=>sdk}};
  return {ctx,sdk};
}
describe('G-6a owner guided settings and honest account verification',()=>{
  it('catalog entry is read-only across profiles with no write tools',()=>{
    expect(tools).toHaveLength(2);
    expect(tools.every(x=>x.writes===false)).toBe(true);
    expect(registry.tools.filter(x=>tools.some(y=>x.name===y.name))).toHaveLength(2);
  });
  it('every mapped key has actionable steps and an explicit expected outcome',()=>{
    const names=new Set(registry.tools.map(x=>x.name));
    for(const [key,entry] of Object.entries(DASHBOARD_SETTINGS)){
      expect(entry.steps.length).toBeGreaterThanOrEqual(3);
      expect(entry.steps.every(x=>typeof x==='string'&&x.length>12)).toBe(true);
      const guide=whereIsSetting(key);
      expect(guide).toMatchObject({found:true,changeMade:false});
      expect(guide.url).toMatch(/^https:\/\/dashboard\.stripe\.com\//);
      expect(guide.expected).toContain('Verify');
      if(SETTING_READERS[key])expect(names.has(SETTING_READERS[key])).toBe(true);
    }
    expect(Object.keys(DASHBOARD_SETTINGS)).toContain('account_closure');
    expect(SETTING_READERS.account_closure).toBeUndefined();
  });
  it('lists bounded pages and only safe Dashboard steps; no claim of changes',async()=>{
    const f=fixture(),p=parse(await handlers.admin_list_guided_settings({
      section:'security',detail:'full',limit:2},f.ctx));
    expect(p.settings).toHaveLength(2);
    expect(p.settings.every(x=>x.changeMade===false&&
      x.verification==='not_readable')).toBe(true);
    expect(p.nextOffset).toBe(2);
    expect(JSON.stringify(p)).not.toContain(secret);
    expect(f.sdk.accounts.retrieve).not.toHaveBeenCalled();
    expect((await handlers.admin_list_guided_settings({limit:50},f.ctx)).isError).toBe(true);
  });
  it('checks account verification with fresh observed TEST provider counts only',async()=>{
    const f=fixture({due:1});
    const v=parse(await handlers.admin_check_setting({setting:'account_verification'},f.ctx));
    expect(v).toMatchObject({status:'needs_attention',observed:true,dueCount:1});
    expect(JSON.stringify(v)).not.toContain(secret);
    expect(f.sdk.accounts.retrieve).toHaveBeenCalledTimes(1);
    const ok=parse(await handlers.admin_check_setting({setting:'account_verification'},
      fixture().ctx));
    expect(ok.status).toBe('ok');
  });
  it('Dash-only values and refused APIs are not_readable, not healthy',async()=>{
    const f=fixture();
    const missing=parse(await handlers.admin_check_setting({setting:'two_step_login'},f.ctx));
    expect(missing).toMatchObject({status:'not_readable',observed:false,
      changeMade:false});
    expect(f.sdk.accounts.retrieve).not.toHaveBeenCalled();
    const restricted=parse(await handlers.admin_check_setting({setting:'account_verification'},
      fixture({refused:true}).ctx));
    expect(restricted.status).toBe('not_readable');
    expect(restricted.observed).toBe(false);
  });
  it('LIVE, malformed and indirect read-only gates fail closed',async()=>{
    const f=fixture();
    expect((await handlers.admin_check_setting({setting:'unknown_setting'},f.ctx)).isError)
      .toBe(true);
    expect((await handlers.admin_check_setting({setting:'two_step_login'},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    const response=await dispatchReadOnlyTool({registry,name:'admin_check_setting',
      args:{setting:'account_verification'},connection:f.ctx.connection,services:f.ctx.services,db:{}});
    expect(response.isError).toBeUndefined();
    expect(JSON.stringify(response)).not.toContain(secret);
  });
});
