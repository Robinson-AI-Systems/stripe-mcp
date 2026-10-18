import {registry} from '../../src/tools/index.js';
import {describe,expect,it} from 'vitest';
import {isToolAllowed,visibleTools,profileCounts,publicToolInfo,
  isGuardedTestWrite,isGuardedLiveWrite,listingForConnection} from
  '../../src/core/profiles.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import home from '../../api/index.js';
const setup=()=>{
  let calls=0;
  return {
    registry:{tools:[
      {name:'r_all',writes:false,profiles:['read_only','everyday','full'],inputSchema:{type:'object'}},
      {name:'r_owner',writes:false,profiles:['full'],inputSchema:{type:'object'}},
      {name:'w_everyday',writes:true,profiles:['everyday','full'],inputSchema:{type:'object'}},
      {name:'w_admin',writes:true,profiles:['full'],inputSchema:{type:'object'}}
    ],handlers:{
      r_all:async()=>{calls++;return {content:[{type:'text',text:'{"ok":true}'}]};},
      r_owner:async()=>{calls++;return {content:[{type:'text',text:'{"ok":true}'}]};},
      w_everyday:async()=>{calls++;return {content:[{type:'text',text:'{"ok":true}'}]};},
      w_admin:async()=>{calls++;return {content:[{type:'text',text:'{"ok":true}'}]};}
    }},
    count:()=>calls
  };
};
describe('B-6 profile metadata, name-call and homepage counts',()=>{
  it('read_only never sees money/destructive tools, even when enablement is requested',()=>{
    const {registry}=setup();
    expect(visibleTools(registry,'read_only',{allowWrites:true}).map(x=>x.name)).toEqual(['r_all']);
    expect(isToolAllowed(registry.tools[2],'read_only',{allowWrites:true})).toBe(false);
    expect(visibleTools(registry,'everyday',{allowWrites:true}).map(x=>x.name))
      .toEqual(['r_all','w_everyday']);
    expect(visibleTools(registry,'full',{allowWrites:true}).map(x=>x.name))
      .toEqual(['r_all','r_owner','w_everyday','w_admin']);
  });
  it('current MCP remains read-only even on an everyday or full connection',()=>{
    const {registry}=setup();
    expect(visibleTools(registry,'full').map(x=>x.name)).toEqual(['r_all','r_owner']);
    expect(visibleTools(registry,'everyday').map(x=>x.name)).toEqual(['r_all']);
    expect(profileCounts(registry)).toEqual({read_only:1,everyday:1,full:2});
  });
  it('refuses undeclared/invalid profiles and tools missing explicit writes metadata',()=>{
    expect(isToolAllowed({name:'unclassified',profiles:['full']},'full')).toBe(false);
    expect(isToolAllowed({name:'fake',writes:false,profiles:['full']},'admin')).toBe(false);
    expect(isToolAllowed({name:'fake',writes:false,profiles:'full'},'full')).toBe(false);
    expect(visibleTools(null,'full')).toEqual([]);
  });
  it('only TEST full owner can discover the original eight guarded composite writes',()=>{
    const names=['workflow_refund_customer','workflow_cancel_customer',
      'workflow_change_plan','workflow_dispute_kit_save',
      'workflow_webhook_health_fix','workflow_month_end_report',
      'workflow_set_up_catalog','workflow_brand_business'];
    for(const name of names){
      const t=(awaitedRegistry=>awaitedRegistry.tools.find(x=>x.name===name))(registry);
      expect(t?.writeContract).toBe('defineWrite-v1');
      expect(isGuardedTestWrite(t,{mode:'test',profile:'full'})).toBe(true);
      expect(isGuardedTestWrite(t,{mode:'test',profile:'everyday'})).toBe(false);
      expect(isGuardedTestWrite(t,{mode:'live',profile:'full'})).toBe(false);
    }
    expect(listingForConnection(registry,{mode:'test',profile:'full',
      listing:'catalog'}).map(x=>x.name)).toEqual(expect.arrayContaining(names));
    expect(listingForConnection(registry,{mode:'test',profile:'everyday',
      listing:'catalog'}).some(x=>names.includes(x.name))).toBe(false);
    expect(isGuardedTestWrite({name:'workflow_unreviewed',
      area:'workflows',writes:true,writeContract:'defineWrite-v1',profiles:['full']},
      {mode:'test',profile:'full'})).toBe(false);
  });

  it('surfaces already-wrapped nonfinancial TEST families without delegating them to read-only or LIVE by accident',()=>{
    const areas=['money','webhooks','account','branding','catalog','reports'];
    for(const area of areas){
      const wrapped=registry.tools.filter(t=>t.area===area&&t.writes===true&&
        t.writeContract==='defineWrite-v1');
      expect(wrapped.length).toBeGreaterThan(0);
      for(const tool of wrapped){
        expect(isGuardedTestWrite(tool,{mode:'test',profile:'full'})).toBe(true);
        expect(isGuardedTestWrite(tool,{mode:'test',profile:'read_only'})).toBe(false);
        const liveAccount=new Set([
          'account_update_payment_method_settings','account_add_apple_pay_domain'
        ]);
        const liveWebhooks=new Set([
          'webhook_create','webhook_add_events','webhook_remove_events',
          'webhook_update','webhook_delete'
        ]);
        const liveCatalog=new Set([
          'product_create','product_update','product_archive','product_unarchive',
          'product_delete','price_create','price_update'
        ]);
        const approved=area==='account'&&liveAccount.has(tool.name)||
          area==='webhooks'&&liveWebhooks.has(tool.name)||
          area==='catalog'&&liveCatalog.has(tool.name);
        expect(isGuardedLiveWrite(tool,{mode:'live',profile:'full',
          rtcLiveOwnerApproved:true,moneyLimitCents:10000})).toBe(approved);
      }
    }
    const names=listingForConnection(registry,{mode:'test',profile:'full',
      listing:'catalog'}).map(t=>t.name);
    expect(names).toContain('webhook_add_events');
    expect(names).toContain('account_update_payment_method_settings');
  });
  it('shows a guarded LIVE operation only after separate owner LIVE delegation',()=>{
    const tool=registry.tools.find(t=>t.name==='api_write');
    const permitted={mode:'live',profile:'full',rtcLiveOwnerApproved:true,
      moneyLimitCents:0,listing:'catalog'};
    expect(isGuardedLiveWrite(tool,permitted)).toBe(true);
    expect(listingForConnection(registry,permitted).some(t=>t.name==='api_write')).toBe(true);
    expect(isGuardedLiveWrite(tool,{...permitted,rtcLiveOwnerApproved:false})).toBe(false);
    expect(listingForConnection(registry,{...permitted,rtcLiveOwnerApproved:false})
      .some(t=>t.name==='api_write')).toBe(false);
  });
  it('never publishes internal capability metadata with listed tools',()=>{
    const tool={name:'read',writes:false,profiles:['read_only'],description:'safe'};
    expect(publicToolInfo(tool)).toMatchObject({name:'read',description:'safe',
      annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}});
    expect(publicToolInfo(tool)).not.toHaveProperty('writes');
    expect(tool.writes).toBe(false);
  });
  it('hidden tools cannot be invoked by guessing their exact registered names',async()=>{
    const fixture=setup(),db={};
    const tryCall=(name,profile)=>dispatchReadOnlyTool({
      registry:fixture.registry,name,connection:{mode:'test',profile},db,args:{confirm:true}
    });
    expect((await tryCall('r_owner','read_only')).isError).toBe(true);
    expect((await tryCall('w_admin','full')).isError).toBe(true);
    expect((await tryCall('w_everyday','everyday')).isError).toBe(true);
    expect(fixture.count()).toBe(0);
    const response=await tryCall('r_owner','full');
    expect(response.isError).toBeUndefined();
    expect(fixture.count()).toBe(1);
  });
  it('home endpoint publishes true currently usable counts for each profile',()=>{
    let body;
    const res={setHeader:()=>{},status:(code)=>{expect(code).toBe(200);return res;},
      json:value=>{body=value;return res;}};
    home({},res);
    expect(body.profileToolCounts).toEqual({read_only:129,everyday:131,full:142});
    expect(body.tools).toBe(264);
  });
});
